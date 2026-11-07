(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const lines = [...hero.querySelectorAll('.profile-affiliation, .profile-focus')];
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return;
  let frame = 0;

  function fitLines() {
    frame = 0;
    lines.forEach(line => {
      const style = window.getComputedStyle(line);
      const preferred = Number(style.getPropertyValue('--preferred-size')) || 12;
      context.font = `${style.fontStyle} ${style.fontWeight} ${preferred}px ${style.fontFamily}`;
      const textWidth = context.measureText(line.textContent.trim()).width;
      const size = Math.min(preferred, preferred * (line.clientWidth - 1) / Math.max(textWidth, 1));
      const value = `${Math.max(1, size).toFixed(2)}px`;
      if (line.style.fontSize !== value) line.style.fontSize = value;
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(fitLines);
  }
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(hero);
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  if (document.fonts) {
    document.fonts.ready.then(schedule);
    document.fonts.addEventListener('loadingdone', schedule);
  }
  schedule();
})();
