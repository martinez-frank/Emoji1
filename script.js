/* Frankiemoji: animated emoji reels
   - Place your PNGs in /images/ (lowercase)
   - Make sure names and casing match exactly below
   - Hover/touch-hold pauses; swipe works natively; respects reduced motion
*/

const EMOJI = [
  "images/wink.png",
  "images/laugh.png",
  "images/ohno.png",
  "images/smirk.png",
  "images/sleep.png",
  "images/sweat.png",
  "images/shock.png",
  "images/halo.png" // ensure this exists as PNG; remove if not needed
];

// Build one scrolling track inside a .strip container
function buildTrack(hostId) {
  const host = document.getElementById(hostId);
  const track = document.createElement("div");
  track.className = "track";
  host.appendChild(track);

  // Duplicate to exceed 2x width (seamless loop)
  const order = [...EMOJI, ...EMOJI, ...EMOJI];
  order.forEach((name, i) => {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = `images/${name}`;
    img.alt = `Frankiemoji ${i + 1}`;

    // Log missing files to console to help debugging
    img.onerror = () => console.warn(`Image not found: images/${name}`);

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
    strip.addEventListener("touchstart", () => {
      touching = true; tk().style.animationPlayState = "paused";
    }, {passive:true});
    ["touchend","touchcancel"].forEach(evt =>
      strip.addEventListener(evt, () => {
        if (touching){ tk().style.animationPlayState = "running"; touching = false; }
      }, {passive:true})
    );
  });
}

document.addEventListener("DOMContentLoaded", init);
