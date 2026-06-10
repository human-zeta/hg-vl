// Chat grupal flotante HG — burbuja siempre visible, fondo transparente.
// Requiere sesión (hg_auth_session en localStorage, mismo sistema que el resto del sitio).
// Mensajes persistidos en Firebase (/chat/messages) — quedan como registro para admins/mods.
(function(){
  const FB_URL      = 'https://hg-vl-shaders-default-rtdb.firebaseio.com';
  const FB_API_KEY  = 'AIzaSyAeMKHe7dj4bnaUzkF7iDANrC_cBtg4LAA';
  const REFRESH_URL = 'https://securetoken.googleapis.com/v1/token';
  const LS_KEY      = 'hg_auth_session';
  const LASTREAD_KEY= 'hg_chat_lastread';
  const POLL_OPEN   = 3000;
  const POLL_CLOSED = 12000;

  const STYLE = `
    #hgchat-bubble{
      position:fixed;bottom:18px;right:18px;z-index:850;
      width:46px;height:46px;border-radius:50%;
      background:rgba(10,10,10,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      border:1px solid rgba(184,255,0,0.35);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;transition:background 0.2s,border-color 0.2s;
      font-family:'Space Mono',monospace;font-size:18px;color:#b8ff00;
    }
    #hgchat-bubble:hover{background:rgba(184,255,0,0.1);border-color:#b8ff00;}
    #hgchat-bubble .hgchat-dot{
      position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;
      background:#ff2d55;border:1.5px solid #050505;
      animation:hgchat-pulse 1.4s ease-in-out infinite;display:none;
    }
    #hgchat-bubble.unread .hgchat-dot{display:block;}
    @keyframes hgchat-pulse{0%,100%{opacity:0.4;}50%{opacity:1;}}

    #hgchat-panel{
      position:fixed;bottom:74px;right:18px;z-index:850;
      width:300px;max-width:calc(100vw - 36px);
      height:400px;max-height:calc(100vh - 110px);
      background:rgba(8,8,8,0.62);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
      border:1px solid rgba(184,255,0,0.25);border-radius:6px;
      display:none;flex-direction:column;overflow:hidden;
      box-shadow:0 8px 40px rgba(0,0,0,0.5);
      font-family:'Space Mono',monospace;
    }
    #hgchat-panel.show{display:flex;}
    #hgchat-head{
      display:flex;align-items:center;justify-content:space-between;
      padding:0.7rem 0.9rem;border-bottom:1px solid rgba(240,237,230,0.08);
      flex-shrink:0;
    }
    #hgchat-head .hgchat-title{
      font-size:9px;letter-spacing:0.25em;color:#b8ff00;text-transform:uppercase;font-weight:700;
    }
    #hgchat-head .hgchat-close{
      background:none;border:none;color:rgba(240,237,230,0.4);cursor:pointer;
      font-size:13px;line-height:1;padding:2px 4px;transition:color 0.2s;
    }
    #hgchat-head .hgchat-close:hover{color:#ff2d55;}

    #hgchat-msgs{
      flex:1;overflow-y:auto;padding:0.7rem 0.8rem;
      display:flex;flex-direction:column;gap:0.55rem;
    }
    #hgchat-msgs::-webkit-scrollbar{width:3px;}
    #hgchat-msgs::-webkit-scrollbar-thumb{background:rgba(184,255,0,0.2);}
    .hgchat-msg{font-size:10.5px;line-height:1.5;color:rgba(240,237,230,0.8);word-break:break-word;}
    .hgchat-msg .hgchat-name{color:#b8ff00;font-weight:700;margin-right:5px;}
    .hgchat-msg .hgchat-time{color:rgba(240,237,230,0.25);font-size:8px;margin-left:5px;}
    .hgchat-msg .hgchat-del{
      background:none;border:none;color:rgba(255,45,85,0.4);cursor:pointer;
      font-size:9px;margin-left:6px;padding:0 2px;
    }
    .hgchat-msg .hgchat-del:hover{color:#ff2d55;}
    .hgchat-empty,.hgchat-loading{
      font-size:9px;letter-spacing:0.1em;color:rgba(240,237,230,0.25);
      text-align:center;padding:1.5rem 0.5rem;text-transform:uppercase;
    }
    .hgchat-error{
      font-size:8.5px;letter-spacing:0.05em;color:#ff2d55;
      text-align:center;padding:1.5rem 0.7rem;line-height:1.7;
    }
    #hgchat-status{
      font-size:8px;letter-spacing:0.05em;color:#ff2d55;
      text-align:center;padding:0 0.7rem 0.4rem;line-height:1.6;
    }

    #hgchat-foot{
      flex-shrink:0;border-top:1px solid rgba(240,237,230,0.08);
      padding:0.6rem 0.7rem;display:flex;gap:6px;align-items:center;
    }
    #hgchat-input{
      flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(240,237,230,0.15);
      border-radius:3px;color:#f0ede6;font-family:'Space Mono',monospace;font-size:10px;
      padding:7px 9px;outline:none;transition:border-color 0.2s;
    }
    #hgchat-input:focus{border-color:#b8ff00;}
    #hgchat-send{
      background:#b8ff00;color:#050505;border:none;border-radius:3px;
      font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.1em;
      padding:8px 11px;cursor:pointer;transition:opacity 0.2s;white-space:nowrap;
    }
    #hgchat-send:hover{opacity:0.85;}
    #hgchat-send:disabled{opacity:0.35;cursor:wait;}

    #hgchat-login{
      flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;
      gap:0.8rem;padding:1.5rem;text-align:center;
    }
    #hgchat-login p{font-size:9.5px;letter-spacing:0.06em;color:rgba(240,237,230,0.4);line-height:1.7;}
    #hgchat-login a{
      font-size:8px;letter-spacing:0.2em;color:#b8ff00;text-decoration:none;
      border:1px solid rgba(184,255,0,0.35);border-radius:2px;padding:8px 14px;
      text-transform:uppercase;transition:background 0.2s;
    }
    #hgchat-login a:hover{background:rgba(184,255,0,0.08);}

    @media(max-width:480px){
      #hgchat-panel{right:10px;bottom:70px;width:calc(100vw - 20px);}
      #hgchat-bubble{right:10px;bottom:10px;}
    }
  `;

  function getSession(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'null'); }catch(e){ return null; } }
  function saveSession(s){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }

  async function freshToken(s){
    if(!s || !s.refreshToken) return s ? s.idToken : null;
    try{
      const r = await fetch(`${REFRESH_URL}?key=${FB_API_KEY}`,{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`
      });
      if(!r.ok) return s.idToken;
      const data = await r.json();
      s.idToken = data.id_token;
      s.refreshToken = data.refresh_token;
      saveSession(s);
      return s.idToken;
    }catch(e){ return s.idToken; }
  }

  function escHtml(s){
    if(!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function timeLabel(ts){
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2,'0');
    const m = d.getMinutes().toString().padStart(2,'0');
    return `${h}:${m}`;
  }

  function build(){
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    const bubble = document.createElement('div');
    bubble.id = 'hgchat-bubble';
    bubble.innerHTML = `⌬<span class="hgchat-dot"></span>`;
    document.body.appendChild(bubble);

    const panel = document.createElement('div');
    panel.id = 'hgchat-panel';
    panel.innerHTML = `
      <div id="hgchat-head">
        <span class="hgchat-title">⌬ CHAT HG</span>
        <button class="hgchat-close" type="button">✕</button>
      </div>
      <div id="hgchat-msgs"><div class="hgchat-loading">CARGANDO…</div></div>
      <div id="hgchat-login">
        <p>Iniciá sesión en Human Glitche para participar del chat.</p>
        <a href="index.html#comunidad">INICIAR SESIÓN</a>
      </div>
      <div id="hgchat-status"></div>
      <div id="hgchat-foot"></div>
    `;
    document.body.appendChild(panel);

    return {
      bubble, panel,
      msgs:   panel.querySelector('#hgchat-msgs'),
      login:  panel.querySelector('#hgchat-login'),
      status: panel.querySelector('#hgchat-status'),
      foot:   panel.querySelector('#hgchat-foot'),
      close:  panel.querySelector('.hgchat-close')
    };
  }

  function init(){
    const { bubble, panel, msgs, login, status, foot, close } = build();
    let session = getSession();
    let isStaff = false;
    let pollTimer = null;
    let isOpen = false;
    let nearBottom = true;

    msgs.addEventListener('scroll', ()=>{
      nearBottom = (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight) < 60;
    });

    function renderFoot(){
      if(!session){
        msgs.style.display = 'none';
        login.style.display = 'flex';
        foot.style.display = 'none';
        foot.innerHTML = '';
        status.textContent = '';
        return;
      }
      msgs.style.display = 'flex';
      login.style.display = 'none';
      foot.style.display = 'flex';
      foot.innerHTML = `
        <input id="hgchat-input" type="text" maxlength="280" placeholder="Escribí algo…" autocomplete="off">
        <button id="hgchat-send" type="button">ENVIAR</button>
      `;
      status.textContent = '';
      const input = foot.querySelector('#hgchat-input');
      const send  = foot.querySelector('#hgchat-send');
      async function doSend(){
        const text = input.value.trim();
        if(!text) return;
        send.disabled = true;
        input.disabled = true;
        status.textContent = '';
        try{
          const token = await freshToken(session);
          const r = await fetch(`${FB_URL}/chat/messages.json?auth=${token}`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              uid: session.uid,
              name: session.name || session.email,
              text,
              ts: Date.now()
            })
          });
          if(!r.ok){
            const errBody = await r.text().catch(()=>'');
            if(r.status === 401 || r.status === 403){
              status.textContent = `Sin permiso para chatear (HTTP ${r.status}) — falta la regla de Firebase para /chat.`;
            } else {
              status.textContent = `No se pudo enviar — HTTP ${r.status}${errBody ? ' — ' + errBody.slice(0,120) : ''}`;
            }
          } else {
            input.value = '';
            await loadMessages();
          }
        }catch(e){
          status.textContent = `Error de red — ${e.message}`;
        }
        send.disabled = false;
        input.disabled = false;
        input.focus();
      }
      send.addEventListener('click', doSend);
      input.addEventListener('keydown', e=>{ if(e.key==='Enter') doSend(); });
    }

    async function checkStaff(){
      if(!session) return false;
      try{
        const token = await freshToken(session);
        const [aR,mR] = await Promise.all([
          fetch(`${FB_URL}/admins.json?auth=${token}`),
          fetch(`${FB_URL}/moderators.json?auth=${token}`)
        ]);
        const admins = aR.ok ? await aR.json() : null;
        const mods   = mR.ok ? await mR.json() : null;
        return !!(admins && admins[session.uid]) || !!(mods && mods[session.uid]);
      }catch(e){ return false; }
    }

    async function deleteMessage(mid){
      if(!session) return;
      if(!confirm('¿Borrar este mensaje del chat?')) return;
      try{
        const token = await freshToken(session);
        await fetch(`${FB_URL}/chat/messages/${mid}.json?auth=${token}`,{ method:'DELETE' });
        await loadMessages();
      }catch(e){ /* silencioso */ }
    }

    function renderMessages(list){
      if(!list.length){
        msgs.innerHTML = '<div class="hgchat-empty">Todavía no hay mensajes — ¡arrancá la charla!</div>';
        return;
      }
      msgs.innerHTML = list.map(m => {
        const del = (isStaff || (session && m.uid === session.uid))
          ? `<button class="hgchat-del" data-mid="${m.id}" title="Borrar">✕</button>` : '';
        return `<div class="hgchat-msg">
          <span class="hgchat-name">${escHtml(m.name || '?')}</span>${escHtml(m.text || '')}<span class="hgchat-time">${timeLabel(m.ts)}</span>${del}
        </div>`;
      }).join('');
      msgs.querySelectorAll('.hgchat-del').forEach(btn=>{
        btn.addEventListener('click', ()=> deleteMessage(btn.dataset.mid));
      });
      if(nearBottom) msgs.scrollTop = msgs.scrollHeight;
    }

    let lastTs = 0;
    async function loadMessages(){
      if(!session){ return; }
      try{
        const token = await freshToken(session);
        const r = await fetch(`${FB_URL}/chat/messages.json?orderBy="ts"&limitToLast=50&auth=${token}`);
        if(!r.ok){
          if(r.status === 401 || r.status === 403){
            msgs.innerHTML = `<div class="hgchat-error">Sin permiso para leer el chat (HTTP ${r.status}) — falta la regla de Firebase para /chat.</div>`;
          } else {
            msgs.innerHTML = `<div class="hgchat-error">No se pudo cargar el chat (HTTP ${r.status}).</div>`;
          }
          return;
        }
        const data = await r.json();
        const list = data ? Object.entries(data).map(([id,m]) => ({ id, ...m })).sort((a,b)=>(a.ts||0)-(b.ts||0)) : [];
        renderMessages(list);
        if(list.length){
          const newest = list[list.length-1].ts || 0;
          lastTs = newest;
          if(!isOpen){
            const lastRead = parseInt(localStorage.getItem(LASTREAD_KEY) || '0');
            bubble.classList.toggle('unread', newest > lastRead);
          }
        }
      }catch(e){
        msgs.innerHTML = `<div class="hgchat-error">Error de red — ${escHtml(e.message)}</div>`;
      }
    }

    function startPolling(){
      if(pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(loadMessages, isOpen ? POLL_OPEN : POLL_CLOSED);
    }

    function openPanel(){
      if(!session){
        renderFoot();
        return;
      }
      isOpen = true;
      panel.classList.add('show');
      bubble.classList.remove('unread');
      localStorage.setItem(LASTREAD_KEY, String(lastTs || Date.now()));
      loadMessages();
      startPolling();
    }
    function closePanel(){
      isOpen = false;
      panel.classList.remove('show');
      localStorage.setItem(LASTREAD_KEY, String(lastTs || Date.now()));
      bubble.classList.remove('unread');
      startPolling();
    }

    bubble.addEventListener('click', ()=>{
      if(panel.classList.contains('show')) closePanel(); else openPanel();
    });
    close.addEventListener('click', closePanel);

    renderFoot();
    if(session){
      checkStaff().then(v => isStaff = v);
      loadMessages();
    }
    startPolling();

    // re-chequea sesión periódicamente (por si el usuario inicia sesión en otra pestaña/recarga)
    setInterval(()=>{
      const s = getSession();
      if(JSON.stringify(s) !== JSON.stringify(session)){
        session = s;
        renderFoot();
        if(session){ checkStaff().then(v => isStaff = v); loadMessages(); }
      }
    }, 5000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
