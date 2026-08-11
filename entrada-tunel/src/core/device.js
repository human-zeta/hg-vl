// Perfilado del dispositivo y nivel de calidad.
//
// La decision se toma UNA vez, antes de crear nada, y de ahi salen el conteo
// de particulas, el tope de DPR y si hay post-proceso. Degradar a mitad de
// sesion (bajar calidad cuando cae el framerate) suena razonable y en la
// practica se ve peor que quedarse en un nivel bajo: el salto es visible y el
// usuario lo lee como un bug. Ver dossier §5.

function detectGPU(gl) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    return String(renderer);
}

export function profile(gl) {
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const renderer = detectGPU(gl);

    const system = {
        mobile,
        os: /iPhone|iPad|iPod/i.test(ua) ? 'ios'
          : /Android/i.test(ua) ? 'android'
          : /Mac/i.test(ua) ? 'mac'
          : /Win/i.test(ua) ? 'windows' : 'other',
        cores: navigator.hardwareConcurrency || 4,
        memory: navigator.deviceMemory || null,
        pixelRatio: window.devicePixelRatio || 1,
        renderer,
        // Integradas viejas y software rasterizers: hay que reconocerlos
        // porque reportan todas las extensiones y despues corren a 8 fps.
        weakGPU: /SwiftShader|llvmpipe|Software|Basic Render|Intel.*(HD|UHD) Graphics (3|4|5|6)\d\d/i.test(renderer)
    };

    const caps = {
        colorBufferFloat: !!gl.getExtension('EXT_color_buffer_float'),
        floatLinear: !!gl.getExtension('OES_texture_float_linear'),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        // El vertex shader de particulas lee la textura de posiciones. Si el
        // hardware no permite samplers en vertex, no hay GPGPU posible.
        vertexTextureUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)
    };

    // Respetar la preferencia del sistema no es un extra: para alguien con
    // trastorno vestibular una escena que se mueve sola es una barrera real.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let tier;
    if (!caps.colorBufferFloat || caps.vertexTextureUnits < 1 || system.weakGPU) tier = 'low';
    else if (system.mobile) tier = 'medium';
    else if (system.cores <= 4) tier = 'medium';
    else tier = 'high';

    if (reducedMotion) tier = tier === 'high' ? 'medium' : tier;

    // Override por URL para control de calidad: ?tier=low|medium|high.
    // Probar el nivel bajo en la maquina de desarrollo es la unica forma
    // practica de no enterarse en produccion de que ese camino no se ejecuto
    // nunca. No se acepta un tier por encima de lo que el hardware soporta.
    const forced = new URLSearchParams(location.search).get('tier');
    if (forced && ['low', 'medium', 'high'].includes(forced)) {
        const capable = caps.colorBufferFloat && caps.vertexTextureUnits >= 1;
        tier = (!capable && forced !== 'low') ? 'low' : forced;
    }

    const presets = {
        // grid² = cantidad de particulas. 256² = 65.536
        // mesh   = subdivisiones de la icosfera: 0 la desactiva, 1 son 80
        //          caras, 2 son 320.
        low:    { grid: 0,   maxDPR: 1.5, bloom: false, aberration: 0.0, grain: 0.030, particleSize: 0,  mesh: 0 },
        // Menos particulas piden puntos mas grandes para cubrir un volumen
        // parecido, si no la nube se ve rala en vez de simplemente menos densa.
        // `aberration` esta en pixeles de separacion entre canales en la
        // esquina de la pantalla. Mas de dos y una escena de detalle fino se
        // llena de puntos rojos y verdes.
        medium: { grid: 128, maxDPR: 2.0, bloom: true,  aberration: 0.9, grain: 0.030, particleSize: 24, mesh: 1 },
        high:   { grid: 256, maxDPR: 2.0, bloom: true,  aberration: 1.4, grain: 0.035, particleSize: 14, mesh: 2 }
    };

    return { tier, system, caps, reducedMotion, quality: presets[tier] };
}
