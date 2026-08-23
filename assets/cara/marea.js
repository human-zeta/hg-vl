/* MAREA — fondo vivo de hg-vl.com.
   Es el shader MAREA del laboratorio (Stable Fluids, Stam 1999) portado como
   motor de fondo autónomo: Navier-Stokes resuelto cada cuadro — advección
   semi-lagrangiana + proyección de presión por Jacobi. No es ruido que parece
   líquido: el fluido no se puede comprimir, y si empujás de un lado tiene que
   salir por otro. El puntero empuja; dos inyectores en contrafase lo mantienen
   vivo cuando nadie lo toca.

   Uso:  var ctrl = HGMarea.mount(canvas, opts)
         ctrl = { pause(), resume(), destroy() } — o null si no hay WebGL2
                (el caller conserva su fondo estático de respaldo).
   opts: { mid:[r,g,b],  alto:[r,g,b],  acento:[r,g,b],   — paleta del ramp
           simMax: 480,  jacobi: 18,  dprMax: 1.25,
           ambiente: 1 }                                   — fuerza de inyectores */
(function () {
  'use strict';

  var VS = '#version 300 es\nlayout(location=0) in vec2 a;out vec2 uv;' +
           'void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}';
  var CAB = '#version 300 es\nprecision highp float;\nin vec2 uv;\n';

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
' vec2 m=step(vec2(1.5)*uPaso,uv)*step(uv,1.0-vec2(1.5)*uPaso);',
' o=vec4(v*m.x*m.y,0.0,1.0);}'].join('\n');

  var SPLAT = CAB + [
'out vec4 o;',
'uniform sampler2D uSrc; uniform vec2 uPunto,uAspect; uniform vec3 uVal;',
'uniform float uRadio;',
'void main(){',
' vec2 d=(uv-uPunto)*uAspect;',
' float g=exp(-dot(d,d)/uRadio);',
' o=vec4(texture(uSrc,uv).xyz+uVal*g,1.0);}'].join('\n');

  /* La paleta llega por uniforms para que cada casa entone su agua:
     HG = ramp UMBRAL (violeta→celeste→agua), VL = la misma agua en cyan. */
  var VER = CAB + [
'out vec4 o;',
'uniform sampler2D uTinta,uVel; uniform vec2 uPaso; uniform float uT;',
'uniform vec3 uMid,uAlto,uAcc;',
'const vec3 VOID_C  = vec3(0.010,0.012,0.045);',
'const vec3 WHITE_C = vec3(0.941,0.929,0.902);',
'vec3 ramp(float t){t=clamp(t,0.0,1.0);',
' if(t<0.50) return mix(VOID_C,uMid,smoothstep(0.0,0.50,t));',
' if(t<0.80) return mix(uMid,uAlto,smoothstep(0.50,0.80,t));',
' if(t<0.94) return mix(uAlto,uAcc,smoothstep(0.80,0.94,t));',
' return mix(uAcc,WHITE_C,smoothstep(0.94,1.0,t));}',
'vec3 pelicula(float fase){',
' return 0.5+0.5*cos(6.2832*(vec3(fase)+vec3(0.0,0.33,0.67)));}',
'float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
'void main(){',
' vec3 c=texture(uTinta,uv).rgb;',
' float dens=length(c);',
' float vt=texture(uVel,uv+vec2(0,uPaso.y)).x;',
' float vb=texture(uVel,uv-vec2(0,uPaso.y)).x;',
' float vr=texture(uVel,uv+vec2(uPaso.x,0)).y;',
' float vl=texture(uVel,uv-vec2(uPaso.x,0)).y;',
' float curl=abs((vr-vl)-(vt-vb))*0.5;',
' float fase=c.r*0.9+c.g*0.6+c.b*0.3+curl*2.2+uT*0.02;',
' vec3 film=pelicula(fase);',
' vec3 col=ramp(clamp(dens*1.45,0.0,1.0));',
' col=mix(col, mix(uMid,uAlto,film.g), clamp(curl*9.0,0.0,0.6));',
' col+=uAcc*clamp(curl*6.0,0.0,1.0)*0.35;',
' col*=smoothstep(0.0,0.012,dens);',
' col=col/(1.0+col*0.75);',
' col+=(hash21(gl_FragCoord.xy+fract(uT)*13.7)-0.5)*0.03;',
' o=vec4(max(col,0.0),1.0);}'].join('\n');

  function mount(cv, opts) {
    opts = opts || {};
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    var gl = cv.getContext('webgl2', { antialias: false, alpha: false,
                                       powerPreference: 'high-performance' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    var LINEAL = !!gl.getExtension('OES_texture_float_linear');

    function compilar(tipo, src) {
      var s = gl.createShader(tipo);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('marea:', gl.getShaderInfoLog(s)); return null;
      }
      return s;
    }
    function programa(vs, fs) {
      var v = compilar(gl.VERTEX_SHADER, vs), f = compilar(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      var p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('marea link:', gl.getProgramInfoLog(p)); return null;
      }
      gl.deleteShader(v); gl.deleteShader(f);
      return p;
    }
    function textura(w, h, datos, lineal) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, datos || null);
      var filtro = (lineal && LINEAL) ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function pingpong(w, h, datos, lineal) {
      var a = [textura(w, h, datos, lineal), textura(w, h, datos, lineal)];
      var f = [gl.createFramebuffer(), gl.createFramebuffer()];
      for (var i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, a[i], 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { i: 0,
               leer: function () { return a[this.i]; },
               escribir: function () { return f[1 - this.i]; },
               dar: function () { this.i = 1 - this.i; } };
    }

    var pAdv = programa(VS, ADVECT), pDiv = programa(VS, DIVERG),
        pJac = programa(VS, JACOBI), pGrad = programa(VS, GRADIENTE),
        pSpl = programa(VS, SPLAT), pVer = programa(VS, VER);
    if (!pAdv || !pDiv || !pJac || !pGrad || !pSpl || !pVer) return null;

    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var MID  = opts.mid    || [0.478, 0.184, 1.000];   // violeta UMBRAL
    var ALTO = opts.alto   || [0.247, 0.831, 1.000];   // celeste
    var ACC  = opts.acento || [0.184, 1.000, 0.753];   // verde agua
    var SIM_MAX = opts.simMax || 480;
    var JAC = opts.jacobi || 18;
    var DPR = Math.min(devicePixelRatio || 1, opts.dprMax || 1.25);
    var AMB = (opts.ambiente == null) ? 1 : opts.ambiente;

    var W = 2, H = 2, SW = 0, SH = 0;
    var vel = null, tinta = null, pres = null, divT = null, divF = null;
    var u = function (p, n) { return gl.getUniformLocation(p, n); };

    function medir() {
      var w = Math.max(2, Math.floor(cv.clientWidth  * DPR) || innerWidth  * DPR | 0);
      var h = Math.max(2, Math.floor(cv.clientHeight * DPR) || innerHeight * DPR | 0);
      if (w === W && h === H && vel) return;
      W = w; H = h; cv.width = w; cv.height = h;
      var esc = Math.min(1, SIM_MAX / Math.max(w, h));
      var nw = Math.max(64, Math.floor(w * esc)), nh = Math.max(64, Math.floor(h * esc));
      if (nw === SW && nh === SH && vel) return;
      SW = nw; SH = nh;
      var cero = new Float32Array(SW * SH * 4);
      vel = pingpong(SW, SH, cero, true);
      tinta = pingpong(SW, SH, cero, true);
      pres = pingpong(SW, SH, cero, false);
      divT = textura(SW, SH, cero, false);
      divF = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, divF);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, divT, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      sembrado = false;
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

    /* puntero global: el canvas es fondo fijo, así que pantalla = lienzo */
    var m = { x: .5, y: .5, px: .5, py: .5, vx: 0, vy: 0, abajo: 0 };
    function onMove(e) { m.x = e.clientX / innerWidth; m.y = 1 - e.clientY / innerHeight; }
    function onDown(e) { onMove(e); m.abajo = 1; }
    function onUp() { m.abajo = 0; }
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    addEventListener('pointerup', onUp, { passive: true });

    var sembrado = false, corriendo = true, muerto = false;
    var t0 = performance.now(), ultimo = t0, raf = 0;

    function frame(ahora) {
      if (muerto) return;
      raf = requestAnimationFrame(frame);
      if (!corriendo || document.hidden) { ultimo = ahora; return; }
      var dt = Math.min((ahora - ultimo) / 1000, 0.033); ultimo = ahora;
      var t = (ahora - t0) / 1000;
      m.vx = (m.x - m.px) / Math.max(dt, 1e-3); m.vy = (m.y - m.py) / Math.max(dt, 1e-3);
      m.px = m.x; m.py = m.y;

      medir();
      gl.bindVertexArray(vao);
      var paso = [1 / SW, 1 / SH];

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
      for (var q = 0; q < 2; q++) {
        var fa = t * 0.28 + q * 3.14159;
        var ox = 0.5 + Math.cos(fa) * 0.26, oy = 0.5 + Math.sin(fa * 1.3) * 0.22;
        splat(vel, ox, oy, [-Math.sin(fa) * 4.5 * AMB, Math.cos(fa * 1.3) * 4.5 * AMB, 0], 0.0016);
        var ph = t * 0.4 + q * 2.0;
        splat(tinta, ox, oy,
              [(0.5 + 0.5 * Math.sin(ph)) * 0.022 * AMB,
               (0.5 + 0.5 * Math.sin(ph + 2.1)) * 0.022 * AMB,
               (0.5 + 0.5 * Math.sin(ph + 4.2)) * 0.022 * AMB], 0.0008);
      }

      var vmag = Math.hypot(m.vx, m.vy);
      if (vmag > 0.02 || m.abajo) {
        var k = 7.0 / Math.max(1, vmag);
        splat(vel, m.x, m.y, [m.vx * k, m.vy * k, 0], 0.0011);
        var f = t * 0.35;
        splat(tinta, m.x, m.y,
              [0.18 + 0.12 * Math.sin(f), 0.18 + 0.12 * Math.sin(f + 2.1),
               0.18 + 0.12 * Math.sin(f + 4.2)], 0.0009);
      }

      var dtf = Math.min(dt, 0.022) * 60;

      gl.useProgram(pAdv);
      gl.uniform2f(u(pAdv, 'uPaso'), paso[0], paso[1]);
      gl.uniform1f(u(pAdv, 'uDt'), dtf);
      gl.uniform1f(u(pAdv, 'uDisip'), 0.998);
      tex(0, vel.leer(), pAdv, 'uVel'); tex(1, vel.leer(), pAdv, 'uSrc');
      pasada(pAdv, vel.escribir()); vel.dar();

      gl.useProgram(pDiv);
      gl.uniform2f(u(pDiv, 'uPaso'), paso[0], paso[1]);
      tex(0, vel.leer(), pDiv, 'uVel');
      pasada(pDiv, divF);

      gl.useProgram(pJac);
      gl.uniform2f(u(pJac, 'uPaso'), paso[0], paso[1]);
      for (var i = 0; i < JAC; i++) {
        tex(0, pres.leer(), pJac, 'uPres'); tex(1, divT, pJac, 'uDiv');
        pasada(pJac, pres.escribir()); pres.dar();
      }

      gl.useProgram(pGrad);
      gl.uniform2f(u(pGrad, 'uPaso'), paso[0], paso[1]);
      tex(0, pres.leer(), pGrad, 'uPres'); tex(1, vel.leer(), pGrad, 'uVel');
      pasada(pGrad, vel.escribir()); vel.dar();

      gl.useProgram(pAdv);
      gl.uniform2f(u(pAdv, 'uPaso'), paso[0], paso[1]);
      gl.uniform1f(u(pAdv, 'uDt'), dtf);
      gl.uniform1f(u(pAdv, 'uDisip'), 0.9968);
      tex(0, vel.leer(), pAdv, 'uVel'); tex(1, tinta.leer(), pAdv, 'uSrc');
      pasada(pAdv, tinta.escribir()); tinta.dar();

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(pVer);
      tex(0, tinta.leer(), pVer, 'uTinta'); tex(1, vel.leer(), pVer, 'uVel');
      gl.uniform2f(u(pVer, 'uPaso'), paso[0], paso[1]);
      gl.uniform1f(u(pVer, 'uT'), t);
      gl.uniform3f(u(pVer, 'uMid'), MID[0], MID[1], MID[2]);
      gl.uniform3f(u(pVer, 'uAlto'), ALTO[0], ALTO[1], ALTO[2]);
      gl.uniform3f(u(pVer, 'uAcc'), ACC[0], ACC[1], ACC[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      cv.classList.add('marea-on');
    }

    addEventListener('resize', medir, { passive: true });
    medir();
    raf = requestAnimationFrame(frame);

    return {
      pause: function () { corriendo = false; },
      resume: function () { corriendo = true; },
      destroy: function () {
        muerto = true; cancelAnimationFrame(raf);
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerdown', onDown);
        removeEventListener('pointerup', onUp);
        removeEventListener('resize', medir);
        [pAdv, pDiv, pJac, pGrad, pSpl, pVer].forEach(function (p) { gl.deleteProgram(p); });
      }
    };
  }

  window.HGMarea = { mount: mount };
})();
