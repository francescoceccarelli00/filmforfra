
const APP_CONFIG = {
  tmdb: {
    apiBase: 'https://api.themoviedb.org/3',
    bearerToken: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMDg4NjhmNGJlYWFmZmUzOGEwZTdjMGZlOGY3NjNjNSIsIm5iZiI6MTc3NDYxNTg0Ny4zMDQ5OTk4LCJzdWIiOiI2OWM2N2QyNzM2ZDk5MWM0MjFhZDhkNmUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.ArEg9oz3QxzEu228Cp5mCDijs-_fCmSjl1cRaI6SDOs',
    apiKey: '108868f4beaaffe38a0e7c0fe8f763c5',
    language: 'it-IT',
    region: 'IT',
    providerCountry: 'IT'
  },
  vixsrc: {
    base: 'https://vixsrc.to',
    preferredAudioLanguage: 'it'
  },
  catalog: {
    pageSize: 48,
    maxBatchRequests: 3,
    maxSearchPages: 4,
    fallbackPosterBase: 'https://image.tmdb.org/t/p/',
    fallbackPosterSize: 'w342'
  },
  providers: {
    country: 'IT',
    monetizationTypes: ['flatrate', 'rent', 'buy'],
    items: [
      { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
      { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
      { provider_id: 2, provider_name: 'Apple TV', logo_path: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
      { provider_id: 10, provider_name: 'Amazon Video', logo_path: '/5NyLm42TmCqCMOZFvH4fcoSNKEW.jpg' }
    ]
  }
};

const state = {
  currentTab: 'film',
  currentUrl: '',
  catalogOpen: false,
  catalogOrigin: 'movie',
  catalogPage: 1,
  movieGenres: [],
  tvGenres: [],
  imageBaseUrl: '',
  logoBaseUrl: '',
  providerIds: APP_CONFIG.providers.items.map((item) => item.provider_id),
  providerValidationCache: new Map(),
  catalogFilters: {
    type: 'movie',
    query: '',
    genre: '',
    year: '',
    sort: 'popularity.desc',
    rating: '0'
  },
  catalogLastItemsCount: 0,
  toastTimeoutId: null
};

const dom = {};

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function initDom() {
  dom.tabButtons = $all('.tab-btn');
  dom.panels = {
    film: $('#panel-film'),
    serie: $('#panel-serie')
  };
  dom.filmCode = $('#film-code');
  dom.serieCode = $('#serie-code');
  dom.season = $('#season');
  dom.episode = $('#episode');
  dom.watchFilm = $('#watch-film');
  dom.watchSerie = $('#watch-serie');
  dom.backArrow = $('#back-arrow');
  dom.forwardArrow = $('#forward-arrow');
  dom.videoContainer = $('#video-container');
  dom.videoFrame = $('#video-frame');

  dom.catalogShell = $('#catalog-shell');
  dom.catalogBackdrop = $('#catalog-backdrop');
  dom.catalogClose = $('#catalog-close');
  dom.catalogTitle = $('#catalog-title');
  dom.catalogSubtitle = $('#catalog-subtitle');
  dom.catalogGrid = $('#catalog-grid');
  dom.catalogFeedback = $('#catalog-feedback');
  dom.catalogPageInfo = $('#catalog-page-info');
  dom.catalogPrev = $('#catalog-prev');
  dom.catalogNext = $('#catalog-next');
  dom.catalogApply = $('#catalog-apply');
  dom.catalogReset = $('#catalog-reset');
  dom.catalogQuery = $('#catalog-query');
  dom.catalogType = $('#catalog-type');
  dom.catalogGenre = $('#catalog-genre');
  dom.catalogYear = $('#catalog-year');
  dom.catalogSort = $('#catalog-sort');
  dom.catalogRating = $('#catalog-rating');
  dom.catalogProviderList = $('#catalog-provider-list');
  dom.toast = $('#toast');
}

function initEvents() {
  dom.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  dom.watchFilm.addEventListener('click', watchMovie);
  dom.watchSerie.addEventListener('click', watchSeries);
  dom.backArrow.addEventListener('click', () => navigateEpisode(-1));
  dom.forwardArrow.addEventListener('click', () => navigateEpisode(1));

  ['film', 'serie'].forEach((panelName) => {
    $all(`#panel-${panelName} input`).forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (panelName === 'film') {
          watchMovie();
        } else {
          watchSeries();
        }
      });
    });
  });

  $all('[data-open-catalog]').forEach((btn) => {
    btn.addEventListener('click', () => openCatalog(btn.dataset.openCatalog));
  });

  dom.catalogBackdrop.addEventListener('click', closeCatalog);
  dom.catalogClose.addEventListener('click', closeCatalog);
  dom.catalogApply.addEventListener('click', () => applyCatalogFilters(true));
  dom.catalogReset.addEventListener('click', resetCatalogFilters);
  dom.catalogPrev.addEventListener('click', () => changeCatalogPage(-1));
  dom.catalogNext.addEventListener('click', () => changeCatalogPage(1));

  dom.catalogType.addEventListener('change', async () => {
    state.catalogFilters.type = dom.catalogType.value;
    populateGenreOptions();
    await applyCatalogFilters(true);
  });

  [dom.catalogQuery, dom.catalogYear].forEach((input) => {
    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      await applyCatalogFilters(true);
    });
  });

  [dom.catalogGenre, dom.catalogSort, dom.catalogRating].forEach((field) => {
    field.addEventListener('change', () => applyCatalogFilters(true));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.catalogOpen) {
      closeCatalog();
    }
  });

  window.addEventListener('message', handlePlayerMessage);
}

