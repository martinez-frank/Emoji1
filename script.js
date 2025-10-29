/* Frankiemoji: animated emoji reels
   - Put your emoji PNGs into /images/
   - Update the EMOJI array names to match your files exactly (case-sensitive)
   - Hover or touch-hold pauses animation; swipe works natively */

const EMOJI = [
  "wink.png", "laugh.png", "ohno.png", "smirk.png",
  "halo.png", "sweat.png", "shock.png", "sleep.png"
];

// Build one scrolling track inside a .strip container
function buildTrack(hostId) {
  const host = document.getElementById(hostId);
  const track = document.createElement("div");
  track.className = "track";
  host.appendChild(track);

  // Duplicate images to exceed 2x width (for seamless loop)
  const order = [...EMOJI, ...EMOJI, ...EMOJI];
  order.forEach((name, i) => {
    const card = document.createElement("div");
    card.className = "card";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = `images/${name}`;
    img.alt = `Frankiemoji ${i + 1}`;
    card.appendChild(img);
    track.appendChild(card);
  });
}

function init() {
  buildTrack("rowA");
  buildTrack("rowB");

  // Touch-hold pause for mobile
  document.querySelectorAll(".strip").forEach(strip => {
    let touching = false;
    const tk = () => strip.querySelector(".track");
    strip.addEventListener("touchstart", () => { touching = true; tk().style.animationPlayState = "paused"; }, {passive:true});
    ["touchend","touchcancel"].forEach(evt =>
      strip.addEventListener(evt, () => { if (touching){ tk().style.animationPlayState="running"; touching=false; }}, {passive:true})
    );
  });
}

document.addEventListener("DOMContentLoaded", init);
