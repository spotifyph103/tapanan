const API_KEY = '10ad9bd194a61d279df6cef05851c443';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const IMG_BACKDROP = 'https://image.tmdb.org/t/p/w780';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const COLLECTION_IDS = [1241, 295, 10, 119, 86311, 9485, 84, 2344, 528];
let currentItem;
let heroItem = null;

// ---------- Mobile menu ----------
document.addEventListener('DOMContentLoaded', () => {
  applyAdblock();
  updateWlBadge();
  router();
  window.addEventListener('hashchange', router);
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('nav-links');
  const backdrop = document.getElementById('nav-backdrop');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
    if (backdrop) backdrop.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  if (toggle && nav) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenu(!nav.classList.contains('open'));
    });
    if (backdrop) backdrop.addEventListener('click', () => setMenu(false));
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  }
  const navbar = document.getElementById('navbar');
  const onScroll = () => navbar.style.boxShadow = window.scrollY > 8 ? '0 8px 28px rgba(0,0,0,.45)' : 'none';
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('hero-watch').addEventListener('click', () => { if (heroItem) showDetails(heroItem); });
  document.getElementById('hero-info').addEventListener('click', () => { if (heroItem) showDetails(heroItem); });
});

function scrollRow(id, dir) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
}

// ---------- Fetchers ----------
async function getJSON(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch { return null; }
}
const fetchTrendingDay = () => getJSON(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`).then(d => (d && d.results) || []);
const fetchPopularMovies = () => getJSON(`${BASE_URL}/movie/popular?api_key=${API_KEY}`).then(d => (d && d.results) || []);
const fetchNowPlaying = () => getJSON(`${BASE_URL}/movie/now_playing?api_key=${API_KEY}`).then(d => (d && d.results) || []);
const fetchTopRated = () => getJSON(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}`).then(d => (d && d.results) || []);
const fetchPopularTV = () => getJSON(`${BASE_URL}/tv/popular?api_key=${API_KEY}`).then(d => (d && d.results) || []);
const fetchSectionRow = (key) => getJSON(sectionDiscoverURL(key, 'popular', 1)).then(d => (d && d.results) || []);
async function fetchCollections() {
  const out = [];
  for (const id of COLLECTION_IDS) {
    const c = await getJSON(`${BASE_URL}/collection/${id}?api_key=${API_KEY}`);
    if (c && c.id && (c.backdrop_path || c.poster_path)) out.push(c);
  }
  return out;
}

// ---------- Helpers ----------
function yearOf(item) {
  const d = item.release_date || item.first_air_date || '';
  return d ? d.slice(0, 4) : '';
}
function ratingPct(item) {
  return Math.round((item.vote_average || 0) * 10);
}
function ringColor(pct) {
  return pct >= 70 ? '#4caf50' : pct >= 50 ? '#ffca28' : '#f44336';
}
function typeLabel(item) {
  const t = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  return t === 'tv' ? 'TV' : 'Movie';
}

// ---------- Hero ----------
function renderHero(item) {
  heroItem = item;
  const bg = item.backdrop_path ? IMG_ORIGINAL + item.backdrop_path : (item.poster_path ? IMG_ORIGINAL + item.poster_path : '');
  if (bg) document.getElementById('hero-bg').style.backgroundImage = `url(${bg})`;
  document.getElementById('hero-title').textContent = item.title || item.name || '';
  document.getElementById('hero-type').textContent = typeLabel(item);
  document.getElementById('hero-year').textContent = yearOf(item);
  document.getElementById('hero-rating').textContent = ratingPct(item) + '%';
  document.getElementById('hero-overview').textContent = item.overview || '';
}

// ---------- Cards ----------
function makeCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  const pct = ratingPct(item);
  const type = itemType(item);
  const saved = isInWatchlist(item) ? ' saved' : '';
  card.innerHTML =
    '<div class="poster-wrap">' +
      `<img loading="lazy" src="${item.poster_path ? IMG_URL + item.poster_path : ''}" alt="${(item.title || item.name || '').replace(/"/g, '')}">` +
      `<div class="rating-ring" style="--p:${pct};--c:${ringColor(pct)}"><span>${pct}%</span></div>` +
      `<button class="card-bookmark${saved}" data-wl="${type}:${item.id}" aria-label="Toggle watchlist"><i class="fa-solid fa-bookmark"></i></button>` +
    '</div>' +
    `<div class="card-title">${item.title || item.name || ''}</div>` +
    `<div class="card-year">${yearOf(item)}</div>`;
  card.querySelector('.card-bookmark').onclick = (e) => { e.stopPropagation(); toggleWatchlist(item); };
  card.onclick = () => showDetails(item);
  return card;
}
function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.filter(i => i.poster_path).slice(0, 20).forEach(item => container.appendChild(makeCard(item)));
}
function displayCollections(collections) {
  const container = document.getElementById('collections-list');
  container.innerHTML = '';
  collections.forEach(c => {
    const el = document.createElement('div');
    el.className = 'coll-card';
    const img = c.backdrop_path ? IMG_BACKDROP + c.backdrop_path : IMG_URL + c.poster_path;
    const n = (c.parts || []).length;
    el.innerHTML = `<img loading="lazy" src="${img}" alt="${c.name.replace(/"/g, '')}">` +
      `<div class="coll-info"><h4>${c.name}</h4><span>${n} Movie${n === 1 ? '' : 's'}</span></div>`;
    el.onclick = () => showCollection(c.id);
    container.appendChild(el);
  });
}

