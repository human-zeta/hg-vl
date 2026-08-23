/* EL ARNÉS DEL LABORATORIO.
   Cada shader se registra en window.LAB con { id, nombre, tec, desc, crear(gl) }.
   crear() devuelve { dibujar(t, dt, m), medir(w,h), soltar() } y administra sus
   propios programas y framebuffers — el arnés no asume nada sobre la técnica,
   porque acá conviven un raymarcher de un solo paso con un fluido de seis. */
(function () {
  'use strict';

  var cv = document.getElementById('gl');
  var gl = cv.getContext('webgl2', { antialias: false, alpha: false,
                                     powerPreference: 'high-performance' });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
    document.body.insertAdjacentHTML('beforeend',
      '<div class="aviso">Este laboratorio necesita WebGL2 con texturas float.<br>' +
      'Probá en Chrome, Edge o Safari de escritorio.</div>');
    return;
  }
  gl.getExtension('OES_texture_float_linear');

  /* ---- utilidades compartidas ------------------------------------------ */
  var API = {
    gl: gl,
    /* Triángulo cubre-pantalla: un solo triángulo gigante en vez de dos
       triángulos de un quad. Evita la costura diagonal donde el rasterizador
       divide el quad y ahorra un vértice. */
    QUAD_VS: '#version 300 es\nin vec2 a;out vec2 uv;' +
             'void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}',
    compilar: function (tipo, src) {
      var s = gl.createShader(tipo);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('shader:', gl.getShaderInfoLog(s), '\n', numerar(src));
        return null;
      }
      return s;
    },
    programa: function (vs, fs) {
      var v = API.compilar(gl.VERTEX_SHADER, vs), f = API.compilar(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      var p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('link:', gl.getProgramInfoLog(p)); return null;
      }
      gl.deleteShader(v); gl.deleteShader(f);
      return p;
    },
    /* VAO del triángulo, compartido: todos los shaders dibujan sobre él */
    vaoQuad: null,
    /* textura de datos; f=true para float32 (simulaciones) */
    textura: function (w, h, datos, flotante, lineal) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (flotante) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, datos || null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, datos || null);
      var filtro = lineal ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    },
    /* par ping-pong: leer de uno, escribir en el otro, dar vuelta */
    pingpong: function (w, h, datos, lineal) {
      var a = [API.textura(w, h, datos, true, lineal), API.textura(w, h, datos, true, lineal)];
      var f = [gl.createFramebuffer(), gl.createFramebuffer()];
      for (var i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, a[i], 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex: a, fbo: f, i: 0,
               leer: function () { return a[this.i]; },
               escribir: function () { return f[1 - this.i]; },
               dar: function () { this.i = 1 - this.i; } };
    },
    /* la paleta de la casa, en GLSL, para que las cinco piezas se reconozcan */
    PALETA: [
'const vec3 VOID_C    = vec3(0.010,0.012,0.045);',
'const vec3 VIOLET_C  = vec3(0.478,0.184,1.000);',
'const vec3 CELESTE_C = vec3(0.247,0.831,1.000);',
'const vec3 AGUA_C    = vec3(0.184,1.000,0.753);',
'const vec3 ACID_C    = vec3(0.722,1.000,0.000);',
'const vec3 GLITCH_C  = vec3(1.000,0.176,0.333);',
'const vec3 WHITE_C   = vec3(0.941,0.929,0.902);',
'vec3 hgRamp(float t){t=clamp(t,0.0,1.0);',
' if(t<0.50) return mix(VOID_C,VIOLET_C,smoothstep(0.0,0.50,t));',
' if(t<0.80) return mix(VIOLET_C,CELESTE_C,smoothstep(0.50,0.80,t));',
' if(t<0.94) return mix(CELESTE_C,AGUA_C,smoothstep(0.80,0.94,t));',
' return mix(AGUA_C,WHITE_C,smoothstep(0.94,1.0,t));}',
/* Película delgada: el gesto de UMBRAL. Cada canal muestrea la interferencia
   con un desfase distinto, y eso ES la dispersión cromática. */
'vec3 pelicula(float fase){',
' return 0.5+0.5*cos(6.2832*(vec3(fase)+vec3(0.0,0.33,0.67)));}'
    ].join('\n'),
    RUIDO: [
'float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
' float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));',
' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p=p*2.03+vec2(17.3,9.1);a*=0.5;}return v;}',
'float hash13(vec3 p){p=fract(p*0.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}'
    ].join('\n')
  };

  function numerar(src) {
    return src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n');
  }

  // VAO del triángulo cubre-pantalla
  (function () {
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    API.vaoQuad = vao;
  })();
  // los shaders del lab declaran `layout(location=0) in vec2 a;`
  API.dibujarQuad = function () {
    gl.bindVertexArray(API.vaoQuad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  window.LAB_API = API;

  /* ---- estado ----------------------------------------------------------- */
  var DPR = Math.min(devicePixelRatio || 1, 1.5);
  var W = 2, H = 2;
  var m = { x: .5, y: .5, px: .5, py: .5, vx: 0, vy: 0, abajo: 0, pulso: 0, t: 0 };
  var actual = null, actualDef = null;
  var lista = window.LAB || [];

  function medir() {
    var w = Math.max(2, Math.floor(innerWidth * DPR));
    var h = Math.max(2, Math.floor(innerHeight * DPR));
    if (w === W && h === H) return;
    W = w; H = h; cv.width = w; cv.height = h;
    document.getElementById('res').textContent = w + '×' + h + ' · dpr ' + DPR;
    if (actual && actual.medir) actual.medir(W, H);
  }
  addEventListener('resize', medir);

  addEventListener('pointermove', function (e) {
    m.x = e.clientX / innerWidth; m.y = 1 - e.clientY / innerHeight;
  }, { passive: true });
  addEventListener('pointerdown', function (e) {
    m.x = e.clientX / innerWidth; m.y = 1 - e.clientY / innerHeight;
    m.abajo = 1; m.pulso = 1;
  }, { passive: true });
  addEventListener('pointerup', function () { m.abajo = 0; }, { passive: true });

  function cargar(def) {
    if (actual && actual.soltar) actual.soltar();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    actual = null; actualDef = def;
    document.getElementById('nombre').textContent = def.nombre;
    document.getElementById('tec').textContent = def.tec;
    document.getElementById('desc').textContent = def.desc;
    [].forEach.call(document.querySelectorAll('#barra button'), function (b) {
      b.setAttribute('aria-current', String(b.dataset.id === def.id));
    });
    try { actual = def.crear(API); } catch (e) { console.error(def.id, e); }
    if (actual && actual.medir) actual.medir(W, H);
    try { history.replaceState(null, '', '#' + def.id); } catch (e) {}
  }

  // botones
  var barra = document.getElementById('barra');
  lista.forEach(function (def, i) {
    var b = document.createElement('button');
    b.textContent = (i + 1) + ' · ' + def.nombre;
    b.dataset.id = def.id;
    b.addEventListener('click', function () { cargar(def); });
    barra.appendChild(b);
  });
  addEventListener('keydown', function (e) {
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= lista.length) cargar(lista[n - 1]);
  });

  /* ---- loop -------------------------------------------------------------- */
  var t0 = performance.now(), ultimo = t0, cuadros = 0, ventana = t0;
  function frame(ahora) {
    var dt = Math.min((ahora - ultimo) / 1000, 0.033); ultimo = ahora;
    var t = (ahora - t0) / 1000;
    m.vx = (m.x - m.px) / Math.max(dt, 1e-3); m.vy = (m.y - m.py) / Math.max(dt, 1e-3);
    m.px = m.x; m.py = m.y; m.t = t;
    medir();
    if (actual && actual.dibujar) {
      try { actual.dibujar(t, dt, m); }
      catch (e) { console.error(actualDef && actualDef.id, e); actual = null; }
    }
    m.pulso *= 0.90;
    cuadros++;
    if (ahora - ventana >= 1000) {
      document.getElementById('fps').textContent = cuadros + ' FPS';
      cuadros = 0; ventana = ahora;
    }
    requestAnimationFrame(frame);
  }

  medir();
  var pedido = (location.hash || '').slice(1);
  cargar(lista.filter(function (d) { return d.id === pedido; })[0] || lista[0]);
  requestAnimationFrame(frame);
})();
