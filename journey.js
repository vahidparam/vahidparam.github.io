// Native chapter scrolling, layered parallax, and one continuous route for the dot.
(() => {
  const scenes = [...document.querySelectorAll('main > .scene')];
  if (!scenes.length) return;
  const root = document.documentElement;
  const header = document.querySelector('.topbar');
  const anchors = [...document.querySelectorAll('[data-dot-anchor]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const svgNS = 'http://www.w3.org/2000/svg';
  const thread = document.createElementNS(svgNS, 'svg');
  thread.setAttribute('class', 'journey-thread');
  thread.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svgNS, 'path');
  thread.append(path);
  const progress = document.createElement('div');
  progress.className = 'journey-progress';
  progress.setAttribute('aria-hidden', 'true');
  const current = document.createElement('span');
  current.className = 'journey-current';
  current.setAttribute('aria-hidden', 'true');
  const navigation = document.createElement('nav');
  navigation.className = 'journey-nav';
  navigation.setAttribute('aria-label', 'Page chapters');
  const links = scenes.map(scene => {
    const link = document.createElement('a');
    link.href = `#${scene.id}`;
    link.setAttribute('aria-label', scene.dataset.chapter);
    const label = document.createElement('span');
    label.textContent = scene.dataset.chapter;
    link.append(label);
    navigation.append(link);
    return link;
  });
  document.body.append(thread, progress, current, navigation);
  let positions = [];
  let frame = 0;
  let dirty = true;
  let selected = -1;
  let headerHeight = 0;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

  function measure() {
    headerHeight = header.getBoundingClientRect().height + 1;
    const viewport = window.innerHeight - headerHeight;
    positions = scenes.map(scene => {
      const top = scene.getBoundingClientRect().top + window.scrollY;
      const inner = scene.querySelector('.scene-inner');
      const contentHeight = inner?.getBoundingClientRect().height || 0;
      scene.classList.toggle('is-long', contentHeight > viewport - 52);
      return { top: Math.max(0, top - headerHeight), height: scene.offsetHeight };
    });
    dirty = false;
  }
  function segment() {
    const scroll = window.scrollY;
    let index = 0;
    while (index < positions.length - 1 && scroll >= positions[index + 1].top - 1) index++;
    const next = Math.min(index + 1, positions.length - 1);
    const span = positions[next].top - positions[index].top;
    return { index, next, t: span > 0 ? clamp((scroll - positions[index].top) / span) : 0 };
  }
  function route(from, to, t) {
    // A restrained curve echoes the open P monogram and stays near the page edge.
    const bend = window.innerWidth - (window.innerWidth > 760 ? 54 : 20);
    const u = 1 - t;
    return {
      x: u * u * u * from.x + 3 * u * u * t * bend + 3 * u * t * t * bend + t * t * t * to.x,
      y: u * u * u * from.y + 3 * u * u * t * from.y + 3 * u * t * t * to.y + t * t * t * to.y,
      size: from.size + (to.size - from.size) * t,
      path: `M${from.x.toFixed(2)} ${from.y.toFixed(2)}C${bend} ${from.y.toFixed(2)} ${bend} ${to.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
    };
  }
  function getDotTarget(points) {
    if (dirty) measure();
    const { index, next, t } = segment();
    const from = points[index], to = points[next];
    if (!from || !to) return null;
    const point = route(from, to, t);
    return { ...point, index: t > .5 ? next : index, traveling: t > .005 && t < .995 };
  }
  function render() {
    frame = 0;
    if (document.hidden) return;
    if (dirty) measure();
    const { index, next, t } = segment();
    const active = t > .5 ? next : index;
    if (active !== selected) {
      selected = active;
      links.forEach((link, i) => {
        if (i === active) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      });
      current.textContent = scenes[active].dataset.chapter;
      root.dataset.chapter = scenes[active].id;
      // The subchapters retain the appropriate main navigation category.
      const group = { interests: 'research', nowruz: 'narratives', studio: '' };
      const navId = group[scenes[active].id] ?? scenes[active].id;
      document.querySelectorAll('#site-nav a[href^="#"]').forEach(link => {
        const on = link.hash === `#${navId}`;
        link.classList.toggle('active', on);
        if (on) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    const total = positions[positions.length - 1].top;
    root.style.setProperty('--journey-progress', String(clamp(window.scrollY / Math.max(total, 1))));
    scenes.forEach((scene, i) => {
      const distance = clamp((window.scrollY - positions[i].top) / Math.max(window.innerHeight, 1), -1.2, 1.2);
      scene.style.setProperty('--scene-distance', distance.toFixed(4));
    });
    const points = anchors.map(anchor => {
      const rect = anchor.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
    });
    const target = getDotTarget(points);
    if (target) path.setAttribute('d', target.path);
    thread.hidden = window.scrollY < 20 || reducedMotion.matches;
  }
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  function refresh() { dirty = true; schedule(); }
  window.portfolioJourney = { getDotTarget, route };
  root.classList.add('journey-enabled');
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else refresh();
  });
  reducedMotion.addEventListener('change', refresh);
  document.fonts?.ready.then(refresh);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(refresh);
    scenes.forEach(scene => observer.observe(scene));
  }
  schedule();
})();