// ---------- Modals ----------
function openModalEl(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  el.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeModalEl(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.style.display = 'none';
  document.body.style.overflow = '';
}

function showDetails(item) {
  return showDetailsAsync(item);
}

function itemType(it) {
  it = it || currentItem;
  return (it.media_type === 'movie' || it.release_date) ? 'movie' : 'tv';
}

let currentSeason = 1, currentEpisode = 1, tvSeasons = [];

async function showDetailsAsync(item) {
  currentItem = item;
  currentSeason = 1; currentEpisode = 1; tvSeasons = [];
  // reset to item mode
  document.getElementById('modal-server-wrap').style.display = 'flex';
  document.getElementById('modal-video-wrap').style.display = 'block';
  document.getElementById('modal-parts').style.display = 'none';
  document.getElementById('modal-image').style.display = '';

  document.getElementById('modal-title').textContent = item.title || item.name || '';
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = item.poster_path ? IMG_URL + item.poster_path : '';
  document.getElementById('modal-image').alt = item.title || item.name || '';
  const stars = Math.round((item.vote_average || 0) / 2);
  document.getElementById('modal-rating').innerHTML =
    '★'.repeat(stars) + '<span style="color:#444">' + '★'.repeat(Math.max(0, 5 - stars)) + '</span>' +
    ` <span style="color:#9a9aad;font-size:.85rem;letter-spacing:0">${ratingPct(item)}% · ${yearOf(item)}</span>`;
  const epWrap = document.getElementById('modal-episode-wrap');
  if (itemType(item) === 'tv') {
    epWrap.style.display = 'flex';
    await loadSeasons(item.id);
  } else {
    epWrap.style.display = 'none';
  }
  renderServerOptions(itemType(item));
  changeServer();
  document.getElementById('modal-watchlist').style.display = '';
  updateModalWlBtn();
  openModalEl('modal');
}

async function loadSeasons(tmdbId) {
  const seasonSel = document.getElementById('season');
  seasonSel.innerHTML = '<option>Loading…</option>';
  document.getElementById('episode').innerHTML = '<option>1</option>';
  const data = await getJSON(`${BASE_URL}/tv/${tmdbId}?api_key=${API_KEY}`);
  tvSeasons = (data && data.seasons ? data.seasons : []).filter(s => s.episode_count > 0);
  if (!tvSeasons.length) tvSeasons = [{ season_number: 1, episode_count: 1 }];
  seasonSel.innerHTML = '';
  tvSeasons.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.season_number;
    opt.textContent = s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`;
    seasonSel.appendChild(opt);
  });
  currentSeason = parseInt(seasonSel.value, 10);
  fillEpisodes();
}

function fillEpisodes() {
  const epSel = document.getElementById('episode');
  const season = tvSeasons.find(s => s.season_number === currentSeason) || tvSeasons[0];
  const count = season ? season.episode_count : 1;
  epSel.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Episode ${i}`;
    epSel.appendChild(opt);
  }
  currentEpisode = 1;
  epSel.value = '1';
}

function onSeasonChange() {
  currentSeason = parseInt(document.getElementById('season').value, 10);
  fillEpisodes();
  changeServer();
}

function onEpisodeChange() {
  currentEpisode = parseInt(document.getElementById('episode').value, 10);
  changeServer();
}

async function showCollection(id) {
  const c = await getJSON(`${BASE_URL}/collection/${id}?api_key=${API_KEY}`);
  if (!c || !c.id) return;
  document.getElementById('modal-server-wrap').style.display = 'none';
  document.getElementById('modal-episode-wrap').style.display = 'none';
  document.getElementById('modal-video-wrap').style.display = 'none';
  document.getElementById('modal-watchlist').style.display = 'none';
  document.getElementById('modal-image').style.display = '';

  document.getElementById('modal-title').textContent = c.name || '';
  document.getElementById('modal-description').textContent = c.overview || '';
  document.getElementById('modal-image').src = c.poster_path ? IMG_URL + c.poster_path : '';
  document.getElementById('modal-image').alt = c.name || '';
  document.getElementById('modal-rating').innerHTML =
    `<span style="color:#9a9aad;font-size:.9rem;letter-spacing:0">${(c.parts || []).length} Movies</span>`;

  const grid = document.getElementById('modal-parts');
  grid.style.display = 'grid';
  grid.innerHTML = '';
  (c.parts || []).filter(p => p.poster_path).forEach(p => {
    p.media_type = 'movie';
    grid.appendChild(makeCard(p));
  });
  openModalEl('modal');
}

// ---------- AdBlock toggle (iframe sandbox) ----------
let adblockOn = true;
try { adblockOn = localStorage.getItem('tapanan_adblock') !== 'off'; } catch {}
function applyAdblock() {
  const f = document.getElementById('modal-video');
  if (!f) return;
  if (adblockOn) f.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  else f.removeAttribute('sandbox');
  const b = document.getElementById('adblock-toggle');
  if (b) {
    b.textContent = adblockOn ? 'AdBlock: ON' : 'AdBlock: OFF';
    b.classList.toggle('off', !adblockOn);
  }
}
function toggleAdblock() {
  adblockOn = !adblockOn;
  try { localStorage.setItem('tapanan_adblock', adblockOn ? 'on' : 'off'); } catch {}
  applyAdblock();
  if (currentItem) renderServerOptions(itemType(currentItem)); // refresh list: hide/show no-sandbox servers
  changeServer(); // reload current video with the new setting
}

