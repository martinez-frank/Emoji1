// v5 — minimal JS: fill hero grid from images/manifest.json and set year
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c) => Object.assign(document.createElement(t), c || {});

function niceLabel(filename) {
  const base = filename.replace(/\.[a-z0-9]+$/i, "");
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

async function loadManifest() {
  try {
    const res = await fetch("images/manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error("manifest missing");
    return await res.json();
  } catch {
    return { stickers: [], pricing: {} };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  const M = await loadManifest();

  // Pricing icons
  const setSrc = (sel, name) => { const img = $(sel); if (img && name) img.src = `images/${name}`; };
  setSrc("[data-price-icon='starter']",  M.pricing?.starter);
  setSrc("[data-price-icon='standard']", M.pricing?.standard);
  setSrc("[data-price-icon='premium']",  M.pricing?.premium);

  // Build hero grid
  const grid = $("#heroGrid");
  const stickers = Array.isArray(M.stickers) ? M.stickers.slice(0, 15) : [];
  const firstNamed = [
    {src: "wink.png", label: "Wink"},
    {src: "laugh.png", label: "Laugh"},
    {src: "ohno.png", label: "Oh no"},
    {src: "smirk.png", label: "Smirk"}
  ];

  const headline = firstNamed.filter(x => stickers.includes(x.src));
  const rest = stickers.filter(s => !headline.find(h => h.src === s))
                       .map(s => ({ src: s, label: "" }));
  const tiles = [...headline, ...rest].slice(0, 15);

  tiles.forEach(({src, label}) => {
    const li = el("li");
    const fig = el("figure");
    const img = el("img", {
      src: `images/${src}`, loading: "lazy", decoding: "async",
      alt: (label || "Frankiemoji example")
    });
    const cap = el("figcaption", { textContent: label || niceLabel(src) });
    img.onerror = () => { cap.textContent = " "; cap.style.visibility = "hidden"; };
    fig.append(img, cap); li.append(fig); grid.append(li);
  });
});
