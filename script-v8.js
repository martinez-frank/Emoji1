/* Frankiemoji homepage logic (v8.0)
   - Loads emoji images from /images
   - GitHub API -> manifest.json fallback -> tiny built-in fallback
   - Excludes pricing images
   - Randomizes order
   - Slow, opposing marquee rows
   - Adds explicit class + width/height to prevent sizing regressions
*/

(function(){
  const CONF = window.FJ_CONF || {};
  const OWNER  = CONF.owner  || "martinez-frank";
  const REPO   = CONF.repo   || "Emoji1";
  const BRANCH = CONF.branch || "main";
  const EXCLUDE = (CONF.exclude || ["starter","standard","premium"]).map(s => s.toLowerCase());
  const EXTRA_EXCLUDE = [/\.ds_store/i, /manifest/i, /_$/, /%20/]; // extra safety

  const topEl = document.getElementById("marquee-top");
  const btmEl = document.getElementById("marquee-btm");
  if (!topEl || !btmEl) return;

  const containsExcluded = (nameOrPath) => {
    const s = (nameOrPath || "").toLowerCase();
    return EXCLUDE.some(x => s.includes(x)) || EXTRA_EXCLUDE.some(rx => rx.test(s));
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
    const loop = urls.concat(urls); // duplicate for seamless scroll
    loop.forEach(src => {
      const img = new Image();
      img.className = "marq-img";       // explicit class for CSS
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = "Frankiemoji expression";
      img.src = src;

      // Belt & suspenders: lock size even if CSS fails
      img.width = 128;
      img.height = 128;

      img.onerror = () => {
        console.warn("[Frankiemoji] Skipping broken image:", src);
        img.remove();
      };
      frag.appendChild(img);
    });
    return frag;
  };

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
    try {
      const res = await fetch("images/manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      const files = await res.json();
      return files.filter(x => /\.(png|jpe?g|webp|gif)$/i.test(x) && !containsExcluded(x));
    } catch {
      return [];
    }
  }

  async function getEmojiList() {
    try {
      const gh = await listFromGitHub();
      if (gh.length) return gh;
    } catch (e) {
      console.warn("[Frankiemoji] GitHub API list failed, using manifest.json", e);
    }
    const mf = await listFromManifest();
    if (mf.length) return mf;
    return [
      "images/e01.png","images/e02.png","images/e03.png","images/e04.png"
    ];
  }

  (async () => {
    let urls = await getEmojiList();
    urls = shuffle([...new Set(urls)]);

    topEl.appendChild(buildTrack(urls));
    btmEl.appendChild(buildTrack([...urls].reverse()));

    // Slow to ~1/3 speed (can tweak here)
    topEl.style.animationDuration = (54 + Math.random() * 2).toFixed(2) + "s";
    btmEl.style.animationDuration = (57 + Math.random() * 2).toFixed(2) + "s";

    // Pause on hover
    document.querySelectorAll(".marquee").forEach(m => {
      m.addEventListener("mouseenter", () => (m.style.animationPlayState = "paused"));
      m.addEventListener("mouseleave", () => (m.style.animationPlayState = "running"));
    });

    console.log(`[Frankiemoji] Loaded ${urls.length} emojis (v8.0).`);
  })();
})();
