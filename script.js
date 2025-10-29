/* Frankiemoji: animated emoji reels
   - Add your image filenames to EMOJI below (stored in /images).
   - Rows auto-duplicate to create a seamless infinite scroll.
   - Hover or touch-hold pauses; swipe works natively on mobile. */

const EMOJI = [
  // put your real filenames here (case-sensitive) in /images/
  "wink.png", "laugh.png", "ohno.png", "smirk.png",
  "halo.png", "sweat.png", "shock.png", "sleep.png"
];

// utility: create one card <div><img/></div>
const makeCard = (src, alt = "Frankiemoji") => {
  const card = document.createElement("div");
  card.className = "card";
  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = `images/${src}`;
  img.alt = alt;
  card.appendChild(img);
  return card;
};

// build a scrolling track that’s at least 2x container width
const buildTrack = (hostId) => {
  const host = document.getElementById(hostId);
  const track = document.createElement("div");
  track.className = "track";
  host.appendChild(track);

  // at least two loops worth for smoothness
  const order = [...EMOJI, ...EMOJI, ...EMOJI];
  order.forEach((name, i) => track.appendChild(makeCard(name, `Emoji ${i+1}`)));
};

const init = () => {
  buildTrack("rowA");
  buildTrack("rowB");

  // pause on touch-hold
  document.querySelectorAll(".strip").forEach(s => {
    let touching = false;
    s.addEventListener("touchstart", () => { touching = true; s.querySelector(".track").style.animationPlayState = "paused"; }, {passive:true});
    ["touchend","touchcancel"].forEach(evt =>
      s.addEventListener(evt, () => { if (touching) { s.querySelector(".track").style.animationPlayState = "running"; touching = false; } })
    );
  });
};

document.addEventListener("DOMContentLoaded", init);
