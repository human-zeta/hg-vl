/*
 * Analítica de Human Glitche (Umami Cloud, plan Hobby gratis).
 *
 * Sin cookies, sin localStorage, sin datos personales: no hace falta banner.
 * Mide visitas por página y estos eventos:
 *
 *   puerta              clic en una de las 3 puertas de la portada
 *                       (puerta: herramientas | comunidad | studio)
 *   trabajar-estudio    clic en "Trabajar con el estudio" (la puerta Studio)
 *   discord             clic en cualquier invitación al Discord (desde: página)
 *   contacto-estudio    clic hacia /contacto.html (cotizar, reservá una llamada...)
 *   consulta-enviada    el formulario de contacto se envió bien (segmento)
 *   herramienta-click   clic en una herramienta desde el hub /labs/
 *   herramienta-abierta se abrió una de las 68 herramientas (herramienta, origen)
 *   instagram-zeta      clic hacia @human.zeta
 *   salida-0800         clic hacia 0800webs.com
 *
 * Mientras WEBSITE_ID tenga el valor de ejemplo, este archivo NO hace nada:
 * no carga Umami ni manda ningún dato. Se puede publicar tranquilo antes de
 * tener la cuenta.
 */
(function () {
  'use strict';

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  PEGAR ACÁ EL WEBSITE ID DE UMAMI                                 ║
  // ║  (cloud.umami.is > Settings > Websites > hg-vl.com > Edit)        ║
  // ║  Es un UUID tipo 1a2b3c4d-....                                    ║
  // ╚══════════════════════════════════════════════════════════════════╝
  var WEBSITE_ID = '8374abd0-1172-486e-95d6-05f599f7821a';

  // Solo cuenta en el sitio publicado: en localhost (python3 -m http.server)
  // Umami ignora todo, así tus pruebas no ensucian los números.
  var DOMINIOS = 'www.hg-vl.com,hg-vl.com,labs.hg-vl.com';

  if (!/^[0-9a-f-]{36}$/i.test(WEBSITE_ID)) return;   // sin ID real, nada
  if (window.__hgAnalitica) return;                   // por si se incluye dos veces
  window.__hgAnalitica = true;

  // Las 68 herramientas, tal como las lista el hub /labs/ (labs/index.html).
  var HERRAMIENTAS = [
    'forge', 'aether-2', 'labs/shaders-lab', 'isf', 'gif', 'loop', 'frames',
    'glitchdown', 'mapeo', 'relieve', 'resize', 'paleta', 'extrude',
    'marcadores', 'compas', 'pulso', 'stems', 'click', 'audiograma', 'lut',
    'gradientes', 'contraste', 'tipos', 'letras', 'kinetic', 'afiche',
    'control', 'smpte', 'test-patterns', 'overlay', 'lower-third',
    'scene-pack', 'alertas', 'stingers', 'webcam-frame', 'panels',
    'countdown', 'packgen', 'auditoria', 'embudo', 'servicios-comercios',
    'vitrina', 'medidor-gestion', 'pipelines', 'guia-venta', 'contrato',
    'setup-maker', 'propuesta', 'calculadora', 'reporte', 'qr-wa',
    'factura-ar', 'marketing-proposal', 'brief', 'kit-lanzamiento',
    'guion-campana', 'registro-planos', 'storyboard', 'proyectos-av',
    'entrega', 'gigs', 'rider', 'cue-sheet', 'checklist-show', 'brand-kit',
    'moodboard', 'calendario', 'compositor'
  ];

  // "/forge/" "/forge/index.html" "/auditoria.html" -> "forge" / "auditoria"
  function herramientaDe(pathname) {
    var p = (pathname || '').replace(/index\.html$/, '').replace(/\.html$/, '')
      .replace(/^\/+|\/+$/g, '');
    return HERRAMIENTAS.indexOf(p) >= 0 ? p : null;
  }

  var pagina = location.pathname || '/';

  function track(nombre, datos) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(nombre, datos);
      }
    } catch (e) { /* la analítica nunca rompe el sitio */ }
  }
  // Para usar desde otras páginas: window.hgTrack('evento', {dato: 'x'})
  window.hgTrack = track;

  // Etiqueta el link al que se le hizo clic con data-umami-event ANTES de que
  // lo lea Umami (este listener va en window/captura, el de Umami en
  // document/captura, así que corre primero). Umami se encarga de esperar a
  // que salga el evento antes de navegar. Funciona también con las tarjetas
  // que el hub /labs/ dibuja por JavaScript.
  function etiquetar(a, evento, datos) {
    a.setAttribute('data-umami-event', evento);
    Object.keys(datos || {}).forEach(function (k) {
      a.setAttribute('data-umami-event-' + k, String(datos[k]).slice(0, 80));
    });
  }

  window.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('data-umami-event')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    var host = url.hostname.replace(/^www\./, '');
    var interno = /(^|\.)hg-vl\.com$/.test(host) || url.origin === location.origin;

    // Las 3 puertas de la portada
    if (a.classList.contains('door')) {
      var puerta = a.classList.contains('door--tools') ? 'herramientas'
        : a.classList.contains('door--studio') ? 'studio'
        : a.classList.contains('door--core') ? 'comunidad' : 'otra';
      // La puerta Studio ES "Trabajar con el estudio": se mide como su propio
      // evento para que el embudo del estudio se lea solo.
      if (puerta === 'studio') etiquetar(a, 'trabajar-estudio', { desde: pagina });
      else etiquetar(a, 'puerta', { puerta: puerta });
      if (puerta === 'studio') track('puerta', { puerta: 'studio' });
      return;
    }
    if (/(^|\.)discord\.(gg|com)$/.test(host)) {
      etiquetar(a, 'discord', { desde: pagina });
      return;
    }
    if (host === 'instagram.com' && /human\.zeta/.test(url.pathname)) {
      etiquetar(a, 'instagram-zeta', { desde: pagina });
      return;
    }
    if (host === '0800webs.com') {
      etiquetar(a, 'salida-0800', { desde: pagina });
      return;
    }
    if (interno && /^\/contacto(\.html)?$/.test(url.pathname)) {
      etiquetar(a, 'contacto-estudio', { desde: pagina });
      return;
    }
    if (interno && /^\/labs\/?(index\.html)?$/.test(pagina)) {
      var h = herramientaDe(url.pathname);
      if (h) etiquetar(a, 'herramienta-click', { herramienta: h });
    }
  }, true);

  // Carga Umami (4 KB, sin cookies) y, si la página es una herramienta,
  // registra que se abrió y si llegaron desde el hub o directo.
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.setAttribute('data-website-id', WEBSITE_ID);
  s.setAttribute('data-domains', DOMINIOS);
  s.onload = function () {
    var h = herramientaDe(pagina);
    if (!h) return;
    var ref = document.referrer || '';
    var origen = /hg-vl\.com\/labs\/?(index\.html)?(\?|#|$)/.test(ref) ? 'lab'
      : /hg-vl\.com/.test(ref) ? 'sitio'
      : ref ? 'externo' : 'directo';
    track('herramienta-abierta', { herramienta: h, origen: origen });
  };
  (document.head || document.documentElement).appendChild(s);
})();