// ---------- Auto-landscape when the video goes fullscreen ----------
(function () {
  if (!window.screen || !screen.orientation || !screen.orientation.lock) return;
  document.addEventListener('fullscreenchange', () => {
    try {
      if (document.fullscreenElement) {
        screen.orientation.lock('landscape').catch(() => {});
      } else if (screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (e) { /* unsupported device; ignore */ }
  });
})();

// ---------- DNS note (NextDNS ad-blocking) ----------
function copyDns(id, btn) {
  const t = document.getElementById(id).textContent.trim();
  const done = () => { const o = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = o; }, 1500); };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done).catch(fallback);
  else fallback();
}
function dismissDnsNote() {
  document.getElementById('dns-note').classList.add('hide');
  try { localStorage.setItem('tapanan_dns_note', 'off'); } catch {}
}
try { if (localStorage.getItem('tapanan_dns_note') === 'off') document.getElementById('dns-note').classList.add('hide'); } catch {}

// ---------- Video servers ----------
// movie: id -> url | tv: (id, season, episode) -> url ; null = not supported for that type
const _embedFam = d => ({
  movie: id => `https://${d}/embed/movie/${id}`,
  tv: (id, s, e) => `https://${d}/embed/tv/${id}/${s}/${e}`
});
const SERVERS = [
  // Recommended
  { group: 'Recommended', id: 'vidlink.pro', name: 'VidLink', movie: id => `https://vidlink.pro/movie/${id}?autoplay=true`, tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true` },
  { group: 'Recommended', id: 'moviesapi.to', name: 'MoviesAPI', movie: id => `https://moviesapi.to/movie/${id}`, tv: (id, s, e) => `https://moviesapi.to/tv/${id}/${s}/${e}` },
  { group: 'Recommended', id: 'vidfast.vc', name: 'VidFast', movie: id => `https://vidfast.vc/movie/${id}?autoPlay=true`, tv: (id, s, e) => `https://vidfast.vc/tv/${id}/${s}/${e}?autoPlay=true` },
  { group: 'Recommended', id: 'cinesrc.st', name: 'CineSrc', movie: id => `https://cinesrc.st/embed/movie/${id}?autoplay=1`, tv: (id, s, e) => `https://cinesrc.st/embed/tv/${id}?s=${s}&e=${e}&autoplay=1` },
  { group: 'Recommended', id: 'vidking.net', name: 'VidKing', movie: id => `https://www.vidking.net/embed/movie/${id}?autoPlay=true`, tv: (id, s, e) => `https://www.vidking.net/embed/tv/${id}/${s}/${e}?autoPlay=true` },
  { group: 'Recommended', id: 'vidnest.fun', name: 'VidNest', movie: id => `https://vidnest.fun/movie/${id}`, tv: (id, s, e) => `https://vidnest.fun/tv/${id}/${s}/${e}` },
  { group: 'Recommended', id: 'vidzee.wtf', name: 'VidZee', movie: id => `https://player.vidzee.wtf/embed/movie/${id}`, tv: (id, s, e) => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}` },
  { group: 'Recommended', id: 'vidstorm.ru', name: 'VidStorm', movie: id => `https://vidstorm.ru/movie/${id}`, tv: (id, s, e) => `https://vidstorm.ru/tv/${id}/${s}/${e}` },
  { group: 'Recommended', id: 'vidrock.ru', name: 'VidRock', movie: id => `https://vidrock.ru/movie/${id}`, tv: (id, s, e) => `https://vidrock.ru/tv/${id}/${s}/${e}` },
  { group: 'Recommended', id: 'vidspark.to', name: 'VidSpark', movie: id => `https://vidspark.to/movie/${id}`, tv: (id, s, e) => `https://vidspark.to/tv/${id}/${s}/${e}` },
  { group: 'Recommended', id: 'vidsrc.wtf', name: 'VidSrc.wtf', noSandbox: true, movie: id => `https://vidsrc.wtf/1/movie/${id}`, tv: (id, s, e) => `https://vidsrc.wtf/1/tv/${id}/${s}/${e}` },
  { group: 'Recommended', id: 'autoembed.co', name: 'AutoEmbed', movie: id => `https://autoembed.co/movie/tmdb/${id}`, tv: (id, s, e) => `https://autoembed.co/tv/tmdb/${id}-${s}-${e}` },
  { group: 'Recommended', id: '111movies.com', name: '111Movies', movie: id => `https://111movies.com/embed/movie/${id}`, tv: (id, s, e) => `https://111movies.com/embed/tv/${id}/${s}/${e}` },
  // VidSrc family
  { group: 'VidSrc mirrors', id: 'vidsrc.sh', name: 'vidsrc.sh', ..._embedFam('vidsrc.sh') },
  { group: 'VidSrc mirrors', id: 'vidsrc2.ru', name: 'vidsrc2.ru', ..._embedFam('vidsrc2.ru') },
  { group: 'VidSrc mirrors', id: 'vidsrc.to', name: 'vidsrc.to', ..._embedFam('vidsrc.to') },
  { group: 'VidSrc mirrors', id: 'vidsrcme.ru', name: 'vidsrcme.ru', ..._embedFam('vidsrcme.ru') },
  { group: 'VidSrc mirrors', id: 'vidsrc.in', name: 'vidsrc.in', ..._embedFam('vidsrc.in') },
  { group: 'VidSrc mirrors', id: 'vidsrc.io', name: 'vidsrc.io', ..._embedFam('vidsrc.io') },
  { group: 'VidSrc mirrors', id: 'vidsrc.pm', name: 'vidsrc.pm', ..._embedFam('vidsrc.pm') },
  { group: 'VidSrc mirrors', id: 'vidsrc.sbs', name: 'vidsrc.sbs', ..._embedFam('vidsrc.sbs') },
  { group: 'VidSrc mirrors', id: 'vidsrc.win', name: 'vidsrc.win', ..._embedFam('vidsrc.win') },
  { group: 'VidSrc mirrors', id: 'vsembed.ru', name: 'vsembed.ru', ..._embedFam('vsembed.ru') },
  { group: 'VidSrc mirrors', id: 'vidsrc-embed.ru', name: 'vidsrc-embed.ru', ..._embedFam('vidsrc-embed.ru') },
  { group: 'VidSrc mirrors', id: 'vid-src.top', name: 'vid-src.top', ..._embedFam('vid-src.top') },
  { group: 'VidSrc mirrors', id: 'vidsrc.rip', name: 'vidsrc.rip', ..._embedFam('vidsrc.rip') },
  { group: 'VidSrc mirrors', id: 'vidsrc.vip', name: 'vidsrc.vip', ..._embedFam('vidsrc.vip') },
  { group: 'VidSrc mirrors', id: 'vidsrc.su', name: 'vidsrc.su', movie: id => `https://vidsrc.su/movie/${id}?autoplay=true`, tv: (id, s, e) => `https://vidsrc.su/tv/${id}/${s}/${e}?autoplay=true` },
  // More
  { group: 'More', id: '2embed.cc', name: '2Embed', noSandbox: true, movie: id => `https://www.2embed.cc/embed/${id}`, tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` },
  { group: 'More', id: 'multiembed.mov', name: 'SuperEmbed', movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`, tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
  { group: 'More', id: 'vidcore.org', name: 'VidCore', movie: id => `https://vidcore.org/embed/movie/${id}`, tv: (id, s, e) => `https://vidcore.org/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'nontongo.win', name: 'NontonGo', movie: id => `https://www.nontongo.win/embed/movie/${id}`, tv: (id, s, e) => `https://www.nontongo.win/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'primesrc.me', name: 'PrimeSrc', movie: id => `https://primesrc.me/embed/movie?tmdb=${id}`, tv: (id, s, e) => `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
  { group: 'More', id: 'xpass.top', name: 'XPlay', movie: id => `https://play.xpass.top/e/movie/${id}`, tv: (id, s, e) => `https://play.xpass.top/e/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'nextgencloudfabric.com', name: 'NextGenCloud', movie: id => `https://nextgencloudfabric.com/embed/movie/${id}`, tv: (id, s, e) => `https://nextgencloudfabric.com/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'nxsha.space', name: 'Nxsha', movie: id => `https://nxsha.space/embed/movie/${id}`, tv: (id, s, e) => `https://nxsha.space/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'peachify.top', name: 'Peachify', movie: id => `https://peachify.top/embed/movie/${id}`, tv: (id, s, e) => `https://peachify.top/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'vidjoy.pro', name: 'VidJoy', movie: id => `https://vidjoy.pro/embed/movie/${id}`, tv: (id, s, e) => `https://vidjoy.pro/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'vidplus.to', name: 'VidPlus', movie: id => `https://player.vidplus.to/embed/movie/${id}`, tv: (id, s, e) => `https://player.vidplus.to/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'vidapi.xyz', name: 'VidAPI', noSandbox: true, movie: id => `https://vidapi.xyz/embed/movie/${id}`, tv: (id, s, e) => `https://vidapi.xyz/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'vidout', name: 'Vidout', movie: id => `https://watchout-player.netlify.app/movie/${id}`, tv: (id, s, e) => `https://watchout-player.netlify.app/tv/${id}/S${s}/E${e}` },
  { group: 'More', id: 'pstream.org', name: 'P-Stream', movie: id => `https://iframe.pstream.org/embed/tmdb-movie-${id}`, tv: (id, s, e) => `https://iframe.pstream.org/embed/tmdb-tv-${id}/${s}/${e}` },
  { group: 'More', id: 'frembed.cc', name: 'Frembed', movie: id => `https://frembed.cc/api/film.php?id=${id}`, tv: (id, s, e) => `https://frembed.cc/api/serie.php?id=${id}&sa=${s}&epi=${e}` },
  { group: 'More', id: 'vidup.to', name: 'VidUp', movie: id => `https://vidup.to/movie/${id}?autoPlay=true`, tv: (id, s, e) => `https://vidup.to/tv/${id}?autoPlay=true` },
  { group: 'More', id: 'vidlove.cc', name: 'VidLove', movie: id => `https://player.vidlove.cc/embed/movie/${id}`, tv: (id, s, e) => `https://player.vidlove.cc/embed/tv/${id}/${s}/${e}` },
  { group: 'More', id: 'vidsuper.net', name: 'VidSuper', movie: null, tv: (id, s, e) => `https://vidsuper.net/tv/${id}/${s}/${e}?autoplay=true` },
  // Anime (AniList ID based; shown only for anime titles)
  { group: 'Anime', id: 'megaplay.buzz', name: 'MegaPlay', anime: (ids, ep, track) => ids.anilistId ? `https://megaplay.buzz/stream/ani/${ids.anilistId}/${ep}/${track}` : (ids.malId ? `https://megaplay.buzz/stream/mal/${ids.malId}/${ep}/${track}` : null) },
  { group: 'Anime', id: 'tryembed.us.cc', name: 'TryEmbed', anime: (ids, ep, track) => ids.anilistId ? `https://tryembed.us.cc/embed/anime/${ids.anilistId}/${ep}/${track}` : null },
  { group: 'Anime', id: 'anixo.buzz', name: 'AniXo', anime: (ids, ep, track) => ids.anilistId ? `https://anixo.buzz/embed/ani/${ids.anilistId}/${ep}/${track}` : null },
  { group: 'Anime', id: 'vidnest-anime', name: 'VidNest Anime', anime: (ids, ep, track) => ids.anilistId ? `https://vidnest.fun/anime/${ids.anilistId}/${ep}/${track}` : null },
];

// ---------- Anime helpers (AniList ID lookup + SUB/DUB) ----------
function isAnimeItem(item) {
  item = item || currentItem;
  if (!item) return false;
  if (item._anime) return true;
  const g = item.genre_ids || [];
  return g.indexOf(16) !== -1 && (item.original_language === 'ja' || item.original_language === 'zh');
}

const animeIdCache = {};
async function resolveAnimeIds(item) {
  const key = 'tmdb' + item.id;
  if (animeIdCache[key]) return animeIdCache[key];
  const title = item.name || item.title || '';
  let anilistId = null, malId = null;
  try {
    const query = 'query ($search: String) { Page(perPage: 1) { media(search: $search, type: ANIME) { id idMal } } }';
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { search: title } })
    });
    const j = await r.json();
    const m = j && j.data && j.data.Page && j.data.Page.media && j.data.Page.media[0];
    if (m) { anilistId = m.id || null; malId = m.idMal || null; }
  } catch (e) { /* blocked or offline; try fallback */ }
  if (!anilistId && !malId && title) {
    try {
      const r = await fetch('https://api.jikan.moe/v4/anime?q=' + encodeURIComponent(title) + '&limit=1');
      const j = await r.json();
      const a = j && j.data && j.data[0];
      if (a && a.mal_id) malId = a.mal_id;
    } catch (e) { /* fallback failed too */ }
  }
  const ids = { anilistId: anilistId, malId: malId };
  animeIdCache[key] = ids;
  return ids;
}

