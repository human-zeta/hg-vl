/*
 * Vidrio HG — capa GLOBAL de vidrio esmerilado para toda la web.
 *
 * Uso: una sola línea en cualquier página (sin importar su estructura):
 *   <script src="/glass/glass.js" defer></script>
 *
 * Hace todo solo:
 *   1. inyecta /glass/glass.css (si falta)
 *   2. inyecta el fondo de color animado detrás de todo
 *   3. apoya los bloques de texto sobre placas de vidrio:
 *        - elementos con class "glass" o "glass-page" -> se respetan tal cual
 *        - si se pasa data-target="sel1, sel2" -> esos contenedores se vuelven placa
 *        - si no, se autodetecta el contenedor principal de la página
 *
 * Excluir un bloque del vidrio: agregarle data-no-glass.
 */
(function () {
  "use strict";
  var script =
    document.currentScript ||
    document.querySelector('script[src*="glass.js"]');
  var base = (script && script.src ? script.src : "/glass/glass.js")
    .replace(/glass\.js.*$/, "");

  function ensureCss() {
    if (document.querySelector('link[href*="glass.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + "glass.css";
    document.head.appendChild(link);
  }

  function injectBg() {
    if (document.querySelector(".glass-bg")) return;
    var bg = document.createElement("div");
    bg.className = "glass-bg";
    bg.setAttribute("aria-hidden", "true");
    bg.innerHTML =
      '<div class="blob b1"></div><div class="blob b2"></div>' +
      '<div class="blob b3"></div><div class="blob b4"></div>' +
      '<div class="blob b5"></div>';
    document.body.insertBefore(bg, document.body.firstChild);
  }

  function glassify() {
    // 1. los que ya están marcados en el HTML
    var marcados = document.querySelectorAll(".glass-page, .glass");
    if (marcados.length) {
      marcados.forEach(function (el) { el.classList.add("glass"); });
      return;
    }
    // 2. objetivos explícitos por data-target
    var target = script && script.getAttribute("data-target");
    if (target) {
      document.querySelectorAll(target).forEach(function (el) {
        if (el.hasAttribute("data-no-glass")) return;
        el.classList.add("glass", "glass-page");
      });
      return;
    }
    // 3. autodetección del contenedor principal
    var cand = document.querySelector(
      "main, #wrap, #content, .content, article, .container"
    );
    if (cand && !cand.hasAttribute("data-no-glass")) {
      cand.classList.add("glass", "glass-page");
    }
  }

  function luminancia(color) {
    var m = String(color).match(/[\d.]+/g);
    if (!m || m.length < 3) return 0;
    var r = m[0] / 255, g = m[1] / 255, b = m[2] / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function temaOscuro() {
    // si el texto de la página es claro -> la página es de tema oscuro
    return luminancia(getComputedStyle(document.body).color) > 0.55;
  }

  function run() {
    var oscuro = temaOscuro();
    document.documentElement.classList.add(oscuro ? "glass-dark" : "glass-light");
    ensureCss();
    if (!oscuro) injectBg();   // el fondo de color animado solo en páginas claras
    glassify();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
