// Play the supplied network recording only while the exhibit is visible.
(() => {
  const exhibit = document.querySelector('.network-exhibit');
  const video = exhibit?.querySelector('.network-video');
  if (!video) return;
  const stage = exhibit.querySelector('.network-stage');
  const film = exhibit.querySelector('.network-film');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let userPaused = false;
  let blocked = false;
  let pending = false;
  let request = 0;
  let frame = 0;
  let lastTime = 0;
  const pointer = { x: 0, y: 0, hover: 0, targetX: 0, targetY: 0, targetHover: 0 };
  // Direct mouse interaction stays available; reduced motion uses a gentler response.
  const shouldPlay = () => visible && !document.hidden && !userPaused && !blocked;
  const canTilt = () => visible && !document.hidden;

  function updatePlaybackLabel() {
    const stopped = userPaused || blocked;
    stage.setAttribute('aria-label', stopped ? 'Play the network video' : 'Pause the network video');
    stage.setAttribute('aria-pressed', String(!stopped));
  }
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
    updatePlaybackLabel();
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
      updatePlaybackLabel();
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
  function togglePlayback() {
    if (userPaused || blocked) {
      userPaused = false;
      blocked = false;
    } else userPaused = true;
    syncPlayback();
  }
  stage.addEventListener('click', togglePlayback);
  stage.addEventListener('keydown', event => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      togglePlayback();
    }
  });
  video.addEventListener('play', () => { if (!shouldPlay()) video.pause(); });
  video.addEventListener('error', () => {
    blocked = true;
    resetTilt();
    updatePlaybackLabel();
  });
  reducedMotion.addEventListener('change', () => {
    resetTilt();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  video.muted = true;
  video.controls = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncPlayback();
    }, { threshold: .01 }).observe(stage);
  } else visible = true;
  syncPlayback();
})();
