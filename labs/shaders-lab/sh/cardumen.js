/* CARDUMEN — bandada de boids resuelta en la GPU.
   Tres reglas de Reynolds (separación, alineación, cohesión) y nada más: no
   hay coreografía, no hay ruido guiando el movimiento. Cada agente mira a
   TODOS los demás — O(N²) dentro del fragment shader — y de esa suma sale un
   comportamiento que nadie programó. La materia de UMBRAL flota sin saber que
   existen las otras partículas; esta se entera, y por eso se comporta como
   algo vivo en vez de como polvo.
   El truco visual es el búfer de estelas: los agentes se dibujan sobre lo que
   quedó del cuadro anterior atenuado, así mil bichos alcanzan para leer un
   cardumen entero. */
(function () {
  var VS = '#version 300 es\nlayout(location=0) in vec2 a;out vec2 uv;' +
           'void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}';

  /* Un texel = un agente. RG guarda la posición, BA la velocidad. */
  var SIM = [
'#version 300 es',
'precision highp float;',
'in vec2 uv; out vec4 o;',
'uniform sampler2D uEstado; uniform vec2 uLado;',
'uniform float uDt,uT,uAspect; uniform vec3 uM;',
'void main(){',
' vec4 s=texture(uEstado,uv);',
' vec2 p=s.xy, v=s.zw;',
' vec2 sep=vec2(0.0), ali=vec2(0.0), coh=vec2(0.0);',
' float nSep=0.0, nVec=0.0;',
' int N=int(uLado.x*uLado.y);',
/* El barrido completo. Con mil agentes son un millón de lecturas por cuadro:
   caro, pero es lo único que da vecindario exacto sin estructura espacial. */
' for(int i=0;i<N;i++){',
'  ivec2 c=ivec2(i%int(uLado.x), i/int(uLado.x));',
'  vec4 q=texelFetch(uEstado,c,0);',
'  vec2 d=q.xy-p;',
'  d.x*=uAspect;',
'  float r=length(d);',
'  if(r>0.0001 && r<0.058){ sep-=normalize(d)*(0.058-r); nSep+=1.0; }',
'  if(r>0.0001 && r<0.150){ ali+=q.zw; coh+=q.xy; nVec+=1.0; }',
' }',
' vec2 acc=vec2(0.0);',
' if(nSep>0.0) acc+=sep/nSep*11.0;',
' if(nVec>0.0){',
'  acc+=(ali/nVec-v)*1.05;',                    // alineación
'  vec2 centro=coh/nVec; vec2 hacia=centro-p; hacia.x*=uAspect;',
'  acc+=hacia*0.80;',                            // cohesión
' }',
/* El puntero es un depredador: lo esquivan, y con el click empuja fuerte. */
' vec2 dm=p-uM.xy; dm.x*=uAspect;',
' float rm=length(dm);',
' if(rm<0.28) acc+=normalize(dm+1e-5)*(0.28-rm)*(3.2+14.0*uM.z);',
/* Contención suave: una pecera circular en vez de bordes duros. */
' vec2 c2=p-vec2(0.5); c2.x*=uAspect;',
' float rc=length(c2);',
' if(rc>0.34) acc-=normalize(c2)*(rc-0.34)*16.0;',
' v+=acc*uDt;',
/* Techo y piso de velocidad: sin el piso la bandada se congela, sin el techo
   se dispara y se va de la pecera. */
' float sp=length(v);',
' if(sp>0.26) v*=0.26/sp;',
' if(sp<0.10) v*=(sp>0.0001)?0.10/sp:0.0;',
' p+=v*uDt*vec2(1.0/uAspect,1.0);',
' o=vec4(p,v);}'
  ].join('\n');

  /* Dibujo: un punto por agente, aditivo sobre el búfer de estelas. */
  var PUNTO_VS = [
'#version 300 es',
'precision highp float;',
'layout(location=0) in float aIdx;',
'uniform sampler2D uEstado; uniform vec2 uLado; uniform float uDPR;',
'out vec3 vCol; out float vSp;',
'void main(){',
' ivec2 c=ivec2(int(aIdx)%int(uLado.x), int(aIdx)/int(uLado.x));',
' vec4 s=texelFetch(uEstado,c,0);',
' gl_Position=vec4(s.xy*2.0-1.0,0.0,1.0);',
' float sp=length(s.zw);',
' vSp=sp;',
' gl_PointSize=uDPR*(2.2+sp*5.0);',
/* El color lo decide la dirección: la bandada se pinta sola según hacia
   dónde va, así los frentes que giran juntos comparten tono. */
' float ang=atan(s.w,s.z);',
' vCol=0.5+0.5*cos(ang+vec3(0.0,2.1,4.2));}'
  ].join('\n');

  var PUNTO_FS = [
'#version 300 es',
'precision highp float;',
'in vec3 vCol; in float vSp; out vec4 o;',
'void main(){',
' vec2 d=(gl_PointCoord-0.5)*2.0;',
' float r2=dot(d,d); if(r2>1.0) discard;',
' float a=smoothstep(1.0,0.0,r2);',
' o=vec4(vCol*(0.35+vSp*1.5)*a, a);}'
  ].join('\n');

  var FADE = [
'#version 300 es','precision highp float;','in vec2 uv; out vec4 o;',
'uniform sampler2D uSrc; uniform float uFade;',
'void main(){ o=vec4(texture(uSrc,uv).rgb*uFade,1.0); }'
  ].join('\n');

  var VER = function (P, R) { return [
'#version 300 es','precision highp float;','in vec2 uv; out vec4 o;',
'uniform sampler2D uEstelas; uniform float uT;',
P, R,
'void main(){',
' vec3 e=texture(uEstelas,uv).rgb;',
' float i=length(e);',
/* Las estelas traen su propio matiz; la paleta de la casa lo reencuadra y la
   película delgada le pone el filo iridiscente en las crestas. */
' vec3 col=hgRamp(clamp(i*1.25,0.0,1.0))*0.85;',
' vec3 film=pelicula(i*1.6+e.r*0.7+uT*0.02);',
' col=mix(col, mix(CELESTE_C,AGUA_C,film.g), clamp(i*1.5,0.0,0.55));',
' col+=WHITE_C*pow(clamp(i-0.55,0.0,1.0),2.0)*1.1;',
' col=col/(1.0+col*0.8);',
' col+=(hash21(gl_FragCoord.xy+fract(uT)*31.3)-0.5)*0.028;',
' o=vec4(max(col,0.0),1.0);}'].join('\n'); };

  (window.LAB = window.LAB || []).push({
    id: 'cardumen',
    nombre: 'CARDUMEN',
    tec: 'Boids de Reynolds · O(N²) en fragment shader · búfer de estelas',
    desc: 'Tres reglas y nada más: separate, align, cohere. Cada agente mira a ' +
          'los otros mil y de esa suma sale un comportamiento que nadie escribió. ' +
          'El puntero es un depredador. Las estelas se acumulan cuadro a cuadro, ' +
          'así mil bichos alcanzan para leer un cardumen entero.',
    crear: function (API) {
      var gl = API.gl;
      var pSim = API.programa(VS, SIM);
      var pPto = API.programa(PUNTO_VS, PUNTO_FS);
      var pFade = API.programa(VS, FADE);
      var pVer = API.programa(VS, VER(API.PALETA, API.RUIDO));
      if (!pSim || !pPto || !pFade || !pVer) return null;

      var LADO = 32, N = LADO * LADO;          // 1024 agentes
      var inicial = new Float32Array(N * 4);
      for (var i = 0; i < N; i++) {
        var a = Math.random() * 6.2831, r = Math.sqrt(Math.random()) * 0.14;
        inicial[i*4]   = 0.5 + Math.cos(a) * r;
        inicial[i*4+1] = 0.5 + Math.sin(a) * r;
        var av = Math.random() * 6.2831;
        inicial[i*4+2] = Math.cos(av) * 0.14;
        inicial[i*4+3] = Math.sin(av) * 0.14;
      }
      var estado = API.pingpong(LADO, LADO, inicial, false);

      // atributo de índice para los puntos
      var vaoPtos = gl.createVertexArray(); gl.bindVertexArray(vaoPtos);
      var idx = new Float32Array(N); for (var k = 0; k < N; k++) idx[k] = k;
      var bIdx = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bIdx);
      gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      var W = 2, H = 2, TW = 0, TH = 0, estelas = null;
      var u = function (p, n) { return gl.getUniformLocation(p, n); };

      function medir(w, h) {
        W = w; H = h;
        var esc = Math.min(1, 900 / Math.max(w, h));
        var nw = Math.max(64, Math.floor(w * esc)), nh = Math.max(64, Math.floor(h * esc));
        if (nw === TW && nh === TH) return;
        TW = nw; TH = nh;
        estelas = API.pingpong(TW, TH, new Float32Array(TW * TH * 4), true);
      }

      return {
        medir: medir,
        dibujar: function (t, dt, m) {
          if (!estelas) medir(W, H);
          var asp = W / H;

          // 1 · un paso de la bandada
          gl.bindVertexArray(API.vaoQuad);
          gl.useProgram(pSim);
          gl.bindFramebuffer(gl.FRAMEBUFFER, estado.escribir());
          gl.viewport(0, 0, LADO, LADO);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, estado.leer());
          gl.uniform1i(u(pSim, 'uEstado'), 0);
          gl.uniform2f(u(pSim, 'uLado'), LADO, LADO);
          gl.uniform1f(u(pSim, 'uDt'), Math.min(dt, 0.03));
          gl.uniform1f(u(pSim, 'uT'), t);
          gl.uniform1f(u(pSim, 'uAspect'), asp);
          gl.uniform3f(u(pSim, 'uM'), m.x, m.y, m.abajo);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          estado.dar();

          // 2 · atenuar las estelas del cuadro anterior
          gl.useProgram(pFade);
          gl.bindFramebuffer(gl.FRAMEBUFFER, estelas.escribir());
          gl.viewport(0, 0, TW, TH);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, estelas.leer());
          gl.uniform1i(u(pFade, 'uSrc'), 0);
          gl.uniform1f(u(pFade, 'uFade'), 0.930);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          estelas.dar();

          // 3 · estampar los agentes encima, aditivo
          gl.bindFramebuffer(gl.FRAMEBUFFER, estelas.escribir());
          gl.viewport(0, 0, TW, TH);
          // copiar lo atenuado al destino antes de sumar
          gl.useProgram(pFade);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, estelas.leer());
          gl.uniform1i(u(pFade, 'uSrc'), 0);
          gl.uniform1f(u(pFade, 'uFade'), 1.0);
          gl.bindVertexArray(API.vaoQuad);
          gl.drawArrays(gl.TRIANGLES, 0, 3);

          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          gl.useProgram(pPto);
          gl.bindVertexArray(vaoPtos);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, estado.leer());
          gl.uniform1i(u(pPto, 'uEstado'), 0);
          gl.uniform2f(u(pPto, 'uLado'), LADO, LADO);
          gl.uniform1f(u(pPto, 'uDPR'), Math.max(1, TW / 700));
          gl.drawArrays(gl.POINTS, 0, N);
          gl.disable(gl.BLEND);
          estelas.dar();

          // 4 · pintar
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, W, H);
          gl.useProgram(pVer);
          gl.bindVertexArray(API.vaoQuad);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, estelas.leer());
          gl.uniform1i(u(pVer, 'uEstelas'), 0);
          gl.uniform1f(u(pVer, 'uT'), t);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.bindVertexArray(null);
        },
        soltar: function () {
          [pSim, pPto, pFade, pVer].forEach(function (p) { gl.deleteProgram(p); });
          gl.deleteVertexArray(vaoPtos);
        }
      };
    }
  });
})();
