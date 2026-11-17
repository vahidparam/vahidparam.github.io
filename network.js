// Continuous muted playback, mouse movement, and shared geometric transitions.
(() => {
  const exhibit = document.querySelector('.network-exhibit');
  const video = exhibit?.querySelector('.network-video');
  if (!video) return;
  const stage = exhibit.querySelector('.network-stage');
  const film = exhibit.querySelector('.network-film');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let blocked = false;
  let pending = false;
  let request = 0;
  let frame = 0;
  let lastTime = 0;
  const pointer = { x: 0, y: 0, hover: 0, targetX: 0, targetY: 0, targetHover: 0 };
  // Direct mouse interaction stays available; reduced motion uses a gentler response.
  const shouldPlay = () => !document.hidden && !blocked;
  const canTilt = () => visible && !document.hidden;

  function resetTilt() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
    pointer.hover = pointer.targetHover = 0;
    film.style.transform = 'none';
    film.style.setProperty('--network-hover', '0');
    film.style.willChange = '';
  }
  function syncPlayback() {
    if (!shouldPlay()) {
      request++;
      pending = false;
      video.pause();
      resetTilt();
      return;
    }
    if (!video.paused || pending) return;
    const attempt = ++request;
    pending = true;
    Promise.resolve(video.play()).then(() => {
      if (attempt !== request) return;
      pending = false;
      if (!shouldPlay()) video.pause();
    }).catch(() => {
      if (attempt !== request) return;
      pending = false;
      blocked = true;
    });
  }
  function animate(time) {
    frame = 0;
    if (!canTilt()) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 1 / 60;
    lastTime = time;
    const ease = 1 - Math.exp(-delta * 8);
    pointer.x += (pointer.targetX - pointer.x) * ease;
    pointer.y += (pointer.targetY - pointer.y) * ease;
    pointer.hover += (pointer.targetHover - pointer.hover) * ease;
    const strength = reducedMotion.matches ? .65 : 1;
    film.style.transform = `translate3d(${(pointer.x * 12 * strength).toFixed(3)}px, ${((pointer.y * 8 - pointer.hover * 8) * strength).toFixed(3)}px, 0) rotateX(${(-pointer.y * 14 * strength).toFixed(3)}deg) rotateY(${(pointer.x * 18 * strength).toFixed(3)}deg) scale(${(1 + pointer.hover * .012 * strength).toFixed(4)})`;
    film.style.setProperty('--network-hover', pointer.hover.toFixed(4));
    if (Math.abs(pointer.targetX - pointer.x) + Math.abs(pointer.targetY - pointer.y) + Math.abs(pointer.targetHover - pointer.hover) > .001) frame = requestAnimationFrame(animate);
    else { lastTime = 0; film.style.willChange = ''; }
  }
  function startTilt() {
    if (!frame && canTilt()) {
      film.style.willChange = 'transform';
      frame = requestAnimationFrame(animate);
    }
  }
  function followPointer(event) {
    if (event.pointerType === 'touch' || !canTilt()) return;
    const rect = stage.getBoundingClientRect();
    pointer.targetX = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / Math.max(rect.width, 1) - .5));
    pointer.targetY = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / Math.max(rect.height, 1) - .5));
    pointer.targetHover = 1;
    startTilt();
  }
  stage.addEventListener('pointerenter', followPointer);
  stage.addEventListener('pointermove', followPointer);
  stage.addEventListener('pointerleave', () => {
    pointer.targetX = pointer.targetY = 0;
    pointer.targetHover = 0;
    startTilt();
  });
  video.addEventListener('play', () => { if (!shouldPlay()) video.pause(); });
  video.addEventListener('pause', () => { if (shouldPlay()) syncPlayback(); });
  video.addEventListener('canplay', () => { blocked = false; syncPlayback(); });
  video.addEventListener('error', () => {
    blocked = true;
    resetTilt();
  });
  reducedMotion.addEventListener('change', () => {
    resetTilt();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  // A browser that requires a first gesture can start playback without a toggle.
  function retryPlayback() { if (blocked) { blocked = false; syncPlayback(); } }
  document.addEventListener('pointerdown', retryPlayback, { once: true });
  document.addEventListener('keydown', retryPlayback, { once: true });
  const sharedFrame = exhibit.querySelector('.network-shared-geometry');
  const sharedOutline = exhibit.querySelector('.network-pattern-outline');
  const sharedDetail = exhibit.querySelector('.network-pattern-detail');
  document.addEventListener('portfolio:dot', event => {
    const state = event.detail;
    if (state.chapter !== 'interests') {
      film.style.setProperty('--network-pulse', '0');
      return;
    }
    const pulse = Math.max(0, Math.min(1, state.morph));
    film.style.setProperty('--network-pulse', pulse.toFixed(4));
    const shapes = window.portfolioJourney?.getGeometry?.(244, state.variant);
    if (shapes && sharedFrame) {
      sharedOutline.setAttribute('d', shapes[0]);
      sharedDetail.setAttribute('d', shapes[1]);
      sharedFrame.setAttribute('transform', `translate(416 366) rotate(${(state.rotation * .6).toFixed(2)})`);
      sharedFrame.setAttribute('data-variant', String(state.variant));
    }
  });
  video.muted = true;
  video.controls = false;
  video.loop = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) resetTilt();
      syncPlayback();
    }, { threshold: .01 }).observe(stage);
  } else visible = true;
  syncPlayback();
})();
