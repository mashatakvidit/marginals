(() => {
  const root = document.documentElement;
  const slides = [...document.querySelectorAll('.slide')];
  const mobileMQ = matchMedia('(max-width: 767px)');
  const coarseMQ = matchMedia('(pointer: coarse)');
  let k = 1;

  // ---------- stage scaling ----------
  // desktop: the 1920×1080 stage is contained in a full-screen slide (centred,
  // letterboxed); mobile: the 1080×1920 stage fills the width
  const fit = () => {
    const m = root.classList.contains('m');
    const w = slides[0].clientWidth;
    const h = slides[0].clientHeight;
    k = m ? w / 1080 : Math.min(w / 1920, h / 1080);
    root.style.setProperty('--k', k);
    root.style.setProperty('--ox', m ? '0px' : `${(w - 1920 * k) / 2}px`);
    root.style.setProperty('--oy', m ? '0px' : `${(h - 1080 * k) / 2}px`);
  };
  // letterbox margins take the slide's background colour
  slides.forEach((s) => { s.style.backgroundColor = getComputedStyle(s.querySelector('.stage')).backgroundColor; });
  new ResizeObserver(fit).observe(slides[0]);

  // ---------- split text into per-character spans ----------
  document.querySelectorAll('[data-split]').forEach((el) => {
    let i = 0;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) return walk(child);
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        for (const char of child.textContent) {
          if (/\s/.test(char)) { frag.append(char); continue; }
          const span = document.createElement('span');
          span.className = 'ch';
          span.setAttribute('aria-hidden', 'true');
          span.style.setProperty('--i', i++);
          span.textContent = char;
          frag.append(span);
        }
        child.replaceWith(frag);
      });
    };
    walk(el);
  });

  // ---------- desktop ⇄ mobile layouts ----------
  // data-m holds extra inline CSS for the portrait 1080×1920 stage;
  // data-m="auto" re-maps a decoration's centre from landscape to portrait.
  const responsive = [...document.querySelectorAll('[data-m]')];
  responsive.forEach((el) => {
    el.dataset.d = el.getAttribute('style') || '';
    if (el.dataset.m === 'auto') {
      el._geo = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    }
  });
  const applyMode = () => {
    const m = mobileMQ.matches;
    root.classList.toggle('m', m);
    responsive.forEach((el) => {
      let extra = '';
      if (m && el.dataset.m === 'auto') {
        const { x, y, w, h } = el._geo;
        extra = `;left:${((x + w / 2) * 1080 / 1920 - w / 2).toFixed(1)}px;top:${((y + h / 2) * 1920 / 1080 - h / 2).toFixed(1)}px`;
      } else if (m) {
        extra = ';' + el.dataset.m;
      }
      el.setAttribute('style', el.dataset.d + extra);
      delete el._home;
    });
    document.querySelectorAll('.hint').forEach(setHintIdle);
    fit();
    setSampleText();
    fitSample();
    placeCredits();
  };

  // ---------- release elements once their entrance is over ----------
  document.addEventListener('animationend', (e) => {
    const t = e.target;
    if (t.classList.contains('a') || t.classList.contains('ch')) t.classList.add('done');
  });

  // ---------- slide 10: style switcher ----------
  const s10 = document.getElementById('s10');
  const card = s10.querySelector('.switcher');
  const tabs = [...card.querySelectorAll('.tab')];
  const sample = card.querySelector('.txt');
  const STYLES = ['regular', 'medium', 'rounded', 'rounded-medium'];
  const setStyle = (name) => {
    tabs.forEach((t) => {
      const on = t.dataset.style === name;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on);
    });
    STYLES.forEach((s) => card.classList.toggle('sw-' + s, s === name));
    sample.classList.add('swap');
    setTimeout(() => {
      sample.classList.toggle('w-medium', name.endsWith('medium'));
      sample.classList.toggle('r', name.startsWith('rounded'));
      sample.classList.remove('swap');
      fitSample();
    }, 250);
  };
  // styles switch only on click
  tabs.forEach((t) => t.addEventListener('click', () => setStyle(t.dataset.style)));

  // the sample is editable; long text shrinks to fit
  if (!sample.isContentEditable) sample.setAttribute('contenteditable', 'true');
  sample.addEventListener('paste', (e) => {
    e.preventDefault();
    const plain = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, plain);
  });
  const fitSample = () => {
    const m = root.classList.contains('m');
    const maxH = m ? 1150 : 770;
    let size = m ? 84 : 100;
    const ratio = m ? 104 / 84 : 1.2;
    const set = () => { sample.style.fontSize = `${size}px`; sample.style.lineHeight = `${Math.round(size * ratio)}px`; };
    set();
    while (card.offsetHeight > maxH && size > 28) { size -= 4; set(); }
  };
  sample.addEventListener('input', fitSample);
  // until someone types their own text, phones get the sample without hard line
  // breaks so it can wrap evenly at a bigger size
  const SAMPLE = sample.textContent;
  let sampleEdited = false;
  sample.addEventListener('input', () => { sampleEdited = true; }, { once: true });
  const setSampleText = () => {
    if (sampleEdited) return;
    sample.textContent = root.classList.contains('m') ? SAMPLE.replace(/\s*\n\s*/g, ' ') : SAMPLE;
  };

  // ---------- slide 15: names link to each author; hovering one lights up its role chip ----------
  const s15 = document.getElementById('s15');
  const credNames = [...s15.querySelectorAll('.nm')];
  const credChips = [...s15.querySelectorAll('.lang .chip')];
  credNames.forEach((nm, i) => {
    if (nm.tagName !== 'A') return;
    ['pointerenter', 'focus'].forEach((ev) => nm.addEventListener(ev, () => credChips[i].classList.add('hot')));
    ['pointerleave', 'blur'].forEach((ev) => nm.addEventListener(ev, () => credChips[i].classList.remove('hot')));
  });

  // each role chip sits right above its name (positions follow the font's real metrics)
  const placeCredits = () => {
    const stageLeft = s15.querySelector('.stage').getBoundingClientRect().left;
    s15.querySelectorAll('.lang').forEach((layer) => {
      const names = layer.querySelectorAll('.nm');
      layer.querySelectorAll('.chip').forEach((chip, i) => {
        chip.style.left = `${(names[i].getBoundingClientRect().left - stageLeft) / k}px`;
      });
    });
  };
  document.fonts.ready.then(placeCredits);

  // ---------- drag & drop (slides 5, 11, 14) ----------
  let z = 100;
  const wiggle = (el) => {
    const spin = el.closest('#s11');
    el.animate(
      spin
        ? [{ rotate: '0deg', scale: 1 }, { rotate: '360deg', scale: 1.18 }, { rotate: '360deg', scale: 1 }]
        : [{ rotate: '0deg' }, { rotate: '-9deg' }, { rotate: '7deg' }, { rotate: '-3deg' }, { rotate: '0deg' }],
      { duration: spin ? 700 : 520, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
  };
  function setHintIdle(hint) {
    hint.dataset.state = 'idle';
    hint.firstElementChild.textContent = 'можно перетащить';
  }
  const setHintReset = (hint) => {
    if (!hint || hint.dataset.state === 'reset') return;
    hint.dataset.state = 'reset';
    hint.firstElementChild.textContent = 'вернуть как было';
  };
  const resetSlide = (slide) => {
    slide.querySelectorAll('[data-drag]').forEach((el) => {
      if (!el._home) return;
      el.classList.add('returning');
      el.style.left = el._home.left;
      el.style.top = el._home.top;
      delete el._home;
      setTimeout(() => el.classList.remove('returning'), 650);
    });
  };
  document.querySelectorAll('.hint').forEach((hint) => {
    setHintIdle(hint);
    hint.addEventListener('click', () => {
      const slide = hint.closest('.slide');
      if (hint.dataset.state === 'reset') { resetSlide(slide); setHintIdle(hint); return; }
      [...slide.querySelectorAll('[data-drag]')].slice(0, 12).forEach((el, i) => setTimeout(() => wiggle(el), i * 50));
    });
  });

  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-drag]');
    if (!el || e.button > 0) return;
    const slide = el.closest('.slide');
    if (!slide.classList.contains('is-in')) return;
    // phones: no dragging (the page scrolls under the finger instead)
    if (root.classList.contains('m') || (coarseMQ.matches && el.dataset.drag === 'big')) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic / already released pointer */ }
    const sx = e.clientX, sy = e.clientY;
    const l0 = el.offsetLeft, t0 = el.offsetTop;
    let moved = false;
    el.style.zIndex = ++z;
    const move = (ev) => {
      const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      if (!moved) {
        moved = true;
        if (!el._home) el._home = { left: el.style.left, top: el.style.top };
        el.classList.add('dragging');
      }
      el.style.left = `${l0 + dx}px`;
      el.style.top = `${t0 + dy}px`;
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      if (moved) setHintReset(slide.querySelector('.hint'));
      else wiggle(el);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });

  // ---------- play on enter, reset when fully off-screen ----------
  const onLeave = (slide) => {
    slide.querySelectorAll('.done').forEach((el) => el.classList.remove('done'));
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
      if (isIntersecting && intersectionRatio >= 0.35 && !target.classList.contains('is-in')) {
        target.classList.add('is-in');
      } else if (!isIntersecting && target.classList.contains('is-in')) {
        target.classList.remove('is-in');
        onLeave(target);
      }
    });
  }, { threshold: [0, 0.35] });

  applyMode();
  mobileMQ.addEventListener('change', applyMode);

  // ---------- preloader: wait for fonts + images (max 6s), then start the show ----------
  const bar = document.querySelector('.pl-bar i');
  const imgs = [...document.images];
  let ready = 0;
  const tick = () => bar && bar.style.setProperty('--p', Math.max(.04, ready / (imgs.length + 1)));
  const loaded = (img) => (img.complete ? Promise.resolve() : new Promise((r) => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  })).then(() => { ready++; tick(); });
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    if (bar) bar.style.setProperty('--p', 1);
    fit();
    fitSample();
    placeCredits();
    setTimeout(() => {
      root.classList.add('loaded');
      slides.forEach((s) => io.observe(s));
    }, 250);
  };
  Promise.all([document.fonts.ready.then(() => { ready++; tick(); }), ...imgs.map(loaded)]).then(start);
  setTimeout(start, 6000);

  // ---------- one gesture = one slide ----------
  // a slide's resting scroll position (the last ones may be unreachable in tall windows)
  const topOf = (i) => Math.min(slides[i].offsetTop, root.scrollHeight - innerHeight);
  const nearest = () => {
    let best = 0;
    slides.forEach((_, i) => {
      if (Math.abs(topOf(i) - scrollY) < Math.abs(topOf(best) - scrollY)) best = i;
    });
    return best;
  };
  let anim = 0;
  let target = 0;
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const animateTo = (i) => {
    cancelAnimationFrame(anim);
    target = i;
    const y0 = scrollY;
    const dy = topOf(i) - y0;
    const t0 = performance.now();
    const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750;
    const step = (now) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1;
      scrollTo(0, y0 + dy * ease(p));
      anim = p < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  };
  const go = (dir) => animateTo(Math.max(0, Math.min(slides.length - 1, (anim ? target : nearest()) + dir)));

  // wheel / trackpad: one page per gesture; inertia keeps the lock alive
  let lockedAt = 0;
  let lastWheel = 0;
  addEventListener('wheel', (e) => {
    if (coarseMQ.matches || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = performance.now();
    const quiet = now - lastWheel > 250;
    lastWheel = now;
    if (now - lockedAt < 800 || (!quiet && now - lockedAt < 1600)) return;
    if (Math.abs(e.deltaY) < 2) return;
    lockedAt = now;
    go(Math.sign(e.deltaY));
  }, { passive: false });

  // scrollbar drag, Home/End, find-in-page…: settle on the nearest slide
  let settle = 0;
  addEventListener('scroll', () => {
    if (coarseMQ.matches || anim) return;
    clearTimeout(settle);
    settle = setTimeout(() => {
      const i = nearest();
      if (Math.abs(topOf(i) - scrollY) > 2) animateTo(i);
    }, 180);
  }, { passive: true });

  // back-to-top button: only on the last slide
  const toTop = document.querySelector('.to-top');
  const syncTop = () => toTop.classList.toggle('show', scrollY > topOf(slides.length - 1) - innerHeight * .5);
  addEventListener('scroll', syncTop, { passive: true });
  syncTop();
  toTop.addEventListener('click', () => { lockedAt = performance.now(); animateTo(0); });

  addEventListener('keydown', (e) => {
    if (e.target.closest('button, input, textarea, select, a') || e.target.isContentEditable) return;
    const next = ['ArrowDown', 'PageDown', ' '].includes(e.key);
    const prev = ['ArrowUp', 'PageUp'].includes(e.key);
    if (!next && !prev) return;
    e.preventDefault();
    go(next ? 1 : -1);
  });
})();