let animeTrack = 'sub';
try { animeTrack = localStorage.getItem('tapanan_anime_track') === 'dub' ? 'dub' : 'sub'; } catch {}
function paintTrackBtn() {
  const b = document.getElementById('anime-track-toggle');
  if (b) b.textContent = animeTrack.toUpperCase();
}
function toggleAnimeTrack() {
  animeTrack = animeTrack === 'sub' ? 'dub' : 'sub';
  try { localStorage.setItem('tapanan_anime_track', animeTrack); } catch {}
  paintTrackBtn();
  changeServer();
}

let toastTimer = null;
function showMiniToast(msg) {
  let t = document.getElementById('mini-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'mini-toast';
    t.className = 'mini-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

let lastServerId = 'vidlink.pro';
function renderServerOptions(type) {
  const sel = document.getElementById('server');
  const prev = sel.value || lastServerId;
  sel.innerHTML = '';
  const animeMode = type === 'tv' && isAnimeItem();
  // When AdBlock (sandbox) is on, hide servers that refuse sandboxed iframes
  const usable = s => (s[type] || (animeMode && s.anime)) && !(adblockOn && s.noSandbox);
  const groups = {};
  SERVERS.filter(usable).forEach(s => { (groups[s.group] = groups[s.group] || []).push(s); });
  const order = animeMode ? ['Anime', 'Recommended', 'VidSrc mirrors', 'More'] : ['Recommended', 'VidSrc mirrors', 'More'];
  const orderedNames = order.concat(Object.keys(groups).filter(g => order.indexOf(g) === -1));
  orderedNames.forEach(g => {
    if (!groups[g]) return;
    const og = document.createElement('optgroup');
    og.label = g;
    groups[g].forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.name;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  const stillValid = prev && SERVERS.some(s => s.id === prev && usable(s));
  sel.value = stillValid ? prev : sel.options[0].value;
  lastServerId = sel.value;
  paintTrackBtn();
}

async function changeServer() {
  if (!currentItem) return;
  const srv = SERVERS.find(x => x.id === document.getElementById('server').value);
  if (!srv) return;
  lastServerId = srv.id;
  const item = currentItem;
  const frame = document.getElementById('modal-video');
  const trackBtn = document.getElementById('anime-track-toggle');
  if (srv.anime) {
    if (trackBtn) trackBtn.style.display = '';
    frame.removeAttribute('src');
    const ids = await resolveAnimeIds(item);
    if (document.getElementById('server').value !== srv.id || currentItem !== item) return; // user moved on
    const url = srv.anime(ids, currentEpisode, animeTrack);
    if (url) frame.src = url;
    else showMiniToast('Could not match this anime — try another server');
  } else {
    if (trackBtn) trackBtn.style.display = 'none';
    const type = itemType();
    frame.src = type === 'movie' ? srv.movie(item.id) : srv.tv(item.id, currentSeason, currentEpisode);
  }
}

function closeModal() {
  closeModalEl('modal');
  document.getElementById('modal-video').src = '';
}

// ---------- Watchlist ----------
const WL_KEY = 'tapanan_watchlist';
function getWatchlist() { try { return JSON.parse(localStorage.getItem(WL_KEY)) || []; } catch { return []; } }
function saveWatchlist(w) { try { localStorage.setItem(WL_KEY, JSON.stringify(w)); } catch {} }
function wlKeyOf(item) { return itemType(item) + ':' + item.id; }
function isInWatchlist(item) { const k = wlKeyOf(item); return getWatchlist().some(x => wlKeyOf(x) === k); }
function toggleWatchlist(item) {
  const w = getWatchlist();
  const k = wlKeyOf(item);
  const i = w.findIndex(x => wlKeyOf(x) === k);
  if (i >= 0) w.splice(i, 1);
  else w.unshift({ id: item.id, media_type: itemType(item), title: item.title, name: item.name, poster_path: item.poster_path, vote_average: item.vote_average, release_date: item.release_date, first_air_date: item.first_air_date, overview: item.overview });
  saveWatchlist(w);
  refreshWlUI(k);
}
function refreshWlUI(changedKey) {
  updateWlBadge();
  document.querySelectorAll('.card-bookmark').forEach(b => {
    const bk = b.getAttribute('data-wl');
    if (changedKey && bk !== changedKey) return;
    const [t, id] = bk.split(':');
    b.classList.toggle('saved', isInWatchlist({ id: +id, media_type: t }));
  });
  if (currentItem && (!changedKey || wlKeyOf(currentItem) === changedKey)) updateModalWlBtn();
  if (currentRoute === 'watchlist') renderWatchlist();
}
function updateWlBadge() {
  const n = getWatchlist().length;
  const el = document.getElementById('wl-count');
  if (!el) return;
  el.hidden = n === 0;
  el.textContent = n > 99 ? '99+' : n;
}
function updateModalWlBtn() {
  const b = document.getElementById('modal-watchlist');
  if (!b || !currentItem) return;
  const saved = isInWatchlist(currentItem);
  b.classList.toggle('saved', saved);
  b.querySelector('span').textContent = saved ? 'In Watchlist' : 'Add to Watchlist';
}
function toggleModalWatchlist() { if (currentItem) toggleWatchlist(currentItem); }

// ---------- Page views / router ----------
let currentRoute = 'home';
const MOVIE_TABS = [['popular', 'Popular', 'Popular Movies'], ['top_rated', 'Top Rated', 'Top Rated Movies'], ['now_playing', 'Now Playing', 'Now Playing in Theaters'], ['upcoming', 'Upcoming', 'Upcoming Movies']];
const TV_TABS = [['popular', 'Popular', 'Popular TV Shows'], ['top_rated', 'Top Rated', 'Top Rated TV Shows'], ['on_the_air', 'On Air', 'Currently Airing TV Shows']];
const viewState = { movies: { tab: 'popular', page: 1, totalPages: 1 }, tv: { tab: 'popular', page: 1, totalPages: 1 }, anime: { tab: 'popular', page: 1, totalPages: 1 }, kdrama: { tab: 'popular', page: 1, totalPages: 1 }, donghua: { tab: 'popular', page: 1, totalPages: 1 } };
// Generic browse sections (anime / k-drama / chinese animation)
const SECTION_PAGES = {
  anime: {
    nav: 'Anime', pageTitle: 'Anime', pageSub: 'Discover and watch your favorite anime series', rowTitle: 'Trending Anime',
    params: 'with_genres=16&with_original_language=ja', flag: '_anime', voteMin: { popular: 50, top_rated: 300, airing: 20 },
    tabs: [['popular', 'Popular', 'Popular Anime'], ['top_rated', 'Top Rated', 'Top Rated Anime'], ['airing', 'Airing Now', 'Currently Airing Anime']],
  },
  kdrama: {
    nav: 'K-Drama', pageTitle: 'K-Drama', pageSub: 'The best Korean dramas, all in one place', rowTitle: 'Trending K-Drama',
    params: 'with_genres=18&with_original_language=ko', flag: null, voteMin: { popular: 20, top_rated: 100, airing: 10 },
    tabs: [['popular', 'Popular', 'Popular K-Dramas'], ['top_rated', 'Top Rated', 'Top Rated K-Dramas'], ['airing', 'Airing Now', 'Currently Airing K-Dramas']],
  },
  donghua: {
    nav: 'Chinese Anime', pageTitle: 'Chinese Anime', pageSub: 'Donghua — animation from China', rowTitle: 'Trending Chinese Anime',
    params: 'with_genres=16&with_original_language=zh', flag: '_anime', voteMin: { popular: 5, top_rated: 20, airing: 3 },
    tabs: [['popular', 'Popular', 'Popular Chinese Anime'], ['top_rated', 'Top Rated', 'Top Rated Chinese Anime'], ['airing', 'Airing Now', 'Currently Airing Chinese Anime']],
  },
};
function sectionDiscoverURL(key, tab, page) {
  const cfg = SECTION_PAGES[key];
  const vm = (cfg.voteMin[tab] != null ? cfg.voteMin[tab] : 0);
  let url = `${BASE_URL}/discover/tv?api_key=${API_KEY}&${cfg.params}&page=${page}`;
  if (tab === 'top_rated') url += `&sort_by=vote_average.desc&vote_count.gte=${vm}`;
  else if (tab === 'airing') {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    url += `&sort_by=popularity.desc&vote_count.gte=${vm}&first_air_date.gte=${d.toISOString().slice(0, 10)}`;
  } else url += `&sort_by=popularity.desc&vote_count.gte=${vm}`;
  return url;
}
async function loadSectionView(key) {
  const cfg = SECTION_PAGES[key];
  const st = viewState[key];
  const tab = cfg.tabs.find(t => t[0] === st.tab) || cfg.tabs[0];
  renderTabs(key + '-tabs', cfg.tabs, st.tab, (k) => { st.tab = k; st.page = 1; loadSectionView(key); });
  document.getElementById(key + '-grid-title').textContent = tab[2];
  const grid = document.getElementById(key + '-grid');
  grid.innerHTML = '<div class="grid-loading">Loading...</div>';
  const d = await getJSON(sectionDiscoverURL(key, st.tab, st.page));
  const results = ((d && d.results) || []).filter(i => i.poster_path);
  st.totalPages = Math.min((d && d.total_pages) || 1, 500);
  grid.innerHTML = '';
  results.forEach(item => { item.media_type = 'tv'; if (cfg.flag) item[cfg.flag] = true; grid.appendChild(makeCard(item)); });
  renderPager(key + '-pager', st.page, st.totalPages, (p) => { st.page = p; loadSectionView(key); document.getElementById('view-' + key).scrollIntoView(); });
}

function router() {
  const h = location.hash || '#/';
  let route = 'home';
  if (h.startsWith('#/movies')) route = 'movies';
  else if (h.startsWith('#/tv-shows')) route = 'tv';
  else if (h.startsWith('#/anime')) route = 'anime';
  else if (h.startsWith('#/kdrama')) route = 'kdrama';
  else if (h.startsWith('#/donghua')) route = 'donghua';
  else if (h.startsWith('#/watchlist')) route = 'watchlist';
  const changed = route !== currentRoute;
  currentRoute = route;
  ['home', 'movies', 'tv', 'anime', 'kdrama', 'donghua', 'watchlist'].forEach(r => {
    const el = document.getElementById('view-' + r);
    if (el) el.hidden = r !== route;
  });
  document.querySelectorAll('#nav-links a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  if (route === 'movies' && changed) loadMoviesView();
  else if (route === 'tv' && changed) loadTvView();
  else if (route === 'anime' && changed) loadSectionView('anime');
  else if (route === 'kdrama' && changed) loadSectionView('kdrama');
  else if (route === 'donghua' && changed) loadSectionView('donghua');
  else if (route === 'watchlist') renderWatchlist();
  window.scrollTo(0, 0);
}

function renderTabs(tabsElId, tabs, activeKey, onPick) {
  const el = document.getElementById(tabsElId);
  el.innerHTML = '';
  tabs.forEach(([key, label]) => {
    const b = document.createElement('button');
    b.className = 'tab' + (key === activeKey ? ' active' : '');
    b.textContent = label;
    b.onclick = () => onPick(key);
    el.appendChild(b);
  });
}

function renderPager(pagerId, page, total, onGo) {
  const el = document.getElementById(pagerId);
  el.innerHTML = '';
  const btn = (label, p, opts = {}) => {
    const b = document.createElement('button');
    b.innerHTML = label;
    if (opts.active) b.className = 'active';
    if (opts.disabled) b.disabled = true;
    else b.onclick = () => onGo(p);
    el.appendChild(b);
  };
  const dots = () => { const s = document.createElement('span'); s.className = 'dots'; s.textContent = '…'; el.appendChild(s); };
  btn('<i class="fa-solid fa-chevron-left"></i>', page - 1, { disabled: page <= 1 });
  let start = Math.max(1, Math.min(page - 2, total - 4));
  let end = Math.min(total, start + 4);
  start = Math.max(1, end - 4);
  if (start > 1) { btn('1', 1); if (start > 2) dots(); }
  for (let p = start; p <= end; p++) btn(String(p), p, { active: p === page });
  if (end < total) { if (end < total - 1) dots(); btn(String(total), total); }
  btn('<i class="fa-solid fa-chevron-right"></i>', page + 1, { disabled: page >= total });
}

async function loadMoviesView() {
  const st = viewState.movies;
  const tab = MOVIE_TABS.find(t => t[0] === st.tab) || MOVIE_TABS[0];
  renderTabs('movies-tabs', MOVIE_TABS, st.tab, (k) => { st.tab = k; st.page = 1; loadMoviesView(); });
  document.getElementById('movies-grid-title').textContent = tab[2];
  const grid = document.getElementById('movies-grid');
  grid.innerHTML = '<div class="grid-loading">Loading...</div>';
  const d = await getJSON(`${BASE_URL}/movie/${st.tab}?api_key=${API_KEY}&page=${st.page}`);
  const results = ((d && d.results) || []).filter(i => i.poster_path);
  st.totalPages = Math.min((d && d.total_pages) || 1, 500);
  grid.innerHTML = '';
  results.forEach(item => { item.media_type = 'movie'; grid.appendChild(makeCard(item)); });
  renderPager('movies-pager', st.page, st.totalPages, (p) => { st.page = p; loadMoviesView(); document.getElementById('view-movies').scrollIntoView(); });
}

async function loadTvView() {
  const st = viewState.tv;
  const tab = TV_TABS.find(t => t[0] === st.tab) || TV_TABS[0];
  renderTabs('tv-tabs', TV_TABS, st.tab, (k) => { st.tab = k; st.page = 1; loadTvView(); });
  document.getElementById('tv-grid-title').textContent = tab[2];
  const grid = document.getElementById('tv-grid');
  grid.innerHTML = '<div class="grid-loading">Loading...</div>';
  const d = await getJSON(`${BASE_URL}/tv/${st.tab}?api_key=${API_KEY}&page=${st.page}`);
  const results = ((d && d.results) || []).filter(i => i.poster_path);
  st.totalPages = Math.min((d && d.total_pages) || 1, 500);
  grid.innerHTML = '';
  results.forEach(item => { item.media_type = 'tv'; grid.appendChild(makeCard(item)); });
  renderPager('tv-pager', st.page, st.totalPages, (p) => { st.page = p; loadTvView(); document.getElementById('view-tv').scrollIntoView(); });
}

function renderWatchlist() {
  const w = getWatchlist();
  document.getElementById('watchlist-empty').hidden = w.length > 0;
  const grid = document.getElementById('watchlist-grid');
  grid.innerHTML = '';
  w.forEach(item => grid.appendChild(makeCard(item)));
}

// ---------- Search ----------
function openSearchModal() {
  openModalEl('search-modal');
  setTimeout(() => document.getElementById('search-input').focus(), 60);
}
function closeSearchModal() {
  closeModalEl('search-modal');
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
}
let searchTimer;
function searchTMDB() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const query = document.getElementById('search-input').value;
    const container = document.getElementById('search-results');
    if (!query.trim()) { container.innerHTML = ''; return; }
    const data = await getJSON(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    container.innerHTML = '';
    ((data && data.results) || []).forEach(item => {
      if (!item.poster_path) return;
      const img = document.createElement('img');
      img.src = IMG_URL + item.poster_path;
      img.alt = item.title || item.name || '';
      img.loading = 'lazy';
      img.onclick = () => { closeSearchModal(); showDetails(item); };
      container.appendChild(img);
    });
  }, 280);
}

// ---------- Zoom lightbox ----------
let zoomLevel = 2;
function setZoom(z) {
  zoomLevel = Math.min(4, Math.max(1, z));
  document.getElementById('zoom-image').style.width = (zoomLevel * 100) + 'vw';
}
function zoomStep(f) { setZoom(zoomLevel * f); }
function openZoom() {
  const src = document.getElementById('modal-image').src;
  if (!src) return;
  const hiRes = src.includes('/w500/') ? src.replace('/w500/', '/original/') : src;
  document.getElementById('zoom-image').src = hiRes;
  setZoom(2);
  const zo = document.getElementById('zoom-overlay');
  zo.classList.add('open');
  zo.scrollTop = 0; zo.scrollLeft = 0;
  document.body.style.overflow = 'hidden';
}
function closeZoom() {
  const zo = document.getElementById('zoom-overlay');
  if (!zo.classList.contains('open')) return;
  zo.classList.remove('open');
  document.getElementById('zoom-image').src = '';
  if (!document.getElementById('modal').classList.contains('open')) document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeZoom(); closeModal(); closeSearchModal(); }
});
document.getElementById('modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
});

