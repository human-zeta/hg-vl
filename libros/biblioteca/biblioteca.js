/*
 * Biblioteca HG — panel deslizante reutilizable.
 *
 * Para usarlo en cualquier página de libro, agregar en el <head>:
 *   <link rel="stylesheet" href="../biblioteca/biblioteca.css">
 * y antes de </body>:
 *   <script src="../biblioteca/biblioteca.js" data-libro="martin-fierro"></script>
 *
 * El atributo data-libro marca cuál libro se está leyendo (se resalta en el panel).
 * Para sumar un libro: agregar una entrada a CATALOGO. Las rutas `url` son
 * relativas a la carpeta de cada libro (que está al mismo nivel que biblioteca/).
 */
(function () {
  "use strict";

  // Pilares Human Glitche: ⌘ Conciencia · ✦ Creación · ☉ Compartir · ⌖ Raíz argentina
  var CATALOGO = [
    // ---- Disponibles ----
    { slug: "martin-fierro", titulo: "Martín Fierro", autor: "José Hernández",
      nota: "1872–1879 · poema nacional", url: "../martin-fierro/index.html",
      estado: "disponible", pilar: "⌖ Raíz argentina" },

    { slug: "facundo", titulo: "Facundo", autor: "D. F. Sarmiento",
      nota: "Civilización y barbarie (1845)", url: "../facundo/index.html",
      estado: "disponible", pilar: "⌖ Raíz argentina" },
    { slug: "el-matadero", titulo: "El Matadero", autor: "Esteban Echeverría",
      nota: "El primer cuento argentino (~1840)", url: "../el-matadero/index.html",
      estado: "disponible", pilar: "⌖ Raíz argentina" },
    { slug: "quiroga-cuentos", titulo: "Cuentos de amor, de locura y de muerte", autor: "Horacio Quiroga",
      nota: "18 relatos (1917)", url: "../quiroga-cuentos/index.html",
      estado: "disponible", pilar: "⌖ Raíz argentina" },

    // ---- Propuestos (dominio público, por sumar) ----

    { slug: "meditaciones", titulo: "Meditaciones", autor: "Marco Aurelio",
      nota: "Estoicismo · mirar hacia adentro", estado: "proximo", pilar: "⌘ Conciencia" },
    { slug: "walden", titulo: "Walden · Desobediencia civil", autor: "H. D. Thoreau",
      nota: "Vivir simple, el sistema y la libertad", estado: "proximo", pilar: "⌘ Conciencia" },
    { slug: "tao-te-ching", titulo: "Tao Te Ching", autor: "Lao Tse",
      nota: "El camino, el no-forzar", estado: "proximo", pilar: "⌘ Conciencia" },

    { slug: "hojas-de-hierba", titulo: "Hojas de hierba", autor: "Walt Whitman",
      nota: "El canto al yo libre y a lo humano", estado: "proximo", pilar: "✦ Creación" },
    { slug: "el-profeta", titulo: "El Profeta", autor: "Khalil Gibran",
      nota: "Poemas sobre el vivir (1923)", estado: "proximo", pilar: "✦ Creación" },
    { slug: "quijote", titulo: "Don Quijote de la Mancha", autor: "Miguel de Cervantes",
      nota: "La imaginación contra lo dado", estado: "proximo", pilar: "☉ Compartir" }
  ];

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function construir() {
    var script = document.currentScript ||
      document.querySelector('script[src*="biblioteca.js"]');
    var actual = script ? script.getAttribute("data-libro") : null;

    var raiz = el("div", "hg-biblio");

    // pestaña
    var tab = el("button", "hg-biblio-tab",
      '<span class="icono">📚</span>Biblioteca');
    tab.setAttribute("aria-label", "Abrir biblioteca");

    var backdrop = el("div", "hg-biblio-backdrop");

    // panel
    var panel = el("aside", "hg-biblio-panel");
    var head = el("div", "hg-biblio-head",
      '<div><h2>Biblioteca HG</h2><div class="sub">El Diario · Clásicos</div></div>');
    var cerrar = el("button", "hg-biblio-cerrar", "&times;");
    cerrar.setAttribute("aria-label", "Cerrar biblioteca");
    head.appendChild(cerrar);

    var lista = el("div", "hg-biblio-lista");

    var disponibles = CATALOGO.filter(function (b) { return b.estado === "disponible"; });
    var proximos = CATALOGO.filter(function (b) { return b.estado === "proximo"; });

    function item(b) {
      var clase = "hg-libro" + (b.estado === "proximo" ? " proximo" : "") +
        (b.slug === actual ? " activo" : "");
      var inner =
        '<div class="t">' + esc(b.titulo) + '</div>' +
        '<div class="a">' + esc(b.autor) + '</div>' +
        (b.nota ? '<div class="n">' + esc(b.nota) + '</div>' : '') +
        (b.pilar ? '<span class="hg-pilar">' + esc(b.pilar) + '</span>' : '');
      var node;
      if (b.estado === "disponible") {
        node = el("a", clase, inner);
        node.href = b.url;
      } else {
        node = el("div", clase, inner);
      }
      return node;
    }

    if (disponibles.length) {
      lista.appendChild(el("div", "hg-biblio-grupo", "En la biblioteca"));
      disponibles.forEach(function (b) { lista.appendChild(item(b)); });
    }
    if (proximos.length) {
      lista.appendChild(el("div", "hg-biblio-grupo", "Próximos · propuestos"));
      proximos.forEach(function (b) { lista.appendChild(item(b)); });
    }

    var pie = el("div", "hg-biblio-pie",
      "Textos de dominio público · hg-vl.com");

    panel.appendChild(head);
    panel.appendChild(lista);
    panel.appendChild(pie);

    raiz.appendChild(tab);
    raiz.appendChild(backdrop);
    raiz.appendChild(panel);
    document.body.appendChild(raiz);

    function abrir() { raiz.classList.add("abierto"); }
    function cerrarP() { raiz.classList.remove("abierto"); }
    tab.addEventListener("click", abrir);
    cerrar.addEventListener("click", cerrarP);
    backdrop.addEventListener("click", cerrarP);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") cerrarP();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", construir);
  } else {
    construir();
  }
})();
