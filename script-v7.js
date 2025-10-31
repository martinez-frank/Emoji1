/* Frankiemoji homepage logic (v7.3)
   - Loads emoji images from /images
   - Tries GitHub API first; falls back to /images/manifest.json
   - Excludes any file containing: starter, standard, premium (case-insensitive)
   - Randomizes order each load
   - Slower scroll with subtle per-row variation
*/

(function(){
  const CONF = window.FJ_CONF || {};
  const OWNER  = CONF.owner  || "martinez-frank";
  const REPO   = CONF.repo   || "Emoji1";
  const BRANCH = CONF.branch || "main";
  const EXCLUDE = (CONF.exclude || ["starter","standard","premium"]).map(s => s.toLowerCase());

  const topEl = document.getElementById("marquee-top");
  const btmEl = document.getElementById("marquee-btm");
  if (!topEl || !btmEl) return;

  // ---------- helpers ----------
  const containsExcluded = (nameOrPath) => {
    const s = (nameOrPath || "").toLowerCase();
    return EXCLUDE.some(x => s.includes(x));
  };

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const buildTrack = (urls) => {
    const frag = document.createDocumentFragment();
    const loop = urls.concat(urls); // seamless
    loop.forEach(src => {
      const img = new Image();
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = "Frankiemoji expression";
      img.src = src;
      frag.appendChild(img);
    });
    return frag;
  };

  // ---------- data sources ----------
  async function listFromGitHub() {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/images?ref=${BRANCH}`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items = await res.json();
    return items
      .filter(it => it.type === "file")
      .filter(it => /\.(png|jpe?g|webp|gif)$/i.test(it.name))
      .filter(it => !containsExcluded(it.name) && !containsExcluded(it.path))
      .map(it => it.download_url);
  }

  async function listFromManifest() {
    // Local fallback you control
    const res = await fetch("images/manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`manifest.json ${res.status}`);
    const files = await res.json(); // ["images/a.png","images/b.png",...]
    return files
      .filter(x => /\.(png|jpe?g|webp|gif)$/i.test(x))
      .filter(x => !containsExcluded(x));
  }

  async function getEmojiList() {
    try {
      const gh = await listFromGitHub();
      if (gh.length) return gh;
    } catch (e) {
      console.warn("[Frankiemoji] GitHub API list failed, using manifest.json", e);
    }
    try {
      const mf = await listFromManifest();
      if (mf.length) return mf;
    } catch (e) {
      console.warn("[Frankiemoji] manifest.json fallback failed", e);
    }
    // Final minimal fallback – prevents blank UI
    return [
      "images/e01.png","images/e02.png","images/e03.png",
      "images/e04.png","images/e05.png","images/e06.png"
    ].filter(x => !containsExcluded(x));
  }

  // ---------- run ----------
  (async () => {
    let urls = await getEmojiList();
    urls = shuffle([...new Set(urls)]); // unique + random

    // Build rows
    topEl.appendChild(buildTrack(urls));
    btmEl.appendChild(buildTrack([...urls].reverse()));

    // Natural speed variance
    topEl.style.animationDuration = (18 + Math.random() * 2).toFixed(2) + "s";
    btmEl.style.animationDuration = (19.5 + Math.random() * 2).toFixed(2) + "s";

    // Pause on hover
    document.querySelectorAll(".marquee").forEach(m => {
      m.addEventListener("mouseenter", () => (m.style.animationPlayState = "paused"));
      m.addEventListener("mouseleave", () => (m.style.animationPlayState = "running"));
    });

    console.log("[Frankiemoji] Loaded emojis:", urls);
  })();
})();
