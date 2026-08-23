/* LA CREDENCIAL — el login de labs.hg-vl.com traído a la llegada.
   Credencial de operador colgante: péndulo con resorte hacia el puntero y
   shader holo-térmico del logo Z (dispersión por canal, mismo material que
   la acreditación de ZETA LABS), retonado a la tríada violeta/celeste/agua
   del sol. El humo conserva el verde ácido: es la firma de LABS. */
(function () {
  'use strict';

  /* La ruta de este archivo, para que los assets hermanos se resuelvan igual
     estén donde estén montados: en la raíz del sitio o en /puerta/. Con rutas
     relativas al documento, un index.html en la raíz iría a buscarlos a
     /assets/ — que en hg-vl ya existe y es otra cosa. */
  var BASE = (function () {
    var s = document.currentScript;
    if (!s) { var a = document.getElementsByTagName('script'); s = a[a.length - 1]; }
    return (s && s.src) ? s.src.replace(/[^/]*$/, '') : '';
  })();

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* reloj de acceso (labs: "Acceso restringido · HH:MM:SS") */
  var ck = document.getElementById('hgClock');
  if (ck) {
    var tick = function () {
      ck.textContent = new Date().toLocaleTimeString('es-AR', { hour12: false });
    };
    tick(); setInterval(tick, 1000);
  }

  var hang = document.getElementById('acHang');
  var badge = document.getElementById('acBadge');
  var cv = document.getElementById('acGL');
  if (!hang || !badge || !cv) return;

  var gl = cv.getContext('webgl', { antialias: true, alpha: false });
  var glOK = false, prog = null, quad = null, logoTex = null, CW = 2, CH = 2;

  if (gl) {
    var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var FS = [
'precision highp float;',
'uniform vec2 uRes;uniform float uT;uniform vec2 uTilt;uniform sampler2D uLogo;',
'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
' float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));',
' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+13.7;a*=.5;}return v;}',
/* térmica HG: vacío → violeta → celeste → agua → blanco (la del sol) */
'vec3 thermal(float x){',
' x=clamp(x,0.,1.);',
' vec3 c1=vec3(0.02,0.02,0.16), c2=vec3(0.30,0.12,0.85), c3=vec3(0.478,0.184,1.0),',
'      c4=vec3(0.247,0.831,1.0), c5=vec3(0.184,1.0,0.753), c6=vec3(0.94,0.98,0.95);',
' vec3 c=mix(c1,c2,smoothstep(0.00,0.24,x));',
' c=mix(c,c3,smoothstep(0.24,0.44,x));',
' c=mix(c,c4,smoothstep(0.44,0.64,x));',
' c=mix(c,c5,smoothstep(0.64,0.84,x));',
' c=mix(c,c6,smoothstep(0.84,1.0,x));',
' return c;}',
'void main(){',
' vec2 uv=gl_FragCoord.xy/uRes;',
' float asp=uRes.x/uRes.y;',
' vec2 p=(uv-0.5)*vec2(asp,1.0);',
' float t=uT;',
' vec2 q=vec2(fbm(p*2.1+t*0.10+uTilt*0.55), fbm(p*2.1-t*0.085-uTilt.yx*0.4));',
' float f=fbm(p*2.4+q*2.2);',
' float heat=f*1.18+0.04+uTilt.x*0.26-uTilt.y*0.10;',
' vec3 col=thermal(heat);',
' float s=fbm(p*1.9+vec2(-t*0.16,t*0.03)+q*1.5);',
' float smoke=smoothstep(0.52,0.86,s);',
' vec3 smokeCol=mix(vec3(0.0,0.85,0.78),vec3(0.55,1.0,0.10),fbm(p*3.0+t*0.1));',
' col=mix(col,smokeCol,smoke*0.62);',
' vec2 lp=p/0.42+vec2(0.5,0.55);',
' vec2 par=uTilt*0.045;',
/* dispersión del logo: cada canal muestrea la textura DESFASADO */
' float aR=texture2D(uLogo,lp+par*1.7).a;',
' float aG=texture2D(uLogo,lp+par*0.85).a;',
' float aB=texture2D(uLogo,lp).a;',
' float aC=(aR+aG+aB)/3.0;',
' vec3 hot=thermal(clamp(1.35-heat*1.15,0.,1.));',
' hot=mix(hot,hot*hot*1.6,0.35);',
' col=mix(col,hot,min(1.0,aC*1.15));',
' col+=vec3(aR-aB,aG-aC,aB-aR)*0.85;',
' float rim=aC*(1.0-aC)*4.0;',
' col+=vec3(1.0,0.98,0.9)*rim*rim*0.85;',
' float bnd=sin((uv.x+uv.y)*70.0 - t*1.5 + uTilt.x*9.0);',
' col+=(0.5+0.5*cos(bnd*3.0+vec3(0.,2.1,4.2)))*smoothstep(0.955,1.0,bnd)*(0.16+0.22*abs(uTilt.x));',
' col*=0.95+0.05*sin(uv.y*uRes.y*3.1416);',
' float d=length((uv-0.5)*vec2(1.6,1.25));',
' col*=1.0-0.40*smoothstep(0.5,1.05,d);',
' gl_FragColor=vec4(col,1.0);}'].join('\n');

    var sh = function (t, src) {
      var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      logoTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, logoTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var im = new Image();
      im.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, logoTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        glOK = true; badge.classList.add('gl-on');
      };
      im.src = BASE + 'z-logo.png';
    }
  }

  function sizeGL() {
    var d = Math.min(devicePixelRatio || 1, 2);
    CW = Math.max(2, Math.round(cv.clientWidth * d));
    CH = Math.max(2, Math.round(cv.clientHeight * d));
    cv.width = CW; cv.height = CH;
  }
  if (gl) { sizeGL(); if (window.ResizeObserver) new ResizeObserver(sizeGL).observe(cv); }

  /* péndulo: la credencial cuelga y se hamaca hacia el puntero */
  var ang = 0, vel = 0, tx = 0, ty = 0, t0 = performance.now(), running = false, visible = false;
  addEventListener('pointermove', function (e) {
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    var t = (now - t0) / 1000;
    if (!reduced) {
      var target = tx * 0.16 + Math.sin(t * 0.7) * 0.035;
      var acc = (target - ang) * 8.0 - vel * 3.2;
      vel += acc * 0.016; ang += vel * 0.016;
      hang.style.transform = 'rotate(' + (ang * 57.2958) + 'deg)';
    }
    if (glOK) {
      gl.viewport(0, 0, CW, CH);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      var la = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, logoTex);
      gl.uniform1i(gl.getUniformLocation(prog, 'uLogo'), 0);
      gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), CW, CH);
      gl.uniform1f(gl.getUniformLocation(prog, 'uT'), reduced ? 0 : t);
      gl.uniform2f(gl.getUniformLocation(prog, 'uTilt'), ang * 3.2 + tx * 0.3, ty * 0.6);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (reduced) { running = false; return; } // un cuadro basta
    requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; sizeGL(); requestAnimationFrame(frame); }

  /* corre solo cuando la credencial está a la vista */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) start();
    }, { rootMargin: '120px' }).observe(hang);
  } else { visible = true; start(); }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && visible) start();
  });
})();