async function init() {
  initDom();
  initEvents();
  updateEpisodeBackButton();
  renderProviderFilter();

  initCastUI();

  try {
    await Promise.all([loadTmdbConfiguration(), loadGenreLists()]);
    populateGenreOptions();
  } catch (error) {
    console.warn('TMDB init warning:', error);
    setCatalogFeedback('TMDB non raggiungibile al momento. Il catalogo potrebbe non caricarsi.', true);
  }
}

function switchTab(tab) {
  state.currentTab = tab;
  dom.tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  Object.entries(dom.panels).forEach(([key, panel]) => {
    const isActive = key === tab;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
}

function normalizeInteger(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function getMovieUrl(tmdbId) {
  const params = new URLSearchParams({
    lang: APP_CONFIG.vixsrc.preferredAudioLanguage
  });
  return `${APP_CONFIG.vixsrc.base}/movie/${tmdbId}?${params.toString()}`;
}

function getSeriesUrl(tmdbId, season, episode) {
  const params = new URLSearchParams({
    lang: APP_CONFIG.vixsrc.preferredAudioLanguage
  });
  return `${APP_CONFIG.vixsrc.base}/tv/${tmdbId}/${season}/${episode}?${params.toString()}`;
}

function watchMovie() {
  const code = normalizeInteger(dom.filmCode.value.trim());
  if (!code) {
    showToast('Inserisci un codice TMDB film valido.');
    dom.filmCode.focus();
    return;
  }

  loadVideo(getMovieUrl(code));
}

function watchSeries() {
  const code = normalizeInteger(dom.serieCode.value.trim());
  const season = normalizeInteger(dom.season.value);
  const episode = normalizeInteger(dom.episode.value);

  if (!code || !season || !episode) {
    showToast('Inserisci codice serie, stagione ed episodio validi.');
    return;
  }

  loadVideo(getSeriesUrl(code, season, episode));
  updateEpisodeBackButton();
}

function navigateEpisode(direction) {
  const currentSeason = normalizeInteger(dom.season.value) || 1;
  const currentEpisode = normalizeInteger(dom.episode.value) || 1;

  if (direction === -1 && currentSeason === 1 && currentEpisode === 1) {
    return;
  }

  const nextEpisode = Math.max(1, currentEpisode + direction);
  dom.episode.value = String(nextEpisode);
  watchSeries();
}

function updateEpisodeBackButton() {
  const season = normalizeInteger(dom.season.value) || 1;
  const episode = normalizeInteger(dom.episode.value) || 1;
  dom.backArrow.disabled = season === 1 && episode === 1;
}

// ── Popup / ad blocker ──────────────────────────────────────────────────────
// Override window.open permanently while a video is loaded.
// This intercepts popup attempts originating from the parent window context.
// Note: scripts running inside a cross-origin iframe have their own window
// object — this override does not reach them directly, but it blocks any
// attempt that bubbles up or uses window.open on the top frame.
(function installPopupBlocker() {
  const _nativeOpen = window.open;
  let _blocked = false;

  Object.defineProperty(window, 'open', {
    configurable: true,
    get() {
      if (_blocked) return () => null;
      return _nativeOpen;
    },
    set() {}
  });

  // Expose internal toggle so loadVideo can activate/deactivate
  window._setPopupBlock = (active) => { _blocked = active; };
})();

function loadVideo(url) {
  state.currentUrl = url;

  // Activate popup blocker for the duration of this session
  if (typeof window._setPopupBlock === 'function') {
    window._setPopupBlock(true);
  }

  dom.videoContainer.style.display = 'block';
  dom.videoFrame.src = url;
  dom.videoContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  tryCast(url);
}

// Click interceptor: when the user clicks inside the iframe area, briefly
// return focus to the wrapper so the frame cannot trigger top-navigation
// via focus-triggered scripts.
(function initClickInterceptor() {
  const wrapper = document.getElementById('video-wrapper');
  if (!wrapper) return;
  wrapper.addEventListener('click', () => {
    setTimeout(() => {
      const frame = document.getElementById('video-frame');
      if (frame) {
        frame.blur();
        wrapper.focus({ preventScroll: true });
      }
    }, 80);
  });
})();

function handlePlayerMessage(event) {
  if (!event || typeof event.data !== 'object' || !event.data) return;
  if (event.data.type !== 'PLAYER_EVENT') return;
  if (event.data.data?.event === 'play') {
    console.debug('Player avviato:', event.data.data);
  }
}

// ── Chromecast ─────────────────────────────────────────────────────────────

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS && isSafari;
}

function isCastSdkAvailable() {
  return typeof cast !== 'undefined' && typeof chrome !== 'undefined' && cast.framework;
}

function initCastUI() {
  const nativeWrap = document.getElementById('cast-native');
  const iosBanner  = document.getElementById('cast-ios-banner');
  const manualBtn  = document.getElementById('cast-manual-btn');

  if (isIosSafari()) {
    // SDK won't load on Safari iOS: show the fallback banner
    if (nativeWrap) nativeWrap.hidden = true;
    if (iosBanner)  iosBanner.hidden  = false;
    if (manualBtn) {
      manualBtn.addEventListener('click', () => {
        // Best-effort: if user has opened Chrome and Cast SDK somehow loaded, try it.
        // Otherwise guide them.
        if (isCastSdkAvailable()) {
          tryCast(state.currentUrl || '');
        } else {
          showToast('Apri questo sito in Chrome su iPhone per usare Chromecast.');
        }
      });
    }
    return;
  }

  // Non-iOS: SDK should load — make sure native element is visible
  if (nativeWrap) nativeWrap.hidden = false;
  if (iosBanner)  iosBanner.hidden  = true;
}

window.__onGCastApiAvailable = function onCastAvailable(isAvailable) {
  if (!isAvailable) return;

  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });

  // SDK loaded: update UI in case initCastUI ran early
  const nativeWrap = document.getElementById('cast-native');
  const iosBanner  = document.getElementById('cast-ios-banner');
  if (nativeWrap) nativeWrap.hidden = false;
  if (iosBanner)  iosBanner.hidden  = true;
};

