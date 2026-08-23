/* RESACA — reacción-difusión de Gray-Scott.
   Dos sustancias en un campo: una se difunde rápido y alimenta, la otra se
   difunde lento y consume. De esas dos líneas sale todo — manchas que se
   dividen como células, frentes que se comen entre ellos, laberintos. No hay
   nada dibujado: es química corriendo en la GPU, ping-pong entre dos texturas.
   El puntero siembra reactivo; el patrón decide qué hacer con él. */
(function () {
  var SIM = function () { return [
'#version 300 es',
'precision highp float;',
'in vec2 uv; out vec4 o;',
'uniform sampler2D uEstado; uniform vec2 uPaso;',
'uniform vec2 uM; uniform float uSiembra, uF, uK;',
'void main(){',
' vec2 c=texture(uEstado,uv).rg;',
/* Laplaciano de 9 puntos: los cuatro vecinos pesan 0.2, las diagonales 0.05,
   el centro -1. Es el kernel clásico de Gray-Scott; con el de 5 puntos los
   patrones salen cuadrados porque la grilla se nota. */
' vec2 l=vec2(0.0);',
' l+=texture(uEstado,uv+vec2(-uPaso.x,0)).rg*0.20;',
' l+=texture(uEstado,uv+vec2( uPaso.x,0)).rg*0.20;',
' l+=texture(uEstado,uv+vec2(0,-uPaso.y)).rg*0.20;',
' l+=texture(uEstado,uv+vec2(0, uPaso.y)).rg*0.20;',
' l+=texture(uEstado,uv+vec2(-uPaso.x,-uPaso.y)).rg*0.05;',
' l+=texture(uEstado,uv+vec2( uPaso.x,-uPaso.y)).rg*0.05;',
' l+=texture(uEstado,uv+vec2(-uPaso.x, uPaso.y)).rg*0.05;',
' l+=texture(uEstado,uv+vec2( uPaso.x, uPaso.y)).rg*0.05;',
' l-=c;',
' float a=c.r, b=c.g;',
' float reac=a*b*b;',
/* Da=1, Db=0.5: la diferencia entre las dos velocidades de difusión es la
   que rompe la simetría. Si fueran iguales, el campo se aplanaría y no
   pasaría nada nunca. */
' float na=a+(1.0*l.r-reac+uF*(1.0-a));',
' float nb=b+(0.5*l.g+reac-(uK+uF)*b);',
/* Siembra: el puntero deja B, que es el reactivo que arma estructura. */
' float d=length((uv-uM)*vec2(uPaso.y/uPaso.x,1.0));',
' nb+=uSiembra*exp(-d*d*900.0);',
' o=vec4(clamp(na,0.0,1.0),clamp(nb,0.0,1.0),0.0,1.0);}'
  ].join('\n'); };

  var VER = function (P, R) { return [
'#version 300 es',
'precision highp float;',
'in vec2 uv; out vec4 o;',
'uniform sampler2D uEstado; uniform vec2 uPaso; uniform float uT;',
P, R,
'void main(){',
' vec2 c=texture(uEstado,uv).rg;',
' float b=c.g;',
/* La pendiente del campo da el relieve: donde la concentración cambia
   rápido hay un borde, y ahí es donde el material tiene que brillar. */
' float bx=texture(uEstado,uv+vec2(uPaso.x,0)).g-texture(uEstado,uv-vec2(uPaso.x,0)).g;',
' float by=texture(uEstado,uv+vec2(0,uPaso.y)).g-texture(uEstado,uv-vec2(0,uPaso.y)).g;',
' vec3 n=normalize(vec3(-bx*24.0,-by*24.0,1.0));',
' vec3 L=normalize(vec3(-0.45,0.6,0.66));',
' float dif=0.35+0.65*max(dot(n,L),0.0);',
' float spec=pow(max(dot(reflect(-L,n),vec3(0,0,1)),0.0),34.0);',
' float borde=length(vec2(bx,by))*22.0;',
/* La película delgada se muestrea con la concentración: el color no está
   elegido, lo dicta la química. */
' vec3 film=pelicula(b*2.1+borde*0.35+uT*0.02);',
' vec3 col=hgRamp(clamp(b*2.6,0.0,1.0))*dif;',
' col=mix(col, mix(CELESTE_C,AGUA_C,film.g), clamp(borde,0.0,1.0)*0.55);',
' col+=WHITE_C*spec*clamp(borde,0.0,1.0)*0.9;',
' col+=VIOLET_C*pow(clamp(borde,0.0,1.0),2.0)*0.35;',
' col=col/(1.0+col*0.7);',
' col+=(hash21(gl_FragCoord.xy+fract(uT)*57.1)-0.5)*0.03;',
' o=vec4(max(col,0.0),1.0);}'
  ].join('\n'); };

  (window.LAB = window.LAB || []).push({
    id: 'resaca',
    nombre: 'RESACA',
    tec: 'Reacción-difusión Gray-Scott · ping-pong float · relieve por gradiente',
    desc: 'Dos sustancias que se difunden a distinta velocidad y se comen entre ' +
          'ellas. De esas dos líneas de química sale todo lo que ves: manchas ' +
          'que se dividen como células, frentes que avanzan, laberintos. Nada ' +
          'está dibujado — sembrás con el puntero y el patrón decide.',
    crear: function (API) {
      var gl = API.gl;
      var VS = '#version 300 es\nlayout(location=0) in vec2 a;out vec2 uv;' +
               'void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}';
      var pSim = API.programa(VS, SIM());
      var pVer = API.programa(VS, VER(API.PALETA, API.RUIDO));
      if (!pSim || !pVer) return null;

      var SW = 0, SH = 0, campo = null;
      var US = {}, UV = {};
      ['uEstado','uPaso','uM','uSiembra','uF','uK'].forEach(function (n) { US[n] = gl.getUniformLocation(pSim, n); });
      ['uEstado','uPaso','uT'].forEach(function (n) { UV[n] = gl.getUniformLocation(pVer, n); });
      var W = 2, H = 2;

      function sembrarInicial() {
        var d = new Float32Array(SW * SH * 4);
        for (var i = 0; i < SW * SH; i++) {
          d[i*4] = 1; d[i*4+1] = 0; d[i*4+3] = 1;
        }
        // unas pocas semillas: el resto lo hace la química
        for (var s = 0; s < 14; s++) {
          var cx = (Math.random() * 0.7 + 0.15) * SW | 0;
          var cy = (Math.random() * 0.7 + 0.15) * SH | 0;
          for (var y = -5; y <= 5; y++) for (var x = -5; x <= 5; x++) {
            var px = cx + x, py = cy + y;
            if (px < 0 || py < 0 || px >= SW || py >= SH) continue;
            d[(py*SW+px)*4+1] = 1;
          }
        }
        return d;
      }

      function medir(w, h) {
        W = w; H = h;
        // La simulación no necesita la resolución de pantalla: el patrón tiene
        // su propia escala y a resolución nativa tardaría minutos en formarse.
        var esc = Math.min(1, 620 / Math.max(w, h));
        var nw = Math.max(64, Math.floor(w * esc)), nh = Math.max(64, Math.floor(h * esc));
        if (nw === SW && nh === SH) return;
        SW = nw; SH = nh;
        campo = API.pingpong(SW, SH, sembrarInicial(), true);
      }

      return {
        medir: medir,
        dibujar: function (t, dt, m) {
          if (!campo) medir(W, H);
          gl.useProgram(pSim);
          gl.bindVertexArray(API.vaoQuad);
          gl.uniform2f(US.uPaso, 1 / SW, 1 / SH);
          gl.uniform2f(US.uM, m.x, m.y);
          gl.uniform1f(US.uSiembra, m.abajo ? 0.9 : 0.0);
          // f y k derivan lentamente: el sistema recorre sus propios regímenes
          // (coral, mitosis, laberinto) en vez de quedarse en uno.
          gl.uniform1f(US.uF, 0.0545 + 0.0075 * Math.sin(t * 0.045));
          gl.uniform1f(US.uK, 0.0620 + 0.0025 * Math.cos(t * 0.031));
          gl.viewport(0, 0, SW, SH);
          // varios pasos por cuadro: un paso por frame evoluciona demasiado lento
          for (var i = 0; i < 12; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, campo.escribir());
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, campo.leer());
            gl.uniform1i(US.uEstado, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            campo.dar();
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, W, H);
          gl.useProgram(pVer);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, campo.leer());
          gl.uniform1i(UV.uEstado, 0);
          gl.uniform2f(UV.uPaso, 1 / SW, 1 / SH);
          gl.uniform1f(UV.uT, t);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.bindVertexArray(null);
        },
        soltar: function () { gl.deleteProgram(pSim); gl.deleteProgram(pVer); }
      };
    }
  });
})();
