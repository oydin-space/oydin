(() => {
 const demo = document.querySelector('.logo-grid-demo');
 if (!demo) return;
 const parent = demo.querySelector('.logo-grid-perspective');
 const grid = demo.querySelector('.logo-grid');
 // Static wall: only fit the 3D grid to its container. No ripple, lift or idle motion.
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
})();