function tryCast(url) {
  if (!url) {
    showToast('Avvia prima un film o una serie, poi usa il Cast.');
    return;
  }
  try {
    const context = cast.framework.CastContext.getInstance();
    const session = context.getCurrentSession();
    if (!session) {
      showToast('Connettiti prima a un dispositivo Chromecast.');
      return;
    }

    const mediaInfo = new chrome.cast.media.MediaInfo(url, 'video/mp4');
    mediaInfo.streamType = chrome.cast.media.StreamType.BUFFERED;
    const request = new chrome.cast.media.LoadRequest(mediaInfo);

    session.loadMedia(request)
      .then(() => showToast('Trasmissione avviata sul Chromecast.'))
      .catch((error) => {
        console.warn('Cast load error:', error);
        showToast('Errore Cast: il sorgente video potrebbe non supportare lo streaming diretto.');
      });
  } catch (error) {
    console.debug('Cast non disponibile:', error);
    showToast('Cast SDK non disponibile. Usa Chrome su desktop o Android.');
  }
}

function openCatalog(originType) {
  state.catalogOpen = true;
  state.catalogOrigin = originType;
  state.catalogFilters.type = originType;
  state.catalogPage = 1;

  dom.catalogType.value = originType;
  dom.catalogTitle.textContent = originType === 'movie' ? 'Catalogo film' : 'Catalogo serie';
  dom.catalogSubtitle.textContent = originType === 'movie'
    ? 'Selezionando una card film il player parte subito.'
    : 'Selezionando una card serie viene compilato il codice TMDB, poi scegli stagione ed episodio.';

  populateGenreOptions();
  syncCatalogFiltersToDom();

  document.body.classList.add('catalog-open');
  dom.catalogShell.classList.add('open');
  dom.catalogShell.setAttribute('aria-hidden', 'false');
  void applyCatalogFilters(true);
}

