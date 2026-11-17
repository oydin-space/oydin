(() => {
 const items = [...document.querySelectorAll('.faq-item')];
 items.forEach(item => {
  const toggle = item.querySelector('.faq-toggle');
  const initiallyOpen = item.classList.contains('is-open');
  toggle.setAttribute('aria-expanded', String(initiallyOpen));
  const initialAnswer = item.querySelector('.faq-answer');
  initialAnswer.setAttribute('aria-hidden', String(!initiallyOpen));
  initialAnswer.inert = !initiallyOpen;
  toggle.addEventListener('click', event => {
   items.forEach(row => row.classList.toggle('instant-motion', event.detail === 0));
   const open = toggle.getAttribute('aria-expanded') !== 'true';
   items.forEach(row => {
    const expanded = row === item && open;
    row.classList.toggle('is-open', expanded);
    row.querySelector('.faq-toggle').setAttribute('aria-expanded', String(expanded));
    const answer = row.querySelector('.faq-answer');
    answer.setAttribute('aria-hidden', String(!expanded));
    answer.inert = !expanded;
   });
  });
 });
})();
