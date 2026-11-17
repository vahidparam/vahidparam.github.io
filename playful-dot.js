(() => {
  const anchors = [...document.querySelectorAll('[data-dot-anchor]')];
  if (!anchors.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const toggle = document.querySelector('.dot-motion-toggle');
  const sourceLetter = document.querySelector('[data-dot-source]');
  const textContext = document.createElement('canvas').getContext?.('2d');
  let mouseSeen = false;
  // Play is the page's default. Pause applies until the next page load.
  let motionChoice = true;
  const pointer = { x: 0, y: 0, present: false };
  const dot = { x: 0, y: 0, size: 0 };
  const velocity = { x: 0, y: 0 };
  let geometry = null;
  let geometryGroup = null;
  let corners = null;
  let construction = null;
  let halo = null;
  let handoff = null;
  let morph = 0;
  let rotation = 0;
  let geometryVariant = -1;
  let overlay = null;
  let enabled = false;
  let playing = false;
  let scrollLocked = window.scrollY > 10;
  let layoutDirty = true;
  let points = [];
  let activeIndex = 0;
  let journeyTarget = null;
  let frame = 0;
  let lastTime = 0;
  let entrance = null;
  let entrancePlayed = false;
  const isFinalDot = () => anchors[activeIndex].dataset.dotAnchor === 'contact';
  const isPlayfulAnchor = () => activeIndex === 0 || isFinalDot();

  function dropOrigin() {
    if (!sourceLetter) return { x: points[0].x, y: Math.max(96, points[0].y - 500) };
    const rect = sourceLetter.getBoundingClientRect();
    if (textContext && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(sourceLetter);
      textContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = textContext.measureText('i');
      if (Number.isFinite(metrics.fontBoundingBoxDescent) && Number.isFinite(metrics.actualBoundingBoxAscent)) {
        return {
          x: rect.left + (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2,
          y: rect.bottom - metrics.fontBoundingBoxDescent - metrics.actualBoundingBoxAscent + points[0].size / 2
        };
      }
    }
    return { x: rect.left + rect.width * 0.65, y: rect.top + rect.height * 0.2 };
  }

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
      journeyTarget = null;
      return;
    }
    journeyTarget = window.portfolioJourney?.getDotTarget(points) || null;
    if (journeyTarget) {
      const previous = activeIndex;
      activeIndex = journeyTarget.index;
      if (previous !== activeIndex && journeyTarget.transition === 'aperture' && enabled && !entrance) {
        geometryVariant = (geometryVariant + 1) % 6;
        handoff = {
          elapsed: 0, duration: reducedMotion.matches ? 650 : 1000,
          from: { x: dot.x, y: dot.y, size: points[previous].size }
        };
      }
      return;
    }
    const readingLine = window.innerHeight * 0.36;
    activeIndex = points.reduce((best, point, index) =>
      Math.abs(point.y - readingLine) < Math.abs(points[best].y - readingLine) ? index : best, 0);
  }

  function escapedTarget() {
    const radius = Math.min(100, Math.max(76, window.innerWidth * 0.065));
    const angle = Math.atan2(dot.y - pointer.y, dot.x - pointer.x);
    const padding = isFinalDot() ? 58 : dot.size / 2 + 16;
    const size = points[activeIndex].size;
    // Stay on the cursor's radius, choosing another side near a viewport edge.
    const offsets = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI];
    for (const offset of offsets) {
      const x = pointer.x + Math.cos(angle + offset) * radius;
      const y = pointer.y + Math.sin(angle + offset) * radius;
      if (x >= padding && x <= window.innerWidth - padding && y >= 100 && y <= window.innerHeight - padding) {
        return { x, y, size };
      }
    }
    // Extremely small viewports still keep the decorative dot inside the page.
    return {
      x: Math.max(padding, Math.min(window.innerWidth - padding, pointer.x + radius)),
      y: Math.max(100, Math.min(window.innerHeight - padding, pointer.y + radius)),
      size
    };
  }

  function geometryPaths(radius, variant) {
    const r = Number(radius.toFixed(2));
    const n = value => Number(value.toFixed(2));
    const point = (angle, scale = 1) => {
      const radians = angle * Math.PI / 180;
      return `${n(Math.cos(radians) * r * scale)} ${n(Math.sin(radians) * r * scale)}`;
    };
    const arc = (start, end, scale = 1) => `M${point(start, scale)}A${n(r * scale)} ${n(r * scale)} 0 0 1 ${point(end, scale)}`;
    switch (variant) {
      case 1: // Separated circular arcs, with a second off-center rhythm.
        return [arc(-155, -65) + arc(-25, 65) + arc(105, 195), arc(-105, -25, .72) + arc(75, 135, 1.13)];
      case 2: // A narrow diamond and an offset open diamond.
        return [`M0 ${-r}L${n(r * .8)} 0L0 ${r}L${n(-r * .8)} 0Z`, `M${n(-r * .3)} ${n(-r * .7)}L${n(r * .3)} ${-r}L${n(r * .9)} ${n(-r * .3)}`];
      case 3: // Two open halves of a hexagon, with small detached parallels.
        return [`M${point(-90)}L${point(-30)}L${point(30)}M${point(90)}L${point(150)}L${point(210)}`, `M${n(-r * .36)} ${n(-r * 1.06)}H${n(r * .36)}M${n(-r * .36)} ${n(r * 1.06)}H${n(r * .36)}`];
      case 4: // Folded architectural steps echo the P line monogram.
        return [`M${-r} ${n(r * .5)}V${-r}H${n(r * .35)}V${n(-r * .35)}H${r}V${r}`, `M${n(-r * .5)} ${r}V${n(-r * .5)}H${n(r * .65)}M${n(r * .35)} ${n(-r * .35)}H${n(-r * .15)}V${n(r * .4)}`];
      case 5: // Three light chords and an elliptical arc.
        return [`M${n(-r * .8)} ${n(-r * .72)}H${n(r * .8)}M${-r} ${n(r * .72)}H${r}M${n(r * 1.12)} ${n(-r * .4)}V${n(r * .4)}`, `M${n(-r * .92)} ${n(r * .35)}A${r} ${n(r * .58)} 0 0 1 ${n(r * .92)} ${n(-r * .35)}`];
      default: { // Open square corners, retained as one of six compositions.
        const inset = n(r * .68);
        return [`M${-r} ${-inset}V${-r}H${-inset}M${inset} ${-r}H${r}V${-inset}M${r} ${inset}V${r}H${inset}M${-inset} ${r}H${-r}V${inset}`, `M${n(-r * 1.2)} 0H${n(-r * .9)}M${n(r * .9)} 0H${n(r * 1.2)}`];
      }
    }
  }

  function paint() {
    overlay.style.width = `${dot.size.toFixed(2)}px`;
    overlay.style.height = `${dot.size.toFixed(2)}px`;
    overlay.style.transform = `translate3d(${(dot.x - dot.size / 2).toFixed(2)}px, ${(dot.y - dot.size / 2).toFixed(2)}px, 0)`;
    // The solid punctuation opens into an outline as it grows; it never becomes a large opaque disk.
    const baseSize = points[activeIndex]?.size || dot.size;
    const expansion = Math.max(0, (dot.size - baseSize) / Math.max(baseSize, 8));
    overlay.style.setProperty?.('--dot-fill', String(Math.max(0, 1 - morph * 9 - expansion * .5)));
    overlay.style.setProperty?.('--dot-outline', String(Math.min(.75, Math.max(morph * 6, expansion * .4))));
    overlay.dataset.landing = anchors[activeIndex].dataset.dotAnchor;
    overlay.dataset.mode = entrance ? 'drop' : playing ? 'play' : handoff || morph > .01 ? 'aperture' : 'docked';
    if (geometryGroup) {
      const final = isFinalDot();
      const radius = Math.max(final ? 42 : 12, dot.size * .68);
      const [outline, detail] = geometryPaths(radius, geometryVariant);
      corners.setAttribute('d', outline);
      construction.setAttribute('d', detail);
      geometryGroup.setAttribute('transform', `translate(${dot.x.toFixed(2)} ${dot.y.toFixed(2)}) rotate(${rotation.toFixed(2)})`);
      geometryGroup.setAttribute('data-variant', String(Math.max(0, geometryVariant)));
      halo.setAttribute('r', String(radius * .72));
      halo.setAttribute('opacity', final ? '.45' : '0');
      geometry.style.opacity = enabled && !entrance && (!playing || final) ? String(final ? Math.max(.38, morph * .55) : morph * .55) : '0';
    }
  }

  function tick(time) {
    frame = 0;
    if (!enabled || document.hidden) { lastTime = 0; return; }
    if (layoutDirty) measure();
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    if (entrance) {
      entrance.elapsed += delta * 1000;
      const progress = Math.min(1, entrance.elapsed / entrance.duration);
      const landing = points[0];
      const fall = Math.min(1, progress / 0.72);
      const rebound = Math.max(0, (progress - 0.72) / 0.28);
      const bounce = Math.sin(rebound * Math.PI) * (1 - rebound) * 24;
      // A short sideways arc carries the tittle from the i to the surname.
      dot.x = entrance.fromX + (landing.x - entrance.fromX) * (1 - Math.pow(1 - fall, 2));
      dot.y = entrance.fromY + (landing.y - entrance.fromY) * fall * fall - bounce;
      dot.size = landing.size;
      if (progress >= 1) {
        entrance = null;
        Object.assign(dot, landing);
        lastTime = 0;
      }
      paint();
      if (entrance) schedule();
      return;
    }
    let target = playing && pointer.present && isPlayfulAnchor() ? escapedTarget() : (journeyTarget || points[activeIndex]);
    if (handoff && !playing && window.portfolioJourney?.transitionPoint) {
      handoff.elapsed += delta * 1000;
      const phase = Math.min(1, handoff.elapsed / handoff.duration);
      target = window.portfolioJourney.transitionPoint(handoff.from, target, phase, activeIndex);
      if (phase === 1) handoff = null;
    }
    morph += ((target.morph || 0) - morph) * (1 - Math.exp(-delta * 18));
    rotation += ((target.rotation || 0) - rotation) * (1 - Math.exp(-delta * 12));
    if (playing) {
      const easing = 1 - Math.exp(-delta * 20);
      dot.x += (target.x - dot.x) * easing;
      dot.y += (target.y - dot.y) * easing;
      velocity.x = velocity.y = 0;
    } else {
      // An analytic, critically damped spring preserves momentum across scroll events.
      // Unlike frame-based lerping, it has no hard change of speed when the target moves.
      const frequency = reducedMotion.matches ? 16 : 11;
      const decay = Math.exp(-frequency * delta);
      for (const axis of ['x', 'y']) {
        const offset = dot[axis] - target[axis];
        const step = (velocity[axis] + frequency * offset) * delta;
        dot[axis] = target[axis] + (offset + step) * decay;
        velocity[axis] = (velocity[axis] - frequency * step) * decay;
      }
    }
    dot.size += (target.size - dot.size) * (1 - Math.exp(-delta * (handoff ? 18 : 12)));
    const remaining = Math.abs(target.x - dot.x) + Math.abs(target.y - dot.y) + Math.abs(target.size - dot.size);
    const settled = !handoff && morph < .0005 && remaining < .08 && Math.hypot(velocity.x, velocity.y) < .6;
    if (settled) {
      dot.x = target.x; dot.y = target.y; dot.size = target.size;
      velocity.x = velocity.y = 0;
      morph = rotation = 0;
      lastTime = 0;
    }
    paint();
    if (!settled) schedule();
  }

  function schedule() {
    if (!frame && enabled && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    velocity.x = velocity.y = 0;
    handoff = null;
    morph = rotation = 0;
    if (geometry) geometry.style.opacity = '0';
  }

  function updateEligibility() {
    const hasMouse = finePointer.matches || mouseSeen;
    enabled = (hasMouse || Boolean(window.portfolioJourney)) && motionChoice;
    stop();
    entrance = null;
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
      if (document.createElementNS) {
        const svgNS = 'http://www.w3.org/2000/svg';
        geometry = document.createElementNS(svgNS, 'svg');
        geometry.setAttribute('class', 'dot-geometry');
        geometry.setAttribute('aria-hidden', 'true');
        geometryGroup = document.createElementNS(svgNS, 'g');
        corners = document.createElementNS(svgNS, 'path');
        construction = document.createElementNS(svgNS, 'path');
        construction.setAttribute('opacity', '.45');
        halo = document.createElementNS(svgNS, 'circle');
        halo.setAttribute('cx', '0');
        halo.setAttribute('cy', '0');
        halo.setAttribute('opacity', '0');
        geometryGroup.append(corners, construction, halo);
        geometry.append(geometryGroup);
        document.body.append(geometry);
      }
      overlay = document.createElement('div');
      overlay.className = 'playful-dot';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.append(overlay);
    }
    overlay.hidden = false;
    scrollLocked = window.scrollY > 10;
    measure();
    handoff = null;
    Object.assign(dot, journeyTarget || points[activeIndex]);
    if (!entrancePlayed) {
      entrancePlayed = true;
      if (activeIndex === 0 && dot.y > 110 && dot.y < window.innerHeight - 10) {
        const origin = dropOrigin();
        entrance = {
          elapsed: 0,
          duration: reducedMotion.matches ? 700 : 850,
          fromX: origin.x,
          fromY: origin.y,
          scrollStart: window.scrollY
        };
        dot.x = entrance.fromX;
        dot.y = entrance.fromY;
      }
    }
    paint();
    if (entrance) schedule();
  }

  function handleMouseMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (!mouseSeen) {
      mouseSeen = true;
      if (!finePointer.matches) updateEligibility();
    }
    if (!enabled) return;
    if (entrance) return;
    if (layoutDirty) measure();
    if (!isPlayfulAnchor() || (isFinalDot() && (handoff || morph > .01))) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.present = true;
    if (Math.hypot(pointer.x - dot.x, pointer.y - dot.y) < 120) playing = true;
    if (playing) {
      handoff = null;
      morph = rotation = 0;
      schedule();
    }
  }
  window.addEventListener('pointermove', handleMouseMove, { passive: true });
  // Embedded browsers and hybrid touch/mouse devices can misreport capabilities.
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  toggle?.addEventListener('click', () => {
    motionChoice = !enabled;
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
    if (entrance && Math.abs(window.scrollY - entrance.scrollStart) > 4) entrance = null;
    scrollLocked = window.scrollY > 10;
    layoutDirty = true;
    schedule();
  }, { passive: true });
  window.addEventListener('resize', () => { entrance = null; layoutDirty = true; playing = false; schedule(); }, { passive: true });
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
