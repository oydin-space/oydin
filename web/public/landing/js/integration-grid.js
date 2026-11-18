(() => {
 const demo = document.querySelector('.logo-grid-demo');
 if (!demo) return;
 const viewport = demo.querySelector('.logo-grid-viewport');
 const parent = demo.querySelector('.logo-grid-perspective');
 const grid = demo.querySelector('.logo-grid');
 const touchLayout = matchMedia('(max-width:800px)');
 const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const tiles = [...grid.querySelectorAll('.logo-tile')].map(button => ({
  button, wrapper: button.parentElement, shadow: button.previousElementSibling,
  row: Number(button.dataset.row), col: Number(button.dataset.col),
  hover: false, focus: false, level: 0
 }));
 const resize = () => {
  const widthScale = parent.clientWidth / 3856;
  const angle = parseFloat(getComputedStyle(demo).getPropertyValue('--grid-angle'));
  const projectedHeight = 1432 * Math.cos(angle * Math.PI / 180);
  const heightScale = parent.clientHeight / projectedHeight * .88;
  const multiplier = parent.clientWidth < 640 ? 1.8 : parent.clientWidth < 1024 ? 1.35 : 1;
  const scale = Math.min(Math.max(widthScale, Math.min(heightScale, widthScale * multiplier)), 1);
  grid.style.setProperty('--grid-scale', scale);
 };
 new ResizeObserver(resize).observe(parent);
 resize();

 let inView = false, active = false, frame = 0, last = 0, pausedAt = performance.now();
 let pulses = [], idleTimer = 0, idleRemaining = 3500, idleDeadline = 0;
 const paint = tile => {
  const level = tile.level;
  const scaleAmount = tile.col === 0 ? 0 : tile.col === 7 ? .04 : .1;
  tile.button.style.transform = `translateY(${-40 * level}px) scale(${1 + scaleAmount * level})`;
  tile.shadow.style.opacity = .88 - .5 * level;
  tile.shadow.style.transform = `scale(${1 + .32 * level},${1 + .24 * level})`;
  // Keep blur fixed: per-frame blur repaints every large ground shadow.
  tile.wrapper.classList.toggle('is-lifted', level > .01 || tile.hover || tile.focus);
 };
 const tick = now => {
  frame = 0;
  if (!active) return;
  if (touchLayout.matches && last && now - last < 32) {frame = requestAnimationFrame(tick); return;}
  const deltaMs = Math.min(last ? now - last : 16, 50);
  last = now;
  pulses = pulses.filter(pulse => now - pulse.start <= 700 + Math.hypot(7, 2) * 85);
  let moving = pulses.length > 0;
  for (const tile of tiles) {
   let rippleTarget = 0;
   for (const pulse of pulses) {
    const distance = Math.hypot(tile.row - pulse.row, tile.col - pulse.col);
    const progress = (now - pulse.start - distance * 85) / 700;
    if (progress >= 0 && progress <= 1) rippleTarget = Math.max(rippleTarget, Math.sin(progress * Math.PI) * pulse.strength * Math.exp(-distance * .4));
   }
   const target = Math.max(tile.hover || tile.focus ? 1 : 0, rippleTarget);
   const previousLevel = tile.level;
   tile.level += (target - tile.level) * (1 - Math.exp(-deltaMs / 65));
   if (Math.abs(target - tile.level) < .0001) tile.level = target;
   else moving = true;
   if (Math.abs(previousLevel - tile.level) > .00001) paint(tile);
  }
  if (moving) frame = requestAnimationFrame(tick);
  else last = 0;
 };
 const wake = () => { if (active && !frame) frame = requestAnimationFrame(tick); };
 const ripple = (tile, strength) => {
  if (!active) return;
  pulses.push({row: tile.row, col: tile.col, strength, start: performance.now()});
  wake();
 };
 const stopIdle = () => {
  if (idleTimer) {
   idleRemaining = Math.max(0, idleDeadline - performance.now());
   clearTimeout(idleTimer);
   idleTimer = 0;
  }
 };
 const scheduleIdle = () => {
  if (!active || idleTimer) return;
  idleDeadline = performance.now() + idleRemaining;
  idleTimer = setTimeout(() => {
   idleTimer = 0;
   ripple(tiles[Math.floor(Math.random() * tiles.length)], .4);
   idleRemaining = 4500 + Math.random() * 2200;
   scheduleIdle();
  }, idleRemaining);
 };
 const updateActivity = () => {
  const next = inView && !document.hidden && !reduced.matches;
  if (next !== active) {
   const now = performance.now();
   active = next;
   if (active) {
    pulses.forEach(pulse => pulse.start += now - pausedAt);
    last = 0;
    wake();
   } else {
    pausedAt = now;
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    stopIdle();
   }
  }
  scheduleIdle();
 };
 tiles.forEach(tile => {
  tile.button.addEventListener('pointerenter', () => {if (!hoverPointer.matches) return; tile.hover = true; wake();});
  tile.button.addEventListener('pointerleave', () => {tile.hover = false; wake();});
  tile.button.addEventListener('focus', () => {tile.focus = true; wake();});
  tile.button.addEventListener('blur', () => {tile.focus = false; wake();});
  tile.button.addEventListener('click', () => ripple(tile, .6));
 });
 demo.classList.add('motion-enabled');
 new IntersectionObserver(entries => {
  inView = entries[0].isIntersecting && entries[0].intersectionRatio >= .35;
  demo.classList.toggle('is-visible', inView || reduced.matches);
  updateActivity();
 }, {threshold: [0, .35]}).observe(viewport);
 document.addEventListener('visibilitychange', updateActivity);
 reduced.addEventListener('change', () => {
  pulses = [];
  tiles.forEach(tile => {tile.level = 0; paint(tile);});
  demo.classList.toggle('is-visible', inView || reduced.matches);
  updateActivity();
 });
 if (reduced.matches) demo.classList.add('is-visible');
})();
