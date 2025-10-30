/* ========= Configure your images here =========
   Put exact filenames that exist in /images.
   Use whatever you uploaded from the mocks. */

const CAROUSEL_IMAGES = [
  // { src: "world-of-expressions.webp", caption: "A World of Expressions" },
  // Example placeholders — replace with your actual file names:
  { src: "carousel-01.webp", caption: "Wink" },
  { src: "carousel-02.webp", caption: "Laugh" },
  { src: "carousel-03.webp", caption: "Oh no" },
  { src: "carousel-04.webp", caption: "Smirk" }
];

const STICKER_IMAGES = [
  // Simple grid list — add/remove freely
  "sticker-happy.webp",
  "sticker-laugh.webp",
  "sticker-smirk.webp",
  "sticker-omg.webp",
  "sticker-tired.webp",
  "sticker-angry.webp"
];

/* ========= No edits needed below ========= */

// Year
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

// Inject carousel slides & dots
(function initCarousel(){
  const root = document.querySelector('.carousel');
  if (!root) return;

  const track = root.querySelector('.car-track');
  const prev = root.querySelector('.car-btn.prev');
  const next = root.querySelector('.car-btn.next');
  const dotsWrap = root.querySelector('.car-dots');
  const auto = root.dataset.autorotate === 'true';
  const interval = Number(root.dataset.interval || 3500);

  // Build slides
  CAROUSEL_IMAGES.forEach(({src, caption}, i) => {
    const li = document.createElement('li');
    li.className = 'car-slide';

    const fig = document.createElement('figure');
    fig.className = 'polaroid';

    const img = document.createElement('img');
    img.src = `images/${src}`;
    img.alt = caption ? `${caption} Frankiemoji example` : "Frankiemoji example";
    img.loading = "lazy";
    img.decoding = "async";

    const cap = document.createElement('figcaption');
    cap.textContent = caption || "";

    fig.appendChild(img);
    fig.appendChild(cap);
    li.appendChild(fig);
    track.appendChild(li);

    // dot
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', () => go(i));
    dotsWrap.appendChild(dot);
  });

  const slides = Array.from(track.children);
  const dots = Array.from(dotsWrap.children);
  let index = 0, timer = null;

  function go(i){
    index = (i + slides.length) % slides.length;
    const x = -index * 100;
    track.style.transform = `translateX(${x}%)`;
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

  root.addEventListener('mouseenter', () => clearInterval(timer));
  root.addEventListener('mouseleave', restart);
  root.addEventListener('focusin', () => clearInterval(timer));
  root.addEventListener('focusout', restart);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
  });

  restart();
})();

// Inject sticker grid
(function initStickers(){
  const grid = document.querySelector('.sticker-grid');
  if (!grid) return;
  STICKER_IMAGES.forEach(name => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = `images/${name}`;
    img.alt = "Frankiemoji sticker";
    img.loading = "lazy";
    img.decoding = "async";
    li.appendChild(img);
    grid.appendChild(li);
  });
})();