function closeCatalog() {
  state.catalogOpen = false;
  document.body.classList.remove('catalog-open');
  dom.catalogShell.classList.remove('open');
  dom.catalogShell.setAttribute('aria-hidden', 'true');
}

function syncCatalogFiltersToDom() {
  dom.catalogQuery.value = state.catalogFilters.query;
  dom.catalogType.value = state.catalogFilters.type;
  dom.catalogGenre.value = state.catalogFilters.genre;
  dom.catalogYear.value = state.catalogFilters.year;
  dom.catalogSort.value = state.catalogFilters.sort;
  dom.catalogRating.value = state.catalogFilters.rating;
}

function readCatalogFiltersFromDom() {
  state.catalogFilters = {
    type: dom.catalogType.value,
    query: dom.catalogQuery.value.trim(),
    genre: dom.catalogGenre.value,
    year: dom.catalogYear.value.trim(),
    sort: dom.catalogSort.value,
    rating: dom.catalogRating.value
  };
}

function resetCatalogFilters() {
  state.catalogFilters = {
    type: state.catalogOrigin,
    query: '',
    genre: '',
    year: '',
    sort: 'popularity.desc',
    rating: '0'
  };
  state.catalogPage = 1;
  populateGenreOptions();
  syncCatalogFiltersToDom();
  void fetchAndRenderCatalog();
}

async function applyCatalogFilters(resetPage = false) {
  readCatalogFiltersFromDom();
  if (resetPage) {
    state.catalogPage = 1;
  }
  populateGenreOptions();
  await fetchAndRenderCatalog();
}

function populateGenreOptions() {
  const genreList = state.catalogFilters.type === 'movie' ? state.movieGenres : state.tvGenres;
  const currentValue = state.catalogFilters.genre;

  dom.catalogGenre.innerHTML = '<option value="">Tutti</option>';
  genreList.forEach((genre) => {
    const option = document.createElement('option');
    option.value = String(genre.id);
    option.textContent = genre.name;
    dom.catalogGenre.appendChild(option);
  });

  if (genreList.some((genre) => String(genre.id) === currentValue)) {
    dom.catalogGenre.value = currentValue;
  } else {
    dom.catalogGenre.value = '';
    state.catalogFilters.genre = '';
  }
}

