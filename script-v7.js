/*  Frankiemoji homepage logic (v7.1)
    - Fetches images in /images via GitHub API
    - EXCLUDES starter.png, standard.png, premium.png from marquee
    - Shuffles emoji order (random each load)
    - Slower, more natural scroll with slight per-row variation
*/

(async function(){
  const owner  = window.GITHUB_OWNER || "martinez-frank";
  const repo   = window.GITHUB_REPO  || "Emoji1";
  const branch = window.GITHUB_BRANCH || "main";

  const BLACKLIST = /^(starter|standard|premium)\.(png|jpg|jpeg|webp|gif)$/i;

  async function fetchImages() {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/images?ref=${branch}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' }});
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const files = data.filter(f =>
        /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name) && !BLACKLIST.test(f.name)
      );
      return files.map(f => f.download_url);
    } catch (e) {
      console.warn("Could not list /images via GitHub API. Falling back to static names.", e);
      // Fallback: e01..e20.png (still excludes obvious pricing images if present)
      const guess = Array.from({length: 20}, (_,i)=>`images/e${String(i+1).padStart(2,"0")}.png`);
      return guess.filter(src => !BLACKLIST.test(src.split("/").pop() || ""));
    }
  }

  function shuffle(arr) {
    // Fisher–Yates
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildTrack(urls) {
    const frag = document.createDocumentFragment();
    // duplicate once for seamless loop
    const loop = urls.concat(urls);
    loop.forEach((src) => {
      const img = new Image();
      img.loading = "lazy";
      img.alt = "Frankiemoji expression";
      img.src = src;
      frag.appendChild(img);
    });
    return frag;
  }

  const urls = await fetchImages();
  const unique = Array.from(new Set(urls));
  shuffle(unique); // random order every load

  const top = document.getElementById("marquee-top");
  const btm = document.getElementById("marquee-btm");

  if (top && btm) {
    // Build rows
    top.appendChild(buildTrack(unique));
    btm.appendChild(buildTrack([...unique].reverse()));

    // Slow down + slight variation per row (16–20s)
    const durTop = (16 + Math.random() * 2).toFixed(2) + "s";
    const durBtm = (18 + Math.random() * 2).toFixed(2) + "s";
    top.style.animationDuration = durTop;
    btm.style.animationDuration = durBtm;
  }

  // Pause on hover
  document.querySelectorAll('.marquee').forEach(m =>
    m.addEventListener('mouseenter', ()=> m.style.animationPlayState='paused')
  );
  document.querySelectorAll('.marquee').forEach(m =>
    m.addEventListener('mouseleave', ()=> m.style.animationPlayState='running')
  );
})();
