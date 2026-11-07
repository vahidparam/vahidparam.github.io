// Animate the supplied SVG as one image; its network structure stays intact.
(() => {
  const exhibit = document.querySelector('.network-exhibit');
  const image = exhibit?.querySelector('.network-image');
  if (!image) return;
  const stage = exhibit.querySelector('.network-stage');
  const position = exhibit.querySelector('.network-position');
  const pauseButton = exhibit.querySelector('.network-pause');
  const story = exhibit.closest('.research-grid');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let paused = false;
  let frame = 0;
  let lastTime = 0;
  let progress = 0.5;
  let targetProgress = 0.5;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const clamp = value => Math.max(0, Math.min(1, value));

  function render() {
    // One full turn across the research section, reversing when scrolling up.
    const angle = (progress - 0.5) * 360;
    const y = (progress - 0.5) * 42;
    const scale = 0.91 + Math.sin(progress * Math.PI) * 0.07;
    position.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotateX(${(-pointer.y * 9).toFixed(2)}deg) rotateY(${(pointer.x * 12).toFixed(2)}deg) rotateZ(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  }
  function canMove() { return visible && !paused && !document.hidden && !reducedMotion.matches; }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function animate(time) {
    frame = 0;
    if (!canMove()) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    const easing = 1 - Math.exp(-delta * 6);
    progress += (targetProgress - progress) * easing;
    pointer.x += (pointer.targetX - pointer.x) * easing;
    pointer.y += (pointer.targetY - pointer.y) * easing;
    render();
    const remaining = Math.abs(targetProgress - progress) + Math.abs(pointer.targetX - pointer.x) + Math.abs(pointer.targetY - pointer.y);
    if (remaining > 0.001) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  }
  function start() {
    if (!frame && canMove()) frame = requestAnimationFrame(animate);
  }
  function syncMotion() {
    exhibit.classList.toggle('is-running', canMove());
    if (canMove()) start();
    else stop();
  }
  function updateScroll() {
    if (reducedMotion.matches) return;
    const bounds = story.getBoundingClientRect();
    const mobile = window.innerWidth <= 760;
    const range = mobile ? stage.getBoundingClientRect().height : bounds.height;
    targetProgress = clamp((window.innerHeight * (mobile ? 0.65 : 0.5) - bounds.top) / Math.max(range, 1));
    start();
  }
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = paused ? 'Resume animation' : 'Pause animation';
    syncMotion();
  });
  stage.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !canMove()) return;
    const bounds = stage.getBoundingClientRect();
    pointer.targetX = clamp((event.clientX - bounds.left) / bounds.width) - 0.5;
    pointer.targetY = clamp((event.clientY - bounds.top) / bounds.height) - 0.5;
    start();
  });
  stage.addEventListener('pointerleave', () => {
    pointer.targetX = pointer.targetY = 0;
    start();
  });
  function updatePreference() {
    pauseButton.hidden = reducedMotion.matches;
    if (reducedMotion.matches) {
      progress = targetProgress = 0.5;
      pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
      position.style.transform = 'none';
    } else updateScroll();
    syncMotion();
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', updateScroll, { passive: true });
  document.addEventListener('visibilitychange', syncMotion);
  reducedMotion.addEventListener('change', updatePreference);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) updateScroll();
      syncMotion();
    }, { threshold: 0 }).observe(exhibit);
  } else visible = true;
  exhibit.classList.add('network-ready');
  updatePreference();
})();
