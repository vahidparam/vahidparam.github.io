(() => {
  const anchors = [...document.querySelectorAll('[data-dot-anchor]')];
  if (!anchors.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const toggle = document.querySelector('.dot-motion-toggle');
  let mouseSeen = false;
  let motionChoice = null;
  try {
    const saved = window.sessionStorage?.getItem('vkp.dotMotion');
    if (saved === 'on') motionChoice = true;
    if (saved === 'off') motionChoice = false;
  } catch { /* Storage can be unavailable in private or embedded previews. */ }
  const pointer = { x: 0, y: 0, present: false };
  const dot = { x: 0, y: 0, size: 0 };
  let overlay = null;
  let enabled = false;
  let playing = false;
  let scrollLocked = window.scrollY > 10;
  let layoutDirty = true;
  let points = [];
  let activeIndex = 0;
  let frame = 0;
  let lastTime = 0;

  function measure() {
    points = anchors.map(anchor => {
      const rect = anchor.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
    });
    layoutDirty = false;
    chooseLanding();
  }

  function chooseLanding() {
    // The title nearest the reader's upper-middle viewport owns the dot.
    if (!scrollLocked) {
      activeIndex = 0;
      return;
    }
    const readingLine = window.innerHeight * 0.36;
    activeIndex = points.reduce((best, point, index) =>
      Math.abs(point.y - readingLine) < Math.abs(points[best].y - readingLine) ? index : best, 0);
  }

  function escapedTarget() {
    const radius = Math.min(100, Math.max(76, window.innerWidth * 0.065));
    const angle = Math.atan2(dot.y - pointer.y, dot.x - pointer.x);
    const padding = dot.size / 2 + 16;
    // Stay on the cursor's radius, choosing another side near a viewport edge.
    const offsets = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI];
    for (const offset of offsets) {
      const x = pointer.x + Math.cos(angle + offset) * radius;
      const y = pointer.y + Math.sin(angle + offset) * radius;
      if (x >= padding && x <= window.innerWidth - padding && y >= 100 && y <= window.innerHeight - padding) {
        return { x, y, size: points[0].size };
      }
    }
    // Extremely small viewports still keep the decorative dot inside the page.
    return {
      x: Math.max(padding, Math.min(window.innerWidth - padding, pointer.x + radius)),
      y: Math.max(100, Math.min(window.innerHeight - padding, pointer.y + radius)),
      size: points[0].size
    };
  }

  function paint() {
    overlay.style.width = `${dot.size.toFixed(2)}px`;
    overlay.style.height = `${dot.size.toFixed(2)}px`;
    overlay.style.transform = `translate3d(${(dot.x - dot.size / 2).toFixed(2)}px, ${(dot.y - dot.size / 2).toFixed(2)}px, 0)`;
    overlay.dataset.landing = anchors[activeIndex].dataset.dotAnchor;
  }

  function tick(time) {
    frame = 0;
    if (!enabled || document.hidden) { lastTime = 0; return; }
    if (layoutDirty) measure();
    const target = playing && pointer.present && activeIndex === 0 ? escapedTarget() : points[activeIndex];
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    const easing = 1 - Math.exp(-delta * (playing ? 20 : 12));
    dot.x += (target.x - dot.x) * easing;
    dot.y += (target.y - dot.y) * easing;
    dot.size += (target.size - dot.size) * easing;
    const remaining = Math.abs(target.x - dot.x) + Math.abs(target.y - dot.y) + Math.abs(target.size - dot.size);
    if (remaining < 0.08) {
      Object.assign(dot, target);
      lastTime = 0;
    }
    paint();
    if (remaining >= 0.08) schedule();
  }

  function schedule() {
    if (!frame && enabled && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }

  function updateEligibility() {
    const hasMouse = finePointer.matches || mouseSeen;
    enabled = hasMouse && (motionChoice ?? !reducedMotion.matches);
    stop();
    playing = false;
    document.body.classList.toggle('dot-game-active', enabled);
    document.body.classList.toggle('dot-motion-override', enabled && motionChoice === true);
    if (toggle) {
      toggle.hidden = !hasMouse;
      toggle.textContent = enabled ? 'Pause dot' : 'Play with dot';
      toggle.setAttribute('aria-pressed', String(enabled));
    }
    if (!enabled) {
      if (overlay) overlay.hidden = true;
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'playful-dot';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.append(overlay);
    }
    overlay.hidden = false;
    scrollLocked = window.scrollY > 10;
    measure();
    Object.assign(dot, points[activeIndex]);
    paint();
  }

  function handleMouseMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (!mouseSeen) { mouseSeen = true; updateEligibility(); }
    if (!enabled) return;
    if (layoutDirty) measure();
    if (activeIndex !== 0) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.present = true;
    if (Math.hypot(pointer.x - dot.x, pointer.y - dot.y) < 120) playing = true;
    if (playing) schedule();
  }
  window.addEventListener('pointermove', handleMouseMove, { passive: true });
  // Embedded browsers and hybrid touch/mouse devices can misreport capabilities.
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  toggle?.addEventListener('click', () => {
    motionChoice = !enabled;
    try { window.sessionStorage?.setItem('vkp.dotMotion', motionChoice ? 'on' : 'off'); } catch { /* Optional preference. */ }
    updateEligibility();
  });

  function releasePointer() {
    playing = false;
    pointer.present = false;
    schedule();
  }
  window.addEventListener('pointerout', event => { if (!event.relatedTarget) releasePointer(); });
  window.addEventListener('blur', releasePointer);
  window.addEventListener('scroll', () => {
    playing = false;
    scrollLocked = window.scrollY > 10;
    layoutDirty = true;
    schedule();
  }, { passive: true });
  window.addEventListener('resize', () => { layoutDirty = true; playing = false; schedule(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else { layoutDirty = true; schedule(); }
  });
  reducedMotion.addEventListener('change', updateEligibility);
  finePointer.addEventListener('change', updateEligibility);
  const refreshLayout = () => { layoutDirty = true; schedule(); };
  if (document.fonts) {
    document.fonts.ready.then(refreshLayout);
    document.fonts.addEventListener('loadingdone', refreshLayout);
  }
  // Image loading or text reflow can move all following section titles.
  if ('ResizeObserver' in window) new ResizeObserver(refreshLayout).observe(document.querySelector('main'));
  updateEligibility();
})();