// ---------- Init ----------
async function init() {
  const [trending, popularMovies, nowPlaying, topRated, popularTV, trendingAnime, trendingKdrama, trendingDonghua, collections] = await Promise.all([
    fetchTrendingDay(), fetchPopularMovies(), fetchNowPlaying(), fetchTopRated(), fetchPopularTV(), fetchSectionRow('anime'), fetchSectionRow('kdrama'), fetchSectionRow('donghua'), fetchCollections()
  ]);
  const heroPool = trending.filter(i => i.backdrop_path && i.overview);
  if (heroPool.length) renderHero(heroPool[Math.floor(Math.random() * heroPool.length)]);
  displayList(trending, 'trending-list');
  displayList(popularMovies, 'movies-list');
  displayList(nowPlaying, 'nowplaying-list');
  displayList(topRated, 'toprated-list');
  displayList(popularTV, 'tvshows-list');
  trendingAnime.forEach(a => { a._anime = true; });
  displayList(trendingAnime, 'anime-list');
  displayList(trendingKdrama, 'kdrama-list');
  trendingDonghua.forEach(a => { a._anime = true; });
  displayList(trendingDonghua, 'donghua-list');
  displayCollections(collections);
}
init();

// ---------- Visitor counter (Abacus) — one count per visitor ----------
(function () {
  const badge = document.getElementById('visit-counter');
  const num = document.getElementById('visit-count');
  if (!badge || !num) return;
  const NS = 'tapanan-app', KEY = 'unique-visits';
  const seenKey = 'tapanan_visit_counted';
  const alreadyCounted = (() => { try { return localStorage.getItem(seenKey) === '1'; } catch (e) { return false; } })();
  const show = (v) => {
    num.textContent = v.toLocaleString('en-US');
    badge.hidden = false;
  };
  const done = (d) => {
    if (d && typeof d.value === 'number') {
      show(d.value);
      if (!alreadyCounted) { try { localStorage.setItem(seenKey, '1'); } catch (e) {} }
    }
  };
  // First visit from this device: increment. Return visits: read only.
  const url = `https://abacus.jasoncameron.dev/${alreadyCounted ? 'get' : 'hit'}/${NS}/${KEY}`;
  const parse = (r) => (r.ok ? r.json() : Promise.reject());
  fetch(url).then(parse).then(done).catch(() => {
    // one retry for flaky networks, then stay hidden
    setTimeout(() => { fetch(url).then(parse).then(done).catch(() => {}); }, 2500);
  });
})();


