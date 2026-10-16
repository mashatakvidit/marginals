// Video slide: a silent loop plays while the slide is on screen; a click opens
// the full film with sound in a lightbox.
(() => {
  const slide = document.getElementById('sv');
  if (!slide) return;
  const root = document.documentElement;
  const card = slide.querySelector('.vcard');
  const prev = slide.querySelector('.vprev');
  const box = document.querySelector('.vbox');
  const full = box.querySelector('.vfull');
  const FULL_SRC = 'assets/video/full.mp4?v=20261016d';
  let open = false;

  const playPrev = () => { const p = prev.play(); if (p) p.catch(() => {}); };
  const syncPrev = () => (slide.classList.contains('is-in') && !open ? playPrev() : prev.pause());
  new MutationObserver(syncPrev).observe(slide, { attributes: true, attributeFilter: ['class'] });

  const show = () => {
    open = true;
    if (!full.getAttribute('src')) full.src = FULL_SRC;
    box.hidden = false;
    root.classList.add('vbox-open');
    requestAnimationFrame(() => box.classList.add('on'));
    prev.pause();
    full.currentTime = 0;
    full.muted = false;
    const p = full.play();
    if (p) p.catch(() => {});
    box.querySelector('.vclose').focus({ preventScroll: true });
  };
  const hide = () => {
    if (!open) return;
    open = false;
    full.pause();
    box.classList.remove('on');
    root.classList.remove('vbox-open');
    setTimeout(() => { if (!open) box.hidden = true; }, 300);
    card.focus({ preventScroll: true });
    syncPrev();
  };

  card.addEventListener('click', show);
  box.querySelector('.vclose').addEventListener('click', hide);
  box.addEventListener('click', (e) => { if (e.target === box) hide(); });

  // while the film is open, the page must not page/scroll underneath it
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); }
    e.stopImmediatePropagation();
  }, true);
  addEventListener('wheel', (e) => { if (open) e.stopImmediatePropagation(); }, { capture: true, passive: true });
})();
