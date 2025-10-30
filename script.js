async function loadManifest() {
  try {
    const r = await fetch('images/manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('No manifest');
    return await r.json();
  } catch {
    return { hero: null, carousel: [], stickers: [], pricing: {} };
  }
}
const shuffle = arr => arr.sort(()=>Math.random()-0.5);

document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

(async function init() {
  const M = await loadManifest();

  const setSrc = (sel, name) => {
    const el = document.querySelector(sel);
    if (el && name) el.src = `images/${name}`;
  };
  setSrc('[data-price-icon="starter"]',  M.pricing?.starter);
  setSrc('[data-price-icon="standard"]', M.pricing?.standard);
  setSrc('[data-price-icon="premium"]',  M.pricing?.premium);

  let carList = Array.isArray(M.carousel) ? M.carousel.slice() : [];
  if (M.carousel === '*stickers' || !carList.length) {
    carList = (M.stickers || []).map(s => ({ src: s, caption: '' }));
  }
  carList = shuffle(carList);

  const root  = document.querySelector('.carousel');
  const track = root?.querySelector('.car-track');
  const prev  = root?.querySelector('.car-btn.prev');
  const next  = root?.querySelector('.car-btn.next');
  const dotsW = root?.querySelector('.car-dots');

  if (root && track && prev && next && dotsW) {
    const auto = root.dataset.autorotate === 'true';
    const interval = Number(root.dataset.interval || 3500);

    carList.forEach(({ src, caption }, i) => {
      const li  = document.createElement('li'); li.className = 'car-slide';
      const fig = document.createElement('figure'); fig.className = 'polaroid';
      const img = document.createElement('img');
      img.src = `images/${src}`;
      img.alt = caption ? `${caption} Frankiemoji example` : 'Frankiemoji example';
      img.loading = 'lazy'; img.decoding = 'async';
      img.onerror = () => console.warn('[missing image]', img.src);
      const cap = document.createElement('figcaption'); cap.textContent = caption || '';
      fig.append(img, cap); li.append(fig); track.append(li);

      const dot = document.createElement('button');
      dot.type='button'; dot.setAttribute('role','tab');
      dot.setAttribute('aria-selected', i===0 ? 'true':'false');
      dot.addEventListener('click', ()=>go(i));
      dotsW.appendChild(dot);
    });

    const slides = Array.from(track.children);
    const dots   = Array.from(dotsW.children);
    let index = 0, timer = null;

    function go(i){
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(${-index*100}%)`;
      dots.forEach((d,k)=>d.setAttribute('aria-selected', k===index ? 'true':'false'));
      restart();
    }
    function nextSlide(){ go(index+1); }
    function prevSlide(){ go(index-1); }
    next.addEventListener('click', nextSlide);
    prev.addEventListener('click', prevSlide);

    function restart(){
      if (!auto || !slides.length) return;
      clearInterval(timer); timer = setInterval(nextSlide, interval);
    }
    root.addEventListener('mouseenter', ()=>clearInterval(timer));
    root.addEventListener('mouseleave', restart);
    root.addEventListener('focusin',   ()=>clearInterval(timer));
    root.addEventListener('focusout',  restart);
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft')  prevSlide();
    });
    restart();
  }

  const grid = document.querySelector('.sticker-grid');
  if (grid && Array.isArray(M.stickers)) {
    M.stickers.forEach(name => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = `images/${name}`;
      img.alt = 'Frankiemoji sticker';
      img.loading = 'lazy'; img.decoding = 'async';
      img.onerror = () => console.warn('[missing sticker]', img.src);
      li.appendChild(img); grid.appendChild(li);
    });
  }
})();