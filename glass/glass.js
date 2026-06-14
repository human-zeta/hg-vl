/*
 * Vidrio HG — capa de vidrio cristal para home, menús y páginas oscuras.
 *
 * Uso: una línea por página:
 *   <script src="/glass/glass.js" defer data-target="#nav, #wrap"></script>
 *
 * - inyecta /glass/glass.css (si falta)
 * - convierte en placa de vidrio: los elementos con class "glass"/"glass-page",
 *   o los que coincidan con data-target, o (si no) el contenedor principal
 * - lee el ajuste guardado en Firebase (/glass.json) y lo aplica a las variables
 *   (lo edita y guarda el panel del admin)
 *
 * El fondo NO se toca: el vidrio difumina lo que la página ya tiene (el shader).
 */
(function () {
  "use strict";
  var FB_URL = "https://hg-vl-shaders-default-rtdb.firebaseio.com";
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

  function glassify() {
    var marcados = document.querySelectorAll(".glass-page, .glass");
    if (marcados.length) {
      marcados.forEach(function (el) { el.classList.add("glass"); });
      return;
    }
    var target = script && script.getAttribute("data-target");
    if (target) {
      document.querySelectorAll(target).forEach(function (el) {
        if (!el.hasAttribute("data-no-glass")) el.classList.add("glass");
      });
      return;
    }
    var cand = document.querySelector("main, #wrap, #content, .content, article");
    if (cand && !cand.hasAttribute("data-no-glass")) {
      cand.classList.add("glass", "glass-page");
    }
  }

  var VARS = {
    blur: "--glass-blur", alpha: "--glass-alpha", sat: "--glass-sat",
    border: "--glass-border", radius: "--glass-radius", tint: "--glass-tint"
  };
  function aplicar(cfg) {
    if (!cfg) return;
    var r = document.documentElement.style;
    if (cfg.blur != null) r.setProperty("--glass-blur", cfg.blur + "px");
    if (cfg.alpha != null) r.setProperty("--glass-alpha", cfg.alpha);
    if (cfg.sat != null) r.setProperty("--glass-sat", cfg.sat);
    if (cfg.border != null) r.setProperty("--glass-border", cfg.border);
    if (cfg.radius != null) r.setProperty("--glass-radius", cfg.radius + "px");
    if (cfg.tint != null) r.setProperty("--glass-tint", cfg.tint);
  }
  function loadSettings() {
    fetch(FB_URL + "/glass.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(aplicar)
      .catch(function () {});
  }

  function run() { ensureCss(); glassify(); loadSettings(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