// ---------- Tapanan AI chat (Radox API via /api/ai-chat) ----------
(function () {
  const fab = document.getElementById('ai-fab');
  const panel = document.getElementById('ai-panel');
  const msgsEl = document.getElementById('ai-messages');
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send');
  const closeBtn = document.getElementById('ai-close');
  if (!fab || !panel || !msgsEl || !input || !sendBtn) return;

  const history = []; // {role, content} sent to the server
  let busy = false;

  function addMsg(role, text, cls) {
    const div = document.createElement('div');
    div.className = 'ai-msg ' + (cls || role);
    div.textContent = text;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return div;
  }

  function greet() {
    if (msgsEl.children.length) return;
    addMsg('bot', "Hi! I'm Tapanan AI 🎬 Tell me what mood you're in and I'll suggest something to watch.");
  }

  fab.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { greet(); input.focus(); }
  });
  closeBtn.addEventListener('click', () => { panel.hidden = true; });

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    input.value = '';
    addMsg('user', text);
    history.push({ role: 'user', content: text });
    const typing = addMsg('bot', 'Thinking…', 'bot typing');
    try {
      const r = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) }),
      });
      const data = await r.json().catch(() => ({}));
      typing.remove();
      if (!r.ok) throw new Error(data.error || 'Request failed');
      addMsg('bot', data.reply);
      history.push({ role: 'assistant', content: data.reply });
    } catch (e) {
      typing.remove();
      addMsg('bot', 'Sorry, I had trouble reaching the AI. ' + (e.message || 'Try again in a bit.'));
    } finally {
      busy = false; sendBtn.disabled = false;
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
})();
