/* MAREA — fluido incompresible de Stable Fluids (Stam, 1999).
   No es ruido que parece líquido: es la ecuación de Navier-Stokes resuelta
   cada cuadro. Advección semi-lagrangiana (cada píxel pregunta de dónde venía),
   y después la proyección de presión — el paso caro, veinte iteraciones de
   Jacobi — que le quita la divergencia al campo. Eso es lo que hace que el
   fluido se comporte como fluido y no como humo pintado: no puede comprimirse,
   así que si empujás de un lado, tiene que salir por otro. */
(function () {
  var VS = '#version 300 es\nlayout(location=0) in vec2 a;out vec2 uv;' +
           'void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}';
  var CAB = '#version 300 es\nprecision highp float;\nin vec2 uv;\n';

  /* Advección: retroceder por el campo de velocidad y muestrear ahí. Es
     incondicionalmente estable — de ahí el nombre del método. */
  var ADVECT = CAB + [
'out vec4 o;',
'uniform sampler2D uVel,uSrc; uniform vec2 uPaso; uniform float uDt,uDisip;',
'void main(){',
' vec2 v=texture(uVel,uv).xy;',
' vec2 atras=uv-uDt*v*uPaso;',
' o=texture(uSrc,clamp(atras,vec2(0.0),vec2(1.0)))*uDisip;}'].join('\n');

  var DIVERG = CAB + [
'out vec4 o;',
'uniform sampler2D uVel; uniform vec2 uPaso;',
'void main(){',
' float l=texture(uVel,uv-vec2(uPaso.x,0)).x;',
' float r=texture(uVel,uv+vec2(uPaso.x,0)).x;',
' float b=texture(uVel,uv-vec2(0,uPaso.y)).y;',
' float t=texture(uVel,uv+vec2(0,uPaso.y)).y;',
' o=vec4(0.5*(r-l+t-b),0.0,0.0,1.0);}'].join('\n');

  /* Jacobi sobre la ecuación de Poisson. Cada iteración acerca la presión a
     la que anula la divergencia; veinte alcanzan para que se lea bien. */
  var JACOBI = CAB + [
'out vec4 o;',
'uniform sampler2D uPres,uDiv; uniform vec2 uPaso;',
'void main(){',
' float l=texture(uPres,uv-vec2(uPaso.x,0)).x;',
' float r=texture(uPres,uv+vec2(uPaso.x,0)).x;',
' float b=texture(uPres,uv-vec2(0,uPaso.y)).x;',
' float t=texture(uPres,uv+vec2(0,uPaso.y)).x;',
' float d=texture(uDiv,uv).x;',
' o=vec4((l+r+b+t-d)*0.25,0.0,0.0,1.0);}'].join('\n');

  var GRADIENTE = CAB + [
'out vec4 o;',
'uniform sampler2D uPres,uVel; uniform vec2 uPaso;',
'void main(){',
' float l=texture(uPres,uv-vec2(uPaso.x,0)).x;',
' float r=texture(uPres,uv+vec2(uPaso.x,0)).x;',
' float b=texture(uPres,uv-vec2(0,uPaso.y)).x;',
' float t=texture(uPres,uv+vec2(0,uPaso.y)).x;',
' vec2 v=texture(uVel,uv).xy-vec2(r-l,t-b)*0.5;',
/* Bordes: velocidad nula contra la pared, si no el fluido "chupa" del canto. */
' vec2 m=step(vec2(1.5)*uPaso,uv)*step(uv,1.0-vec2(1.5)*uPaso);',
' o=vec4(v*m.x*m.y,0.0,1.0);}'].join('\n');

  /* Inyección: el puntero mete velocidad y tinta con una gaussiana. */
  var SPLAT = CAB + [
'out vec4 o;',
'uniform sampler2D uSrc; uniform vec2 uPunto,uAspect; uniform vec3 uVal;',
'uniform float uRadio;',
'void main(){',
' vec2 d=(uv-uPunto)*uAspect;',
' float g=exp(-dot(d,d)/uRadio);',
' o=vec4(texture(uSrc,uv).xyz+uVal*g,1.0);}'].join('\n');

  var VER = function (P, R) { return CAB + [
'out vec4 o;',
'uniform sampler2D uTinta,uVel; uniform vec2 uPaso; uniform float uT;',
P, R,
'void main(){',
' vec3 c=texture(uTinta,uv).rgb;',
' float dens=length(c);',
/* Curl: cuánto rota el campo acá. Es lo que da los filamentos — el ojo lee
   la vorticidad como "esto está vivo". */
' float vt=texture(uVel,uv+vec2(0,uPaso.y)).x;',
' float vb=texture(uVel,uv-vec2(0,uPaso.y)).x;',
' float vr=texture(uVel,uv+vec2(uPaso.x,0)).y;',
' float vl=texture(uVel,uv-vec2(uPaso.x,0)).y;',
' float curl=abs((vr-vl)-(vt-vb))*0.5;',
/* La tinta lleva su propio matiz en el vector; la película delgada lo
   astilla según la vorticidad. */
' float fase=c.r*0.9+c.g*0.6+c.b*0.3+curl*2.2+uT*0.02;',
' vec3 film=pelicula(fase);',
' vec3 col=hgRamp(clamp(dens*1.45,0.0,1.0));',
' col=mix(col, mix(VIOLET_C,CELESTE_C,film.g), clamp(curl*9.0,0.0,0.6));',
' col+=AGUA_C*clamp(curl*6.0,0.0,1.0)*0.35;',
' col*=smoothstep(0.0,0.012,dens);',
' col=col/(1.0+col*0.75);',
' col+=(hash21(gl_FragCoord.xy+fract(uT)*13.7)-0.5)*0.03;',
' o=vec4(max(col,0.0),1.0);}'].join('\n'); };

  (window.LAB = window.LAB || []).push({
    id: 'marea',
    nombre: 'MAREA',
    tec: 'Navier-Stokes · advección semi-lagrangiana · proyección de presión',
    desc: 'Un fluido de verdad, no ruido que lo imita: se resuelve la ecuación ' +
          'cada cuadro. El paso caro son veinte iteraciones de Jacobi que le ' +
          'quitan la divergencia al campo — por eso el líquido no se puede ' +
          'comprimir, y si empujás de un lado tiene que salir por otro.',
    crear: function (API) {
      var gl = API.gl;
      var pAdv = API.programa(VS, ADVECT), pDiv = API.programa(VS, DIVERG),
          pJac = API.programa(VS, JACOBI), pGrad = API.programa(VS, GRADIENTE),
          pSpl = API.programa(VS, SPLAT), pVer = API.programa(VS, VER(API.PALETA, API.RUIDO));
      if (!pAdv || !pDiv || !pJac || !pGrad || !pSpl || !pVer) return null;

      var W = 2, H = 2, SW = 0, SH = 0;
      var vel = null, tinta = null, pres = null, divT = null, divF = null;
      var u = function (p, n) { return gl.getUniformLocation(p, n); };

      function medir(w, h) {
        W = w; H = h;
        var esc = Math.min(1, 560 / Math.max(w, h));
        var nw = Math.max(64, Math.floor(w * esc)), nh = Math.max(64, Math.floor(h * esc));
        if (nw === SW && nh === SH) return;
        SW = nw; SH = nh;
        var cero = new Float32Array(SW * SH * 4);
        vel = API.pingpong(SW, SH, cero, true);
        tinta = API.pingpong(SW, SH, cero, true);
        pres = API.pingpong(SW, SH, cero, false);
        divT = API.textura(SW, SH, cero, true, false);
        divF = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, divF);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, divT, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }

      function pasada(prog, fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, SW, SH);
        gl.useProgram(prog);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      function tex(unidad, t, prog, nombre) {
        gl.activeTexture(gl.TEXTURE0 + unidad);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.uniform1i(u(prog, nombre), unidad);
      }

      var sembrado = false, ultimoSplat = 0;

      function splat(destino, x, y, val, radio) {
        gl.useProgram(pSpl);
        tex(0, destino.leer(), pSpl, 'uSrc');
        gl.uniform2f(u(pSpl, 'uPunto'), x, y);
        gl.uniform2f(u(pSpl, 'uAspect'), SW / SH, 1);
        gl.uniform3f(u(pSpl, 'uVal'), val[0], val[1], val[2]);
        gl.uniform1f(u(pSpl, 'uRadio'), radio);
        pasada(pSpl, destino.escribir());
        destino.dar();
      }

      return {
        medir: medir,
        dibujar: function (t, dt, m) {
          if (!vel) medir(W, H);
          gl.bindVertexArray(API.vaoQuad);
          var paso = [1 / SW, 1 / SH];

          // Primer cuadro: unas gotas para que haya algo que mirar sin tocar.
          if (!sembrado) {
            sembrado = true;
            for (var s = 0; s < 7; s++) {
              var a = s / 7 * 6.2831, rr = 0.20;
              splat(tinta, 0.5 + Math.cos(a) * rr, 0.5 + Math.sin(a) * rr,
                    [1.2 + Math.random(), 0.7 + Math.random(), 1.0 + Math.random()], 0.0030);
              splat(vel, 0.5 + Math.cos(a) * rr, 0.5 + Math.sin(a) * rr,
                    [Math.cos(a) * 7.0, Math.sin(a) * 7.0, 0], 0.0022);
            }
          }
          /* Fuentes propias: dos inyectores girando en contrafase. Sin esto
             el fluido se apaga solo y la pieza solo vive si la tocás. */
          for (var q = 0; q < 2; q++) {
            var fa = t * 0.28 + q * 3.14159;
            var ox = 0.5 + Math.cos(fa) * 0.26, oy = 0.5 + Math.sin(fa * 1.3) * 0.22;
            splat(vel, ox, oy, [-Math.sin(fa) * 4.5, Math.cos(fa * 1.3) * 4.5, 0], 0.0016);
            var ph = t * 0.4 + q * 2.0;
            splat(tinta, ox, oy,
                  [(0.5 + 0.5 * Math.sin(ph)) * 0.022,
                   (0.5 + 0.5 * Math.sin(ph + 2.1)) * 0.022,
                   (0.5 + 0.5 * Math.sin(ph + 4.2)) * 0.022], 0.0008);
          }

          // El puntero empuja: velocidad proporcional a lo rápido que movés.
          var vmag = Math.hypot(m.vx, m.vy);
          if (vmag > 0.02 || m.abajo) {
            /* La velocidad se guarda en celdas de grilla por paso, no en
               fracciones de pantalla: la advección la multiplica por 1/ancho.
               Un empujón fuerte son unas pocas celdas, no cientos. */
            var k = 7.0 / Math.max(1, vmag);
            splat(vel, m.x, m.y, [m.vx * k, m.vy * k, 0], 0.0011);
            var f = t * 0.35;
            splat(tinta, m.x, m.y,
                  [0.18 + 0.12 * Math.sin(f), 0.18 + 0.12 * Math.sin(f + 2.1),
                   0.18 + 0.12 * Math.sin(f + 4.2)], 0.0009);
          }

          var dtf = Math.min(dt, 0.022) * 60;   // paso normalizado a 60 fps

          // 1 · advectar la velocidad sobre sí misma
          gl.useProgram(pAdv);
          gl.uniform2f(u(pAdv, 'uPaso'), paso[0], paso[1]);
          gl.uniform1f(u(pAdv, 'uDt'), dtf);
          gl.uniform1f(u(pAdv, 'uDisip'), 0.998);
          tex(0, vel.leer(), pAdv, 'uVel'); tex(1, vel.leer(), pAdv, 'uSrc');
          pasada(pAdv, vel.escribir()); vel.dar();

          // 2 · divergencia del campo advectado
          gl.useProgram(pDiv);
          gl.uniform2f(u(pDiv, 'uPaso'), paso[0], paso[1]);
          tex(0, vel.leer(), pDiv, 'uVel');
          pasada(pDiv, divF);

          // 3 · presión: Jacobi. Acá se va casi todo el costo del fluido.
          gl.useProgram(pJac);
          gl.uniform2f(u(pJac, 'uPaso'), paso[0], paso[1]);
          for (var i = 0; i < 20; i++) {
            tex(0, pres.leer(), pJac, 'uPres'); tex(1, divT, pJac, 'uDiv');
            pasada(pJac, pres.escribir()); pres.dar();
          }

          // 4 · restar el gradiente: el campo queda sin divergencia
          gl.useProgram(pGrad);
          gl.uniform2f(u(pGrad, 'uPaso'), paso[0], paso[1]);
          tex(0, pres.leer(), pGrad, 'uPres'); tex(1, vel.leer(), pGrad, 'uVel');
          pasada(pGrad, vel.escribir()); vel.dar();

          // 5 · arrastrar la tinta por el campo ya corregido
          gl.useProgram(pAdv);
          gl.uniform2f(u(pAdv, 'uPaso'), paso[0], paso[1]);
          gl.uniform1f(u(pAdv, 'uDt'), dtf);
          gl.uniform1f(u(pAdv, 'uDisip'), 0.9968);
          tex(0, vel.leer(), pAdv, 'uVel'); tex(1, tinta.leer(), pAdv, 'uSrc');
          pasada(pAdv, tinta.escribir()); tinta.dar();

          // 6 · pintar
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, W, H);
          gl.useProgram(pVer);
          tex(0, tinta.leer(), pVer, 'uTinta'); tex(1, vel.leer(), pVer, 'uVel');
          gl.uniform2f(u(pVer, 'uPaso'), paso[0], paso[1]);
          gl.uniform1f(u(pVer, 'uT'), t);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.bindVertexArray(null);
        },
        soltar: function () {
          [pAdv, pDiv, pJac, pGrad, pSpl, pVer].forEach(function (p) { gl.deleteProgram(p); });
        }
      };
    }
  });
})();
