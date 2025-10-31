/*  Frankiemoji homepage logic (v7)
    - Dynamically fetches ALL images inside /images via GitHub API
    - Builds two marquee rows that scroll in opposite directions
    - Keeps old code intact by using new files (v7) */

(async function(){
  const owner  = window.GITHUB_OWNER || "martinez-frank";
  const repo   = window.GITHUB_REPO  || "Emoji1";
  const branch = window.GITHUB_BRANCH || "main";

  async function fetchImages() {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/images?ref=${branch}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' }});
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const files = data.filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
      // Prefer download_url to avoid raw.githubusercontent throttling
      return files.map(f => f.download_url);
    } catch (e) {
      console.warn("Could not list /images via GitHub API. Falling back to static names.", e);
      // Fallback: try e01..e20.png in /images
      const guess = Array.from({length: 20}, (_,i)=>`images/e${String(i+1).padStart(2,"0")}.png`);
      return guess;
    }
  }

  function buildTrack(urls) {
    const frag = document.createDocumentFragment();
    // duplicate once for seamless loop
    const loop = urls.concat(urls);
    loop.forEach((src, i) => {
      const img = new Image();
      img.loading = "lazy";
      img.alt = "Frankiemoji expression";
      img.src = src;
      frag.appendChild(img);
    });
    return frag;
  }

  const urls = await fetchImages();

  // If you want exactly 20: slice or shuffle
  const unique = Array.from(new Set(urls));
  const top = document.getElementById("marquee-top");
  const btm = document.getElementById("marquee-btm");

  if (top && btm) {
    top.appendChild(buildTrack(unique));
    btm.appendChild(buildTrack(unique.slice().reverse()));
  }

  // Optional: slow down on hover for delight
  document.querySelectorAll('.marquee').forEach(m =>
    m.addEventListener('mouseenter', ()=> m.style.animationPlayState='paused')
  );
  document.querySelectorAll('.marquee').forEach(m =>
    m.addEventListener('mouseleave', ()=> m.style.animationPlayState='running')
  );
})();
