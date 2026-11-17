// Shared, once-only entrances. Content stays visible when scripting is unavailable.
(() => {
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 if (!('IntersectionObserver' in window)) return;
 const groups = new Map(), animations = new Set();
 const group = (root, selectors) => {
  if (!root) return;
  const items = selectors.flatMap(([selector, delay]) =>
   [...root.querySelectorAll(selector)].map((el, i) => ({el, delay: delay + i * 60})));
  if (items.length) groups.set(root, items);
 };
 group(document.querySelector('.hero'), [[':scope > .eyebrow', 0], [':scope > h1', 80], [':scope > .intro', 160], [':scope > .button', 240]]);
 document.querySelectorAll('.section-heading').forEach(root => group(root, [['h2', 0], ['p', 80]]));
 document.querySelectorAll('.split-copy').forEach(root => group(root, [['h2', 0], [':scope > div > p', 80], ['.benefits li', 160], [':scope > .button', 340]]));
 document.querySelectorAll('.step-card').forEach(root => group(root, [['.step-visual', 0], ['h3', 80], [':scope > p', 160]]));
 document.querySelectorAll('.closing-copy').forEach(root => group(root, [['.cta-proof', 0], ['h2', 80], ['.cta-action-row', 160]]));
 group(document.querySelector('.booking-heading'), [['h1', 0], ['p', 80], ['.button', 160]]);
 document.querySelectorAll('.product-panel, .parallax-visual, .quote-carousel, .faq-item, .footer-top, .question-demo > h2').forEach(el => groups.set(el, [{el, delay: 0}]));
 document.querySelectorAll('.intro-statement, .category-window, .stories-window').forEach(el => groups.set(el, [{el, delay:0}]));
 // Blog entrances reuse the site's once-only reveal timing and reduced-motion handling.
 const blog = document.querySelector('.blog-index-page');
 if (blog) {
  group(blog.querySelector('.blog-intro'), [['h1', 0], ['p', 100]]);
  group(blog.querySelector('.blog-feature'), [[':scope > .post-cover-art', 0], [':scope > .blog-card-copy', 120]]);
  const heading = blog.querySelector('.blog-index > h2');
  if (heading) groups.set(heading, [{el:heading, delay:0}]);
  blog.querySelectorAll('.blog-index .blog-card').forEach((el, index) =>
   groups.set(el, [{el, delay:innerWidth > 800 ? (index % 3) * 100 : 0}]));
 }
 const post = document.querySelector('.blog-post-page');
 if (post) {
  group(post.querySelector('.post-header'), [['.post-breadcrumb', 0], ['h1', 80], ['.post-dek', 160], ['.post-meta', 240]]);
  group(post.querySelector('.post-cover'), [[':scope > .post-cover-art', 0], ['figcaption', 100]]);
  post.querySelectorAll('.post-related .blog-card').forEach((el, index) =>
   groups.set(el, [{el, delay:innerWidth > 800 ? (index % 3) * 100 : 0}]));
 }
 const pending = new Set();
 groups.forEach(items => items.forEach(({el}) => {
  pending.add(el);
  if (!reduced.matches) el.classList.add('entrance-pending');
 }));
 const revealEntries = entries => {
  entries.forEach(({target, isIntersecting}) => {
   if (!isIntersecting) return;
   (target.matches('.footer-top') ? footerReveal : reveal).unobserve(target);
   groups.get(target).forEach(({el, delay}) => {
    pending.delete(el);
    el.classList.remove('entrance-pending');
    if (reduced.matches) return;
    const imageCard = el.matches('.step-visual, .parallax-visual, .product-panel, .blog-feature > .post-cover-art, .post-cover > .post-cover-art, .blog-index .blog-card, .post-related .blog-card');
    // WAAPI keeps existing component transforms and transitions independent.
    const animation = el.animate([
     {opacity: 0, translate: imageCard ? '0 32px' : '0 18px', scale: imageCard ? '.96' : '1'},
     {opacity: 1, translate: '0 0', scale: '1'}
    ], {duration: imageCard ? 1000 : 800, delay, easing: 'cubic-bezier(.25,.1,.25,1)', fill: 'backwards'});
    animations.add(animation);
    animation.onfinish = animation.oncancel = () => animations.delete(animation);
   });
  });
 };
 const reveal = new IntersectionObserver(revealEntries, {threshold: 0, rootMargin: `0px 0px -${Math.round(innerHeight * .35)}px 0px`});
 // The page can end before a footer reaches the inset trigger on tall screens.
 // Observe the full viewport so footer content never waits for unavailable scroll.
 const footerReveal = new IntersectionObserver(revealEntries, {threshold: 0});
 groups.forEach((_, root) => {
  // Article heroes enter on page load, including a cover below the viewport.
  // Reading content is never included in these entrance groups.
  if (root.matches('.blog-post-page .post-header, .blog-post-page .post-cover')) {
   revealEntries([{target:root, isIntersecting:true}]);
  } else {
   (root.matches('.footer-top') ? footerReveal : reveal).observe(root);
  }
 });
 const skies = [...document.querySelectorAll('.hero-dawn, .dawn-cta .closing-inner')];
 const visibleSkies = new Set();
 const updateSkies = () => skies.forEach(el => el.classList.toggle('dawn-moving', visibleSkies.has(el) && !document.hidden && !reduced.matches));
 const skyObserver = new IntersectionObserver(entries => {
  entries.forEach(({target, isIntersecting}) => isIntersecting ? visibleSkies.add(target) : visibleSkies.delete(target));
  updateSkies();
 });
 skies.forEach(el => skyObserver.observe(el));
 document.addEventListener('visibilitychange', updateSkies);
 reduced.addEventListener('change', () => {
  if (reduced.matches) {
   animations.forEach(animation => animation.cancel());
   pending.forEach(el => el.classList.remove('entrance-pending'));
  }
  updateSkies();
 });
 // Keyboard navigation should never wait for an entrance to finish.
 document.addEventListener('focusin', event => {
  pending.forEach(el => { if (el.contains(event.target)) el.classList.remove('entrance-pending'); });
  animations.forEach(animation => {
   if (animation.effect.target.contains(event.target)) animation.cancel();
  });
 });
})();
