(() => {
  const viewport = document.querySelector('.stories-window');
  const track = document.querySelector('.stories-track');
  if (!track) return;
  const cards = [...track.children];
  const previous = document.querySelector('[data-story-prev]');
  const next = document.querySelector('[data-story-next]');
  let index = 0;
  function move(to, instant = false) {
    track.style.transition = instant ? "none" : "";
    index = Math.max(0, Math.min(cards.length - 1, to));
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const stride = cards[0].getBoundingClientRect().width + gap;
    const max = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const offset = Math.min(index * stride, max);
    track.style.transform = `translateX(-${offset}px)`;
    previous.disabled = offset === 0;
    next.disabled = offset >= max - 1;
  }
  previous.addEventListener('click', () => move(index - 1));
  next.addEventListener('click', () => move(index + 1));
  viewport.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); move(index + (event.key === 'ArrowRight' ? 1 : -1), true);
    }
  });
  let startX = null;
  viewport.addEventListener('pointerdown', event => { startX = event.clientX; });
  viewport.addEventListener('pointerup', event => {
    if (startX !== null && Math.abs(event.clientX - startX) > 45) move(index + (event.clientX < startX ? 1 : -1));
    startX = null;
  });
  viewport.addEventListener('pointercancel', () => { startX = null; });
  new ResizeObserver(() => move(index)).observe(viewport);
  move(0);
})();
