/* LA FECHA DETRÁS DE LA PUERTA.
   La puerta del estudio muestra lo que hay del otro lado: un clip propio
   (@feka.vj, bajado con Zeta Lens) que asoma al pasar el cursor. Solo se
   descarga si de verdad pasás por encima — preload="none" y src diferido —
   así la puerta no le cuesta un byte a quien entra directo. */
(function () {
  'use strict';

  var door = document.querySelector('.door--lab');
  var clip = document.getElementById('labClip');
  if (!door || !clip) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { clip.remove(); return; }

  var armed = false;
  function enter() {
    if (!armed) { clip.preload = 'auto'; clip.load(); armed = true; }
    var p = clip.play();
    if (p && p.catch) p.catch(function () {});   // autoplay negado: queda el poster
  }
  function leave() { clip.pause(); }

  door.addEventListener('pointerenter', enter);
  door.addEventListener('pointerleave', leave);
  door.addEventListener('focus', enter);
  door.addEventListener('blur', leave);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) clip.pause();
  });
})();
