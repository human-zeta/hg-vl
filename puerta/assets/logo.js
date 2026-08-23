/* EL LOGO Z EN VIDRIO LÍQUIDO — el título de la entrada.
   La malla real del owner (z.gltf, C4D, 38.484 vértices) renderizada como
   vidrio: refracción en espacio de pantalla con DISPERSIÓN CROMÁTICA (cada
   canal con su índice de refracción) sobre una copia del mundo que hay detrás,
   normal perturbada por ruido animado para que el vidrio fluya como líquido,
   fresnel en los bordes y specular duro.

   Lo que refracta es el sol: el logo abre un agujero en la interfaz y por ahí
   se ve el mundo que la plate tapa. Es la tesis del sitio hecha material.

   Si la malla no carga, el <h1> de texto vuelve a mostrarse — la página nunca
   se queda sin título. */
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
  var cv = document.getElementById('zlogo');
  var wrap = document.getElementById('zwrap');
  if (!cv || !wrap) return;

  var root = document.documentElement;
  function fallback() { root.classList.remove('zlogo-on'); } // el título vuelve a ser texto

  var gl = cv.getContext('webgl2', {
    antialias: true, alpha: true, premultipliedAlpha: false, depth: true
  });
  if (!gl) return;                            // sin WebGL2 el h1 nunca se esconde
  root.classList.add('zlogo-on');

  function sh(t, src) {
    var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn('zlogo:', gl.getShaderInfoLog(o)); return null; }
    return o;
  }

  var VS = [
'#version 300 es',
'precision highp float;',
'in vec3 aP;in vec3 aN;',
'uniform mat3 uRot;uniform float uScale,uAspect;',
'out vec3 vN;out vec3 vV;out vec3 vP;',
'const float F=2.7;',
'void main(){',
' vec3 p=uRot*(aP*uScale);',
' vP=p;',
' vN=normalize(uRot*aN);',
' vec3 pv=p-vec3(0.0,0.0,3.0);',      // cámara en +z mirando -z
' vV=normalize(-pv);',
' float near=0.1,far=20.0;',
' float zc=((far+near)/(near-far))*pv.z+(2.0*far*near)/(near-far);',
' gl_Position=vec4(p.x*F/uAspect,p.y*F,zc,-pv.z);}'].join('\n');

  var FS = [
'#version 300 es',
'precision highp float;',
'in vec3 vN;in vec3 vV;in vec3 vP;out vec4 o;',
'uniform sampler2D uBg;',
'uniform vec2 uOrigin,uViewport;',
'uniform float uDPR,uTime,uIntro,uReduce;',
'const vec3 VIOLET_C=vec3(0.478,0.184,1.000);',
'const vec3 CELESTE_C=vec3(0.247,0.831,1.000);',
'const vec3 AGUA_C=vec3(0.184,1.000,0.753);',
'float h31(vec3 p){p=fract(p*0.3183099+vec3(0.1,0.2,0.3));p*=17.0;',
' return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
'float n31(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);',
' return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),',
'            mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}',
'void main(){',
' float t=uReduce>0.5?0.0:uTime;',
/* el líquido: la normal ondula, así la refracción respira */
' vec3 q=vP*3.6+vec3(0.0,-t*0.30,t*0.16);',
' vec3 rip=vec3(n31(q),n31(q+31.4),n31(q+57.7))-0.5;',
' vec3 N=normalize(vN+rip*0.40);',
' vec3 V=normalize(vV);',
' float ndv=clamp(dot(N,V),0.0,1.0);',
' float fres=pow(1.0-ndv,2.6);',
/* uv del fondo real de la página bajo este fragmento */
' vec2 uv=(uOrigin+gl_FragCoord.xy/uDPR)/uViewport;',
' float thick=0.55+0.45*(1.0-ndv);',
/* dispersión: un índice por canal — el vidrio parte la luz */
' vec2 rR=refract(-V,N,1.0/1.41).xy;',
' vec2 rG=refract(-V,N,1.0/1.47).xy;',
' vec2 rB=refract(-V,N,1.0/1.54).xy;',
' float k=0.052*thick;',
' vec3 bg=vec3(texture(uBg,uv+rR*k).r,',
'              texture(uBg,uv+rG*k).g,',
'              texture(uBg,uv+rB*k).b);',
/* el vidrio tiñe lo que pasa por él y espesa con el recorrido */
' vec3 tint=mix(CELESTE_C,VIOLET_C,0.5+0.5*sin(vP.y*2.2+t*0.25));',
' vec3 col=bg*(1.35+1.5*ndv)+bg*tint*0.9*thick;',
/* Entorno sintético. En la órbita exterior el mundo es casi negro y no hay
   nada que refractar: sin esto el vidrio sería obsidiana. El reflejo le da
   cuerpo — cielo violeta arriba, agua abajo, celeste en el horizonte. */
' vec3 L=normalize(vec3(-0.42,0.62,0.75));',
' vec3 R=reflect(-V,N);',
' float up=R.y*0.5+0.5;',
' vec3 env=mix(AGUA_C*0.30,VIOLET_C*0.62,up);',
' env=mix(env,CELESTE_C*0.75,pow(1.0-abs(R.y),3.0)*0.7);',
' env+=vec3(1.0,0.99,0.96)*pow(max(dot(R,L),0.0),80.0)*1.6;',
' col+=env*(0.30+fres*1.35);',
/* interferencia interna: la película delgada de UMBRAL, otra vez */
' float film=fract(ndv*1.9+vP.y*0.8+vP.x*0.35+t*0.05);',
' vec3 iri=0.5+0.5*cos(6.2832*(vec3(film)+vec3(0.0,0.33,0.67)));',
' col+=mix(VIOLET_C,AGUA_C,iri)*fres*0.85;',
/* borde y brillo */
' float spec=pow(max(dot(reflect(-L,N),V),0.0),48.0);',
' col+=vec3(1.0,0.99,0.96)*spec*1.5;',
' col+=CELESTE_C*fres*fres*1.15;',
' col=col/(1.0+col*0.55);',
' o=vec4(col*uIntro,uIntro);}'].join('\n');

  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { fallback(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('zlogo link:', gl.getProgramInfoLog(prog)); fallback(); return;
  }

  /* ── el fondo a refractar: copia chica del canvas del mundo ───────────── */
  var BW = 384, BH = 240;
  var bgCv = document.createElement('canvas'); bgCv.width = BW; bgCv.height = BH;
  var bgCtx = bgCv.getContext('2d');
  var stage = document.getElementById('stage');
  var bgTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, bgTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8,8,20,255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  var lastGrab = -1;
  function grabBg(ms) {
    // 24 fps alcanza: la refracción va desenfocada y ondulando igual
    if (ms - lastGrab < 41) return;
    lastGrab = ms;
    if (!stage || !stage.width) return;
    // Solo el sol. La materia se compone por CSS encima de este canvas, así
    // que no está en su buffer; el entorno sintético del shader es lo que le
    // da cuerpo al vidrio cuando el mundo todavía está oscuro.
    try { bgCtx.drawImage(stage, 0, 0, BW, BH); } catch (e) { return; }
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /* ── parser GLTF mínimo (buffer embebido, soporta byteStride) ─────────── */
  function loadZ() {
    return fetch(BASE + 'z.gltf').then(function (r) { return r.json(); }).then(function (g) {
      var b64 = g.buffers[0].uri.split(',')[1];
      var bin = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); }).buffer;
      var dv = new DataView(bin);
      function acc(i) {
        var a = g.accessors[i], bv = g.bufferViews[a.bufferView];
        var comps = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
        var isF = a.componentType === 5126, isU32 = a.componentType === 5125;
        var bytes = (isF || isU32) ? 4 : 2;
        var stride = bv.byteStride || comps * bytes;
        var T = isF ? Float32Array : (isU32 ? Uint32Array : Uint16Array);
        var out = new T(a.count * comps);
        var off = (bv.byteOffset || 0) + (a.byteOffset || 0);
        for (var k = 0; k < a.count; k++) {
          for (var c = 0; c < comps; c++) {
            out[k*comps+c] = isF ? dv.getFloat32(off+c*4, true)
                                 : (isU32 ? dv.getUint32(off+c*4, true) : dv.getUint16(off+c*2, true));
          }
          off += stride;
        }
        return out;
      }
      var pr = g.meshes[0].primitives[0];
      var acP = g.accessors[pr.attributes.POSITION];
      var pos = acc(pr.attributes.POSITION), nor = acc(pr.attributes.NORMAL), idx = acc(pr.indices);
      var cx = (acP.min[0]+acP.max[0])/2, cy = (acP.min[1]+acP.max[1])/2, cz = (acP.min[2]+acP.max[2])/2;
      var sc = 2/Math.max(acP.max[0]-acP.min[0], acP.max[1]-acP.min[1], acP.max[2]-acP.min[2]);
      for (var i = 0; i < pos.length; i += 3) {
        pos[i]=(pos[i]-cx)*sc; pos[i+1]=(pos[i+1]-cy)*sc; pos[i+2]=(pos[i+2]-cz)*sc;
      }
      return { pos: pos, nor: nor, idx: idx };
    });
  }

  var mesh = null;
  loadZ().then(function (m) {
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW);
    var lp = gl.getAttribLocation(prog, 'aP');
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0);
    var nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb);
    gl.bufferData(gl.ARRAY_BUFFER, m.nor, gl.STATIC_DRAW);
    var ln = gl.getAttribLocation(prog, 'aN');
    gl.enableVertexAttribArray(ln); gl.vertexAttribPointer(ln, 3, gl.FLOAT, false, 0, 0);
    var eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    mesh = { vao: vao, count: m.idx.length,
             type: (m.idx instanceof Uint32Array) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
    wrap.classList.add('on');
    start();
  }).catch(function (e) {
    console.warn('zlogo: no se pudo cargar z.gltf —', e.message); fallback();
  });

  /* ── loop ─────────────────────────────────────────────────────────────── */
  var U = function (n) { return gl.getUniformLocation(prog, n); };
  var DPR = Math.min(devicePixelRatio || 1, 2);
  var CW = 2, CH = 2, aspect = 1;
  function resize() {
    var w = Math.max(2, Math.round(cv.clientWidth * DPR));
    var h = Math.max(2, Math.round(cv.clientHeight * DPR));
    if (w !== CW || h !== CH) { CW = w; CH = h; cv.width = w; cv.height = h; }
    aspect = CW / CH;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
  addEventListener('resize', resize);

  var px = 0, py = 0, tpx = 0, tpy = 0;
  addEventListener('pointermove', function (e) {
    tpx = (e.clientX/innerWidth)*2-1; tpy = (e.clientY/innerHeight)*2-1;
  }, { passive: true });

  function rotM(yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    return new Float32Array([cy,0,-sy, sy*sx,cx,cy*sx, sy*cx,-sx,cy*cx]);
  }
  function scrollProg() {
    var sc = document.scrollingElement, m = sc.scrollHeight - innerHeight;
    return m > 0 ? sc.scrollTop / m : 0;
  }

  var t0 = performance.now(), running = false, visible = false;
  function frame(now) {
    if (!running) return;
    if (!visible || document.hidden) { running = false; return; }
    var t = (now - t0) / 1000;
    var intro = reduced ? 1 : Math.min(1, Math.max(0, (t - 0.15) / 1.6));
    intro = intro*intro*(3-2*intro);
    px += (tpx-px)*0.06; py += (tpy-py)*0.06;

    resize();
    grabBg(now);

    var r = cv.getBoundingClientRect();
    gl.viewport(0, 0, CW, CH);
    gl.clearColor(0,0,0,0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (mesh) {
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(prog); gl.bindVertexArray(mesh.vao);
      var yaw = (reduced ? 0.4 : t*0.22) + px*0.55 + scrollProg()*3.4;
      var pitch = (reduced ? 0.12 : Math.sin(t*0.19)*0.11) + py*0.28;
      gl.uniformMatrix3fv(U('uRot'), false, rotM(yaw, pitch));
      gl.uniform1f(U('uScale'), 0.86);
      gl.uniform1f(U('uAspect'), aspect);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bgTex);
      gl.uniform1i(U('uBg'), 0);
      // origen del canvas en el viewport, con y de abajo hacia arriba
      gl.uniform2f(U('uOrigin'), r.left, innerHeight - r.top - r.height);
      gl.uniform2f(U('uViewport'), innerWidth, innerHeight);
      gl.uniform1f(U('uDPR'), DPR);
      gl.uniform1f(U('uTime'), t);
      gl.uniform1f(U('uIntro'), intro);
      gl.uniform1f(U('uReduce'), reduced ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
      gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST);
    }
    if (reduced && intro >= 1) { running = false; return; }  // un cuadro basta
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || !mesh) return;
    running = true; resize(); requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) start();
    }, { rootMargin: '200px' }).observe(cv);
  } else { visible = true; start(); }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && visible) start();
  });
})();
