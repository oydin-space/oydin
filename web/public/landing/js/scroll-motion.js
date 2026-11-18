(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const statement = document.querySelector('.intro-statement');
  const words = statement ? [...statement.querySelectorAll('.reading-word')] : [];
  let frame = 0;
  const updateScroll = () => {
    frame = 0;
    if (!statement || document.body.classList.contains('manifesto-open')) return;
    const box = statement.getBoundingClientRect();
    const start = innerHeight * .8;
    const end = innerHeight * .3 - box.height * .5;
    const progress = Math.max(0, Math.min(1, (start - box.top) / (start - end)));
    words.forEach((word, i) => word.classList.toggle('is-read', reduced.matches || progress >= (i + 1) / words.length));
  };
  const requestScroll = () => { if (!frame) frame = requestAnimationFrame(updateScroll); };
  addEventListener('scroll', requestScroll, {passive: true});
  addEventListener('resize', requestScroll, {passive: true});
  reduced.addEventListener('change', requestScroll);
  updateScroll();

  const track = document.querySelector('.category-track');
  const group = track && track.querySelector('.category-group');
  if (track && group) {
    const copy = group.cloneNode(true);
    copy.removeAttribute('role');
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('[role]').forEach(el => el.removeAttribute('role'));
    track.append(copy);
    const sizeMarquee = () => {
      const width = group.getBoundingClientRect().width + 16;
      const copies = Math.max(2, Math.ceil(track.parentElement.clientWidth / width) + 1);
      while (track.children.length < copies) track.append(copy.cloneNode(true));
      while (track.children.length > copies) track.lastElementChild.remove();
      track.style.setProperty('--marquee-width', `${width}px`);
      track.style.setProperty('--marquee-duration', `${width / 24}s`);
    };
    new ResizeObserver(sizeMarquee).observe(group);
    sizeMarquee();
  }
  const visibleLoops = new Set();
  const loops = track ? [track] : [];
  const updateLoops = () => loops.forEach(el => el.classList.toggle('motion-running', visibleLoops.has(el) && !document.hidden && !reduced.matches));
  const loopObserver = new IntersectionObserver(entries => {
    entries.forEach(({target, isIntersecting}) => isIntersecting ? visibleLoops.add(target) : visibleLoops.delete(target));
    updateLoops();
  });
  loops.forEach(el => loopObserver.observe(el));
  document.addEventListener('visibilitychange', updateLoops);
  reduced.addEventListener('change', updateLoops);

  const entrance = new IntersectionObserver(entries => {
    entries.forEach(({target, isIntersecting}) => {
      if (!isIntersecting) return;
      target.classList.add('has-entered');
      entrance.unobserve(target);
    });
  }, {threshold: 0, rootMargin: '0px 0px -25% 0px'});
  document.querySelectorAll('.reading-attachment').forEach(el => {
    if (!reduced.matches) el.classList.add('motion-pending');
    entrance.observe(el);
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.querySelectorAll('.motion-pending').forEach(el => el.classList.add('has-entered'));
  });
})();
