async function loadManifest() {
  try {
    const r = await fetch('images/manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('No manifest');
    return await r.json();
  } catch {
    // Fallback (empty)
    return { hero: null, carousel: [], stickers: [], pricing: {} };
  }
}

// Year
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

(async function init() {
  const M = await loadManifest();

  // --- Hero image (optional) ---
  const heroImg = document.querySelector('.hero-art img');
  if (heroImg && M.hero) heroImg.src = `images/${M.hero}`;

  // --- Pricing icons (optional) ---
  const priceStarter = document.querySelector('[data-price-icon="starter"]');
  const priceStandard = document.querySelector('[data-price-icon="standard"]');
  const pricePremium = document.querySelector('[data-price-icon="premium"]');
  if (priceStarter && M.pricing?.starter)   priceStarter.src   = `images/${M.pricing.starter}`;
  if (priceStandard && M.pricing?.standard) priceStandard.src = `images/${M.pricing.standard}`;
  if (pricePremium && M.pricing?.premium)   pricePremium.src   = `images/${M.pricing.premium}`;

  // --- Carousel ---
  const carRoot  = document.querySelector('.carousel');
  const track    = carRoot?.querySelector('.car-track');
  const prev     = carRoot?.querySelector('.car-btn.prev');
  const next     = carRoot?.querySelector('.car-btn.next');
  const dotsWrap = carRoot?.querySelector('.car-dots');
  if (carRoot && track && prev && next && dotsWrap) {
    const auto = carRoot.dataset.autorotate === 'true';
    const interval = Number(carRoot.dataset.interval || 3500);

    // build slides
    (M.carousel || []).forEach(({ src, caption }, i) => {
      const li = document.createElement('li');
      li.className = 'car-slide';
      const fig = document.createElement('figure');
      fig.className = 'polaroid';
      const img = document.createElement('img');
      img.src = `images/${src}`;
      img.alt = caption ? `${caption} Frankiemoji example` : 'Frankiemoji example';
      img.loading = 'lazy'; img.decoding = 'async';
      const cap = document.createElement('figcaption');
      cap.textContent = caption || '';
      fig.append(img, cap); li.append(fig); track.append(li);

      const dot = document.createElement('button');
      dot.type = 'button'; dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => go(i));
      dotsWrap.appendChild(dot);
    });

    const slides = Array.from(track.children);
    const dots = Array.from(dotsWrap.children);
    let index = 0, timer = null;

    function go(i){
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(${-index * 100}%)`;
      dots.forEach((d,k)=>d.setAttribute('aria-selected', k===index ? 'true':'false'));
      restart();
    }
    function nextSlide(){ go(index + 1); }
    function prevSlide(){ go(index - 1); }

    next.addEventListener('click', nextSlide);
    prev.addEventListener('click', prevSlide);

    function restart(){
      if (!auto || !slides.length) return;
      clearInterval(timer); timer = setInterval(nextSlide, interval);
    }
    carRoot.addEventListener('mouseenter', () => clearInterval(timer));
    carRoot.addEventListener('mouseleave', restart);
    carRoot.addEventListener('focusin', () => clearInterval(timer));
    carRoot.addEventListener('focusout', restart);
    carRoot.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    });
    restart();
  }

  // --- Stickers grid ---
  const grid = document.querySelector('.sticker-grid');
  if (grid && Array.isArray(M.stickers)) {
    M.stickers.forEach(name => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = `images/${name}`; img.alt = 'Frankiemoji sticker';
      img.loading = 'lazy'; img.decoding = 'async';
      li.appendChild(img); grid.appendChild(li);
    });
  }
})();