function renderProviderFilter() {
  if (!dom.catalogProviderList) return;

  dom.catalogProviderList.innerHTML = APP_CONFIG.providers.items.map((provider) => {
    const logo = getProviderLogoUrl(provider.logo_path);
    const logoMarkup = logo
      ? `<img src="${escapeHtmlAttribute(logo)}" alt="${escapeHtmlAttribute(provider.provider_name)}" loading="lazy" referrerpolicy="no-referrer">`
      : '';
    return `<span class="catalog-provider-chip">${logoMarkup}<span>${escapeHtml(provider.provider_name)}</span></span>`;
  }).join('');
}

async function loadTmdbConfiguration() {
  const config = await tmdbGet('/configuration');
  const baseUrl = config?.images?.secure_base_url || 'https://image.tmdb.org/t/p/';
  const posterSizes = config?.images?.poster_sizes || ['w342'];
  const logoSizes = config?.images?.logo_sizes || ['w92'];
  const preferredPosterSize = posterSizes.includes('w342') ? 'w342' : (posterSizes.includes('w500') ? 'w500' : (posterSizes.at(-1) || 'w342'));
  const preferredLogoSize = logoSizes.includes('w92') ? 'w92' : (logoSizes.at(0) || 'w92');
  state.imageBaseUrl = `${baseUrl}${preferredPosterSize}`;
  state.logoBaseUrl = `${baseUrl}${preferredLogoSize}`;
}

async function loadGenreLists() {
  const [movieGenresResponse, tvGenresResponse] = await Promise.all([
    tmdbGet('/genre/movie/list', { language: APP_CONFIG.tmdb.language }),
    tmdbGet('/genre/tv/list', { language: APP_CONFIG.tmdb.language })
  ]);

  state.movieGenres = movieGenresResponse.genres || [];
  state.tvGenres = tvGenresResponse.genres || [];
}

