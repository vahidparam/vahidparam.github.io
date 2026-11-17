// Native chapter scrolling, parallax, and geometric dot handoffs.
(() => {
  const scenes = [...document.querySelectorAll('main > .scene')];
  if (!scenes.length) return;
  const root = document.documentElement;
  const header = document.querySelector('.topbar');
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
  document.body.append(progress, current, navigation);
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
  function transitionPoint(from, to, progress, chapter = 0) {
    const t = clamp(progress);
    const ease = t * t * t * (t * (t * 6 - 15) + 10);
    const morph = Math.sin(Math.PI * t) ** 2;
    const diameter = Math.min(184, window.innerWidth * .32, window.innerHeight * .24);
    const size = from.size + (to.size - from.size) * ease + diameter * morph;
    const margin = 18 + size * .65 * morph;
    const top = Math.min(88, Math.max(60, window.innerHeight * .1)) + margin;
    const x = from.x + (to.x - from.x) * ease;
    const y = from.y + (to.y - from.y) * ease;
    return {
      x: t === 0 || t === 1 ? x : clamp(x, margin, window.innerWidth - margin),
      y: t === 0 || t === 1 ? y : clamp(y, top, window.innerHeight - margin),
      size, morph,
      rotation: morph * (chapter % 2 ? 22.5 : -22.5),
      variant: chapter % 2
    };
  }
  function getDotTarget(points) {
    if (dirty) measure();
    const { index, next, t } = segment();
    const active = t > .5 ? next : index;
    const point = points[active];
    if (!point) return null;
    return { ...point, index: active, traveling: false, transition: 'aperture' };
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

  }
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  function refresh() { dirty = true; schedule(); }
  window.portfolioJourney = { getDotTarget, transitionPoint };
  root.classList.add('journey-enabled');
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else refresh();
  });
  document.fonts?.ready.then(refresh);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(refresh);
    scenes.forEach(scene => observer.observe(scene));
  }
  schedule();
})();
