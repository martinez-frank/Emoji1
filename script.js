// Year in footer
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

// Accessible, auto-rotating carousel
(function initCarousel(){
  const root = document.querySelector('.carousel');
  if (!root) return;

  const track = root.querySelector('.car-track');
  const slides = Array.from(root.querySelectorAll('.car-slide'));
  const prev = root.querySelector('.car-btn.prev');
  const next = root.querySelector('.car-btn.next');
  const dotsWrap = root.querySelector('.car-dots');
  const auto = root.dataset.autorotate === 'true';
  const interval = Number(root.dataset.interval || 3500);

  let index = 0;
  let timer = null;

  // Build dots
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.addEventListener('click', () => go(i));
    dotsWrap.appendChild(b);
  });

  const dots = Array.from(dotsWrap.children);

  function go(i){
    index = (i + slides.length) % slides.length;
    const x = -index * 100;
    track.style.transform = `translateX(${x}%)`;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === index));
    dots.forEach((d, k) => d.setAttribute('aria-selected', k === index ? 'true' : 'false'));
    restart();
  }

  function nextSlide(){ go(index + 1); }
  function prevSlide(){ go(index - 1); }

  next.addEventListener('click', nextSlide);
  prev.addEventListener('click', prevSlide);

  function restart(){
    if (!auto) return;
    clearInterval(timer);
    timer = setInterval(nextSlide, interval);
  }

  // Pause on hover/focus for a11y
  root.addEventListener('mouseenter', () => clearInterval(timer));
  root.addEventListener('mouseleave', restart);
  root.addEventListener('focusin', () => clearInterval(timer));
  root.addEventListener('focusout', restart);

  // Keyboard arrows
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  });

  restart();
})();
