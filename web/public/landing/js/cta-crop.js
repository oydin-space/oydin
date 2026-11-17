(() => {
 const cards = [...document.querySelectorAll('.dawn-cta .closing-inner')];
 if (!cards.length) return;
 const mobile = matchMedia('(max-width:800px)');
 const image = new Image();
 // Center of the large truck in the supplied photograph, as a fraction of width.
 const truckCenterX = .744;
 const update = () => cards.forEach(card => {
  if (!mobile.matches) {card.style.removeProperty('background-position');return;}
  if (!image.naturalWidth) return;
  const {width, height} = card.getBoundingClientRect();
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const imageWidth = image.naturalWidth * scale;
  const difference = width - imageWidth;
  const position = Math.abs(difference) < .01 ? .5 : (width / 2 - imageWidth * truckCenterX) / difference;
  card.style.backgroundPosition = `${Math.max(0, Math.min(1, position)) * 100}% center`;
 });
 image.addEventListener('load', update);
 image.src = '/landing/assets/cta-bg.webp';
 const observer = new ResizeObserver(update);
 cards.forEach(card => observer.observe(card));
 mobile.addEventListener('change', update);
})();
