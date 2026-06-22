// Bloquea el contenido de la página hasta confirmar sesión activa + suscripción TIER 03.
// Debe incluirse como el primer elemento dentro de <body> para evitar el flash de contenido.
(function(){
  var LS_KEY = 'hg_auth_session';
  var FB_URL = 'https://hg-vl-shaders-default-rtdb.firebaseio.com';

  if(document.body) document.body.style.visibility = 'hidden';

  function getSession(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch(e){ return null; }
  }

  var overlay = null;
  function buildOverlay(){
    var ov = document.createElement('div');
    ov.id = 'hg-gate-overlay';
    ov.style.visibility = 'visible';
    ov.innerHTML =
      '<style>' +
      '#hg-gate-overlay{position:fixed;inset:0;z-index:999999;background:#050505;color:#f0ede6;' +
      'display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem;' +
      'font-family:"Space Mono",monospace;}' +
      '#hg-gate-overlay .hg-box{max-width:440px;}' +
      '#hg-gate-overlay h1{font-family:"Bebas Neue",sans-serif;font-size:2.4rem;letter-spacing:.02em;' +
      'color:#b8ff00;margin:0 0 1rem;}' +
      '#hg-gate-overlay p{font-size:13px;line-height:1.8;color:rgba(240,237,230,.7);margin:0 0 1.6rem;}' +
      '#hg-gate-overlay a{display:inline-block;font-size:11px;letter-spacing:.15em;text-decoration:none;' +
      'color:#050505;background:#b8ff00;padding:.8rem 1.6rem;border-radius:2px;margin:.3rem;}' +
      '#hg-gate-overlay a.hg-ghost{background:none;color:#f0ede6;border:1px solid rgba(240,237,230,.3);}' +
      '</style>' +
      '<div class="hg-box">' +
      '<h1>ACCESO EXCLUSIVO</h1>' +
      '<p>Esto es parte de la comunidad HUMAN GLITCHE — disponible para quienes se registran y se suscriben a TIER 03 — COMPARTIR ☉.</p>' +
      '<a href="/home.html#comunidad">VER PLANES</a>' +
      '<a href="/home.html" class="hg-ghost">VOLVER AL INICIO</a>' +
      '</div>';
    return ov;
  }

  function lock(){
    document.body.style.visibility = 'hidden';
    if(!overlay) overlay = buildOverlay();
    if(!overlay.isConnected) document.body.appendChild(overlay);
  }
  function unlock(){
    if(overlay && overlay.isConnected) overlay.remove();
    document.body.style.visibility = '';
  }

  function check(){
    var session = getSession();
    if(!session || !session.uid){ lock(); return; }
    fetch(FB_URL + '/profiles/' + session.uid + '/subscription.json')
      .then(function(r){ return r.json(); })
      .then(function(sub){
        if(sub && String(sub.tier) === '3'){ unlock(); } else { lock(); }
      })
      .catch(function(){ lock(); });
  }

  check();
  document.addEventListener('hg-auth-changed', check);
  window.addEventListener('storage', function(e){ if(e.key === LS_KEY) check(); });
})();