async function tmdbGet(path, params = {}) {
  const url = new URL(`${APP_CONFIG.tmdb.apiBase}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  if (!APP_CONFIG.tmdb.bearerToken && APP_CONFIG.tmdb.apiKey) {
    url.searchParams.set('api_key', APP_CONFIG.tmdb.apiKey);
  }

  const headers = APP_CONFIG.tmdb.bearerToken
    ? { Authorization: `Bearer ${APP_CONFIG.tmdb.bearerToken}` }
    : {};

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`TMDB error ${response.status}`);
  }

  return response.json();
}

async function fetchAndRenderCatalog() {
  setCatalogFeedback('Caricamento catalogo in corso...');
  renderCatalogLoading();

  try {
    const items = await fetchCatalogItems();
    state.catalogLastItemsCount = items.length;
    renderCatalogItems(items);
    updatePaginationControls(items.length);

    if (!items.length) {
      setCatalogFeedback('Nessun risultato con i filtri attuali.');
      return;
    }

    setCatalogFeedback(`Risultati caricati: ${items.length} elementi nella pagina ${state.catalogPage}. Vista: 8 card per volta con scroll.`);
  } catch (error) {
    console.error(error);
    renderCatalogError('Impossibile caricare il catalogo TMDB. Controlla token, rete o CORS del browser.');
    updatePaginationControls(0);
    setCatalogFeedback('Errore durante il caricamento del catalogo.', true);
  }
}

function getTmdbListEndpoint(type, hasQuery) {
  if (hasQuery) {
    return type === 'movie' ? '/search/movie' : '/search/tv';
  }
  return type === 'movie' ? '/discover/movie' : '/discover/tv';
}

function buildTmdbParams(type, page, hasQuery = false) {
  const filters = state.catalogFilters;
  const params = {
    language: APP_CONFIG.tmdb.language,
    page,
    region: APP_CONFIG.tmdb.region,
    watch_region: APP_CONFIG.providers.country
  };

  if (!hasQuery) {
    params.sort_by = normalizeTmdbSort(type, filters.sort);
    params.include_adult = false;
    params.include_video = false;
    params.vote_average_gte = filters.rating || 0;
    params.with_watch_providers = state.providerIds.join('|');
    params.with_watch_monetization_types = APP_CONFIG.providers.monetizationTypes.join('|');

    if (filters.genre) {
      params.with_genres = filters.genre;
    }

    if (filters.year) {
      if (type === 'movie') {
        params.primary_release_year = filters.year;
      } else {
        params.first_air_date_year = filters.year;
      }
    }
  } else {
    params.query = filters.query;
    params.include_adult = false;
    if (filters.year) {
      if (type === 'movie') {
        params.year = filters.year;
      } else {
        params.first_air_date_year = filters.year;
      }
    }
  }

  return params;
}

function normalizeTmdbSort(type, uiSort) {
  const map = {
    'popularity.desc': 'popularity.desc',
    'primary_release_date.desc': type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
    'primary_release_date.asc': type === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc',
    'vote_average.desc': 'vote_average.desc',
    'vote_average.asc': 'vote_average.asc',
    'title.asc': type === 'movie' ? 'title.asc' : 'name.asc',
    'title.desc': type === 'movie' ? 'title.desc' : 'name.desc'
  };
  return map[uiSort] || 'popularity.desc';
}

function getApiPagesForCatalogPage(pageNumber) {
  const start = ((pageNumber - 1) * APP_CONFIG.catalog.maxBatchRequests) + 1;
  return Array.from({ length: APP_CONFIG.catalog.maxBatchRequests }, (_, index) => start + index);
}

async function fetchCatalogItems() {
  const type = state.catalogFilters.type;
  const hasQuery = Boolean(state.catalogFilters.query);

  if (!hasQuery) {
    return fetchCatalogItemsByDiscover(type);
  }

  return fetchCatalogItemsBySearch(type);
}

async function fetchCatalogItemsByDiscover(type) {
  const endpoint = getTmdbListEndpoint(type, false);
  const pages = getApiPagesForCatalogPage(state.catalogPage);
  const responses = await Promise.all(
    pages.map((page) => tmdbGet(endpoint, buildTmdbParams(type, page, false)))
  );

  const merged = dedupeById(responses.flatMap((response) => response.results || []));
  const filtered = applyClientFilters(merged, type, true);
  const sorted = applyClientSort(filtered, type);
  return sorted.slice(0, APP_CONFIG.catalog.pageSize);
}

async function fetchCatalogItemsBySearch(type) {
  const endpoint = getTmdbListEndpoint(type, true);
  const items = [];
  const pages = getApiPagesForCatalogPage(state.catalogPage).slice(0, APP_CONFIG.catalog.maxSearchPages);

  for (const page of pages) {
    const response = await tmdbGet(endpoint, buildTmdbParams(type, page, true));
    const baseItems = applyClientFilters(response.results || [], type, false);
    const validatedItems = await filterItemsByProviders(baseItems, type);

    for (const item of validatedItems) {
      if (!items.some((existing) => existing.id === item.id)) {
        items.push(item);
      }
      if (items.length >= APP_CONFIG.catalog.pageSize) {
        break;
      }
    }

    if (items.length >= APP_CONFIG.catalog.pageSize) {
      break;
    }
  }

  return applyClientSort(items, type).slice(0, APP_CONFIG.catalog.pageSize);
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function filterItemsByProviders(items, type) {
  const checks = await Promise.all(items.map(async (item) => {
    const allowed = await isItemAllowedByProviders(item.id, type);
    return allowed ? item : null;
  }));

  return checks.filter(Boolean);
}

async function isItemAllowedByProviders(itemId, type) {
  const cacheKey = `${type}:${itemId}`;
  if (state.providerValidationCache.has(cacheKey)) {
    return state.providerValidationCache.get(cacheKey);
  }

  try {
    const providerPayload = await tmdbGet(`/${type}/${itemId}/watch/providers`);
    const countryData = providerPayload?.results?.[APP_CONFIG.providers.country];
    const matched = APP_CONFIG.providers.monetizationTypes.some((groupName) => {
      const group = countryData?.[groupName] || [];
      return group.some((provider) => state.providerIds.includes(provider.provider_id));
    });
    state.providerValidationCache.set(cacheKey, matched);
    return matched;
  } catch (error) {
    console.warn('Provider validation error', itemId, error);
    state.providerValidationCache.set(cacheKey, false);
    return false;
  }
}

function applyClientFilters(items, type, skipQueryFilter = false) {
  const genreId = state.catalogFilters.genre;
  const year = state.catalogFilters.year;
  const minRating = Number.parseFloat(state.catalogFilters.rating || '0');
  const query = state.catalogFilters.query.trim().toLocaleLowerCase('it');

  return items.filter((item) => {
    if (genreId && !item.genre_ids?.map(String).includes(String(genreId))) {
      return false;
    }

    if (year) {
      const itemYear = getItemYear(item, type);
      if (String(itemYear) !== String(year)) {
        return false;
      }
    }

    if ((item.vote_average || 0) < minRating) {
      return false;
    }

    if (!skipQueryFilter && query) {
      const title = getItemTitle(item, type).toLocaleLowerCase('it');
      if (!title.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

function applyClientSort(items, type) {
  const sorted = [...items];
  const mode = state.catalogFilters.sort;

  const compareText = (a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' });
  const compareNumberDesc = (a, b) => (b || 0) - (a || 0);
  const compareNumberAsc = (a, b) => (a || 0) - (b || 0);

  sorted.sort((left, right) => {
    switch (mode) {
      case 'vote_average.desc':
        return compareNumberDesc(left.vote_average, right.vote_average);
      case 'vote_average.asc':
        return compareNumberAsc(left.vote_average, right.vote_average);
      case 'primary_release_date.asc':
        return compareText(getItemDate(left, type), getItemDate(right, type));
      case 'primary_release_date.desc':
        return compareText(getItemDate(right, type), getItemDate(left, type));
      case 'title.asc':
        return compareText(getItemTitle(left, type), getItemTitle(right, type));
      case 'title.desc':
        return compareText(getItemTitle(right, type), getItemTitle(left, type));
      case 'popularity.desc':
      default:
        return compareNumberDesc(left.popularity, right.popularity);
    }
  });

  return sorted;
}

function getItemTitle(item, type) {
  return type === 'movie' ? (item.title || item.original_title || 'Senza titolo') : (item.name || item.original_name || 'Senza titolo');
}

function getItemDate(item, type) {
  return type === 'movie' ? (item.release_date || '') : (item.first_air_date || '');
}

function getItemYear(item, type) {
  const dateValue = getItemDate(item, type);
  return dateValue ? dateValue.slice(0, 4) : '';
}

function getPosterUrl(posterPath) {
  if (!posterPath) return '';
  if (/^https?:\/\//i.test(posterPath)) return posterPath;

  const normalizedPath = posterPath.startsWith('/') ? posterPath : `/${posterPath}`;
  const base = (state.imageBaseUrl || '').replace(/\/+$/, '');
  if (base) return `${base}${normalizedPath}`;

  return `${APP_CONFIG.catalog.fallbackPosterBase}${APP_CONFIG.catalog.fallbackPosterSize}${normalizedPath}`;
}

function getProviderLogoUrl(logoPath) {
  if (!logoPath) return '';
  if (/^https?:\/\//i.test(logoPath)) return logoPath;

  const normalizedPath = logoPath.startsWith('/') ? logoPath : `/${logoPath}`;
  const base = (state.logoBaseUrl || state.imageBaseUrl || '').replace(/\/+$/, '');
  if (base) return `${base}${normalizedPath}`;

  return `${APP_CONFIG.catalog.fallbackPosterBase}w92${normalizedPath}`;
}

function updatePaginationControls(itemsCount) {
  dom.catalogPageInfo.textContent = `Pagina ${state.catalogPage}`;
  dom.catalogPrev.disabled = state.catalogPage <= 1;
  dom.catalogNext.disabled = itemsCount < APP_CONFIG.catalog.pageSize;
}

function changeCatalogPage(direction) {
  const nextPage = Math.max(1, state.catalogPage + direction);
  if (nextPage === state.catalogPage) return;
  state.catalogPage = nextPage;
  void fetchAndRenderCatalog();
}

function renderCatalogLoading() {
  dom.catalogGrid.innerHTML = '<div class="catalog-loading">Caricamento risultati TMDB...</div>';
}

function renderCatalogError(message) {
  dom.catalogGrid.innerHTML = `<div class="catalog-empty">${escapeHtml(message)}</div>`;
}

function renderCatalogItems(items) {
  if (!items.length) {
    dom.catalogGrid.innerHTML = '<div class="catalog-empty">Nessun risultato disponibile con i filtri correnti.</div>';
    return;
  }

  const type = state.catalogFilters.type;
  dom.catalogGrid.innerHTML = items.map((item) => renderCatalogCard(item, type)).join('');

  $all('.catalog-card').forEach((card) => {
    card.addEventListener('click', () => handleCatalogCardSelection({
      id: Number(card.dataset.id),
      mediaType: card.dataset.mediaType,
      title: card.dataset.title
    }));

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCatalogCardSelection({
          id: Number(card.dataset.id),
          mediaType: card.dataset.mediaType,
          title: card.dataset.title
        });
      }
    });
  });

  $all('.catalog-plot-btn').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });
}

function renderCatalogCard(item, type) {
  const title = getItemTitle(item, type);
  const posterUrl = getPosterUrl(item.poster_path);
  const posterHtml = posterUrl
    ? `<img src="${escapeHtmlAttribute(posterUrl)}" alt="Poster ${escapeHtmlAttribute(title)}" loading="lazy" referrerpolicy="no-referrer">`
    : `<div class="catalog-poster-placeholder">Poster non disponibile</div>`;

  return `
    <article
      class="catalog-card"
      tabindex="0"
      data-id="${item.id}"
      data-media-type="${type}"
      data-title="${escapeHtmlAttribute(title)}"
      aria-label="Seleziona ${escapeHtmlAttribute(title)}"
    >
      <div class="catalog-poster">
        ${posterHtml}
        <div class="catalog-overlay">
          <a
            class="catalog-plot-btn"
            href="https://www.themoviedb.org/${type === 'movie' ? 'movie' : 'tv'}/${item.id}?language=it-IT"
            target="_blank"
            rel="noopener noreferrer"
          >Leggi Trama</a>
        </div>
      </div>
      <div class="catalog-card-body">
        <h3 class="catalog-card-title">${escapeHtml(title)}</h3>
      </div>
    </article>
  `;
}

function handleCatalogCardSelection({ id, mediaType, title }) {
  if (mediaType === 'movie') {
    switchTab('film');
    dom.filmCode.value = String(id);
    closeCatalog();
    watchMovie();
    showToast(`Film selezionato: ${title}. Avvio player...`);
    return;
  }

  switchTab('serie');
  dom.serieCode.value = String(id);
  closeCatalog();
  dom.serieCode.focus();
  showToast(`Serie selezionata: ${title}. Ora scegli stagione ed episodio.`);
}

function setCatalogFeedback(message, isError = false) {
  dom.catalogFeedback.textContent = message;
  dom.catalogFeedback.style.color = isError ? '#d89a9a' : '';
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');

  if (state.toastTimeoutId) {
    clearTimeout(state.toastTimeoutId);
  }

  state.toastTimeoutId = window.setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 2600);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

document.addEventListener('DOMContentLoaded', init);
