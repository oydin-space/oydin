(() => {
 const nav = document.querySelector('.floating-nav');
 const boundary = document.querySelector('.hero-block, .booking-hero-block') || document.querySelector('.nav');
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 let frame = 0;
 const update = () => {
  frame = 0;
  if (document.body.classList.contains('manifesto-open')) return;
  const shown = boundary.getBoundingClientRect().bottom <= 0;
  nav.classList.toggle('is-shown', shown);
  nav.inert = !shown;
  nav.setAttribute('aria-hidden', String(!shown));
 };
 const queue = () => {if (!frame) frame = requestAnimationFrame(update);};
 addEventListener('scroll', queue, {passive: true});
 addEventListener('resize', queue, {passive: true});
 update();
 const normalizedPath = path => path.endsWith('/') ? path + 'index.html' : path;
 document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || link.target === '_blank') return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || normalizedPath(url.pathname) !== normalizedPath(location.pathname) || url.search !== location.search) return;
  const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
  event.preventDefault();
  if (window.history && url.hash !== location.hash) window.history.pushState(null, "", url.hash || url.pathname + url.search);
  if (window.mooninScroll) {window.mooninScroll.to(target || 0); return;}
  if (target) target.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'start'});
  else window.scrollTo({top: 0, behavior: reduced.matches ? 'instant' : 'smooth'});
 });
})();
