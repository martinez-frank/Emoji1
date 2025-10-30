// v6 — build two rows, no captions; pricing images set from manifest
const $ = (s, r=document) => r.querySelector(s);
const el = (t, c) => Object.assign(document.createElement(t), c||{});

async function loadManifest(){
  try {
    const res = await fetch("images/manifest.json", {cache:"no-store"});
    if(!res.ok) throw new Error("missing manifest");
    return await res.json();
  } catch {
    return {stickers:[], pricing:{}};
  }
}

function buildRow(list, container){
  // Duplicate once so the marquee loop looks continuous
  const doubled = [...list, ...list];
  doubled.forEach(name=>{
    const li = el("li");
    const img = el("img", {src:`images/${name}`, alt:"Frankiemoji example", loading:"lazy", decoding:"async"});
    img.onerror = ()=>{ img.style.visibility="hidden"; };
    li.append(img); container.append(li);
  });
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  const M = await loadManifest();

  // Pricing icons (if you rename art files, just update manifest.json)
  const setIcon = (sel, file) => { const i=$(sel); if(i && file) i.src = `images/${file}`; };
  setIcon("[data-price-icon='starter']",  M.pricing?.starter);
  setIcon("[data-price-icon='standard']", M.pricing?.standard);
  setIcon("[data-price-icon='premium']",  M.pricing?.premium);

  // Two rows, split the sticker set
  const stickers = Array.isArray(M.stickers) ? M.stickers.slice() : [];
  if(stickers.length === 0) return;

  const half = Math.ceil(stickers.length/2);
  const rowAList = stickers.slice(0, half);
  const rowBList = stickers.slice(half);

  buildRow(rowAList, $("#rowA"));
  buildRow(rowBList.length ? rowBList : rowAList, $("#rowB"));
});
