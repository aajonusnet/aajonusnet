const getById = (id) => document.getElementById(id);

/* ====
 ARTICLE PAGE ONLY
   ==== */

function goBack(ev) {
  if (ev) ev.preventDefault();
  if (document.referrer && document.referrer.includes(location.hostname) && history.length > 1) {
    history.back();
  } else { // There is no previous page, go to the homepage
    location.href = '/';
  }
}

function shareArticle() {
  const url = location.href;
  // Check if Web Share API is supported
  if (navigator.share) {
    navigator.share({
      title: document.title, url
    }).catch(() => {});
  } else {
    // Fallback to copying URL to clipboard
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("URL copied to clipboard.");
  }
}
function removeHighlights() {
  const btn = getById('remove-highlights');
  if (!btn) return;
  // Remove highlights
  document.querySelectorAll('mark').forEach(el => {
    el.outerHTML = el.innerHTML;
  });
  // Hide the "Remove Highlights" button
  btn.remove();
  // Update URL
  let url = location.href.split('?')[0];
  history.replaceState({}, '', url);
}

const pageContent = getById('content');

if (pageContent) {
  // Scroll to position
  (() => {
    if (typeof scrollToPos !== 'number') return;
    const w = document.createTreeWalker(pageContent, NodeFilter.SHOW_TEXT);
    let a = 0, n;
    while (n = w.nextNode()) {
      const len = n.length;
      if (a + len > scrollToPos) {
        const r = document.createRange();
        r.setStart(n, scrollToPos - a);
        r.collapse(true);
        const h = document.querySelector('header').offsetHeight || 0,
        rect = r.getClientRects()[0] || n.parentElement.getBoundingClientRect();
        scrollTo(0, scrollY + rect.top - h - innerHeight * 0.3);
        break;
      }
      a += len;
    }
  })();

  // Highlight terms
  (() => {
    const s = new URLSearchParams(location.search).get('s');
    if (!s) return;
    const a = s.split(/[+\s]+/).filter(Boolean).filter(w => w.length > 1 || /[^a-z]/i.test(w)).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!a.length) return;
    const re = new RegExp(a.join('|'), 'giu');
    const w = document.createTreeWalker(pageContent, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n; n = w.nextNode();) {
      nodes.push(n);
    }
    for (const n of nodes) {
      const t = n.nodeValue;
      if (t.search(re) < 0) continue;
      n.parentNode.replaceChild(document.createRange().createContextualFragment(t.replace(re, m => `<mark>${m}</mark>`)), n);
    }
  })();

  const remBtn = getById('remove-highlights');
  if (remBtn) {
    remBtn.addEventListener('click', removeHighlights);
  }

  // Image preview / spoiler
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('a');
    if (!target || !/\.(jpe?g|png|gif|webp)$/i.test(target.href)) return;
    
    e.preventDefault();
    const next = target.nextElementSibling;
    if (next && next.classList.contains('image-preview-container')) {
      next.remove();
      return;
    }
    const preview = document.createElement('div');
    preview.className = 'image-preview-container';
    const img = document.createElement('img');
    img.src = target.href;
    img.className = 'image-preview';
    preview.appendChild(img);
    target.parentNode.insertBefore(preview, target.nextSibling);
  });
}

/* ====
HOMEPAGE ONLY
   ==== */

const EMOJI_VS = /[\uFE0E\uFE0F]/g; // Ignore emoji variation selector

// worker-based search state
let searchWorker = null;
let searchSeq = 0;
let lastPendingQuery = null;

// Rendering state for streamed batches
let renderState = {
  seq: 0,
  queue: [],
  raf: 0,
  results_DOM: null,
  exactFrag: null,
  partialFrag: null,
  totalResults: 0,
  urlSearchTermsExact: '',
  urlSearchTermsPartial: null,
  exactSection: null,
  partialSection: null,
  partialHeadingEl: null,
  partialHeadingShown: false,
  summaryEl: null,
};

const CARDS = document.getElementsByClassName('card-md');

// Map dataId -> { card, title, link }
const cardIndex = new Map();

const searchEl = getById('search');

function buildCardIndex() {
  if (cardIndex.size) return;
  for (let i = 0, n = CARDS.length; i < n; i++) {
    const card = CARDS[i];
    const h2 = card.querySelector('h2');
    const titleText = h2 ? h2.textContent : '';
    const title = titleText.toLowerCase();
    const link = card.querySelector('.read-more').getAttribute('href');
    const dataId = card.dataset.id;
    cardIndex.set(dataId, { card, title, titleText, link });
  }
}

function initSearchWorker() {
  if (searchWorker) {
    // refresh docs on re-init (e.g., after cache reset)
    const docs = [];
    cardIndex.forEach((v, id) => {
      const entry = articleData[id];
      if (entry && entry.text) docs.push({ id, text: entry.text, title: v.title });
    });
    try { searchWorker.postMessage({ type: 'init', docs }); } catch {}
    return;
  }

  searchWorker = new Worker('/code/localsearch.js');
  searchWorker.onmessage = (e) => {
    const msg = e.data;
    if (msg.seq !== undefined && msg.seq !== searchSeq) return;
    if (msg.type === 'ready') {
      if (lastPendingQuery) {
        try { searchWorker.postMessage(lastPendingQuery); } catch {}
        lastPendingQuery = null;
      }
      return;
    }
    if (msg.type === 'reset') {
      return startNewRender(msg.seq, msg.searchValue, msg.words, msg.trimmedSearchValue);
    }
    if (msg.type === 'batch') {
      return enqueueRenderItems(msg.seq, msg.results);
    }
    if (msg.type === 'done') {
      return finishRender(msg.seq, msg.totalResults);
    }
  };

  const docs = [];
  cardIndex.forEach((v, id) => {
    const entry = articleData[id];
    if (entry && entry.text) docs.push({ id, text: entry.text, title: v.title });
  });
  searchWorker.postMessage({ type: 'init', docs });
}

async function search(input) {
  const catBar = getById('categories');
  const grid = getById('grid');
  const results_DOM = getById('results');

  const searchValue = input.value.replace(EMOJI_VS, '').toLowerCase();
  const trimmedSearchValue = searchValue.trim();
  const words = searchValue.split(/\s+/).filter(word => word);

  getById('clear-icon').hidden = searchValue.length > 0 ? false : true;

  // at least one token must be non-alpha OR 3+ chars
  const isAl = /^[a-z]+$/i;
  const valid = words.some(word => (!isAl.test(word) || word.length >= 3));

  if (!valid) {
    grid.hidden = false;
    results_DOM.hidden = true;
    catBar.hidden = false;
    results_DOM.innerHTML = '';
    return;
  }
  
  catBar.hidden = true;
  grid.hidden = true;
  results_DOM.hidden = false;

  // ensure indexes and worker are ready
  buildCardIndex();
  if (!searchWorker) initSearchWorker();

  // bump sequence so any in-flight query becomes stale
  const seq = ++searchSeq;
  const queryMsg = { type: 'query', seq, searchValue, trimmedSearchValue, words };

  try {
    searchWorker.postMessage(queryMsg);
  } catch {
    // worker not ready yet; queue it
    lastPendingQuery = queryMsg;
  }
}

function startNewRender(seq, searchValue, words, trimmedSearchValue) {
  renderState.seq = seq;
  renderState.queue = [];
  if (renderState.raf) cancelAnimationFrame(renderState.raf);
  renderState.raf = 0;

  const results_DOM = getById('results');
  if (!results_DOM) return;
  renderState.results_DOM = results_DOM;

  // Clear fast; show searching
  results_DOM.innerHTML = '';
  const summary = document.createElement('p');
  summary.className = 'results-summary';
  summary.textContent = 'Searching…';
  results_DOM.appendChild(summary);

  renderState.summaryEl = summary;

  renderState.exactFrag = document.createDocumentFragment();
  renderState.partialFrag = document.createDocumentFragment();

  renderState.exactSection = document.createElement('div');
  renderState.partialSection = document.createElement('div');

  const heading = document.createElement('p');
  heading.className = 'partial-heading';
  heading.hidden = true;
  heading.textContent = 'Partial matches:';
  renderState.partialHeadingEl = heading;
  renderState.partialHeadingShown = false;

  renderState.totalResults = 0;
  renderState.urlSearchTermsExact = encodeURIComponent(searchValue.split(" ").join('+'));
  renderState.urlSearchTermsPartial = (words.length > 1) ? encodeURIComponent(words.join('+')) : null;

  // Do title-only matches synchronously (cheap)
  const titleWords = (trimmedSearchValue || '').split(/\s+/).filter(Boolean);
  if (titleWords.length) {
    const fragmentTitle = document.createDocumentFragment();
    let titleMatchCount = 0;
    cardIndex.forEach(({ card, title, titleText, link }) => {
      if (titleWords.every(w => title.includes(w))) {
        fragmentTitle.appendChild(createResultCard(titleText, [], link));
        titleMatchCount++;
      }
    });
    results_DOM.appendChild(fragmentTitle);
    renderState.totalResults = titleMatchCount;
  }
  results_DOM.appendChild(renderState.exactSection);
  results_DOM.appendChild(heading);
  results_DOM.appendChild(renderState.partialSection);
}

function enqueueRenderItems(seq, items) {
  if (seq !== renderState.seq) return; // stale
  renderState.queue.push(...items);
  if (!renderState.raf) {
    renderState.raf = requestAnimationFrame(flushRenderQueue);
  }
}

function commitFrags() {
  if (renderState.exactFrag && renderState.exactFrag.childNodes.length) {
    renderState.exactSection.appendChild(renderState.exactFrag);
    renderState.exactFrag = document.createDocumentFragment();
  }
  if (renderState.partialFrag && renderState.partialFrag.childNodes.length) {
    if (!renderState.partialHeadingShown && renderState.partialHeadingEl) {
      renderState.partialHeadingEl.hidden = false;
      renderState.partialHeadingShown = true;
    }
    renderState.partialSection.appendChild(renderState.partialFrag);
    renderState.partialFrag = document.createDocumentFragment();
  }
}

function processQueueItem(r) {
  const idx  = cardIndex.get(r.id);
  if (!idx) return;
  const link = idx.link, titleText = idx.titleText;
  const urlSearchTermsExact = renderState.urlSearchTermsExact, urlSearchTermsPartial = renderState.urlSearchTermsPartial;

  const makeCard = (strings) => createResultCard(titleText, strings, link);

  if (r.exact && r.exact.length) {
    const exactStrings = r.exact.map(item =>
      `<a class='result-text' href="${link}?s=${urlSearchTermsExact}&search=${item.frag}">${item.html}</a><hr>`
    );
    renderState.exactFrag.appendChild(makeCard(exactStrings));
    renderState.totalResults += r.exact.length;
  }
  if (r.partial && r.partial.length) {
    const partialStrings = r.partial.map(item =>
      `<a class='result-text' href="${link}?s=${urlSearchTermsPartial}&search=${item.frag}">${item.html}</a><hr>`
    );
    renderState.partialFrag.appendChild(makeCard(partialStrings));
    renderState.totalResults += r.partial.length;
  }
}

function flushRenderQueue() {
  renderState.raf = 0;
  if (!renderState.results_DOM) return;

  const start = performance.now();
  const BUDGET_MS = 12; // keep under a frame
  const queue = renderState.queue;
  let processed = 0;

  while (queue.length && (performance.now() - start) < BUDGET_MS) {
    const r = queue.shift();
    processQueueItem(r);

    if (++processed % 5 === 0) {
      commitFrags();
    }
  }
  // update summary progressively
  if (renderState.summaryEl) {
    const txt = `There ${renderState.totalResults === 1 ? 'is 1 result' : `are ${renderState.totalResults} results`}.`;
    if (renderState.summaryEl.textContent !== txt) renderState.summaryEl.textContent = txt;
  }

  // Keep going next frame if there’s more
  if (queue.length) {
    renderState.raf = requestAnimationFrame(flushRenderQueue);
  }
}

function finishRender(seq, totalResultsFromWorker) {
  if (seq !== renderState.seq || !renderState.results_DOM) return;

  if (renderState.queue.length) {
    const SMALL_QUEUE = 50; // tune
    if (renderState.queue.length <= SMALL_QUEUE) {
      // small: drain now (keeps "tiny" searches instant)
      while (renderState.queue.length) processQueueItem(renderState.queue.shift());
    } else {
      // large: let rAF handle it to keep typing smooth
      if (!renderState.raf) renderState.raf = requestAnimationFrame(flushRenderQueue);
    }
  }
  commitFrags();

  const total = totalResultsFromWorker ?? renderState.totalResults;
  if (renderState.summaryEl) renderState.summaryEl.textContent = `There ${total === 1 ? 'is 1 result' : `are ${total} results`}.`;
}

function createResultCard(titleText, results, link) {
  const card = document.createElement('div');
  card.className = 'card';

  const resultTitle = document.createElement('h2');
  resultTitle.innerHTML = `<a class="result-title" href="${link}">${titleText}</a>`;
  card.appendChild(resultTitle);

  if (results.length) {
    card.insertAdjacentHTML('beforeend', results.join(''));
  }
  return card;
}

function filterCategory(ev, category, sanitizedCategory, element) {
  if (ev) ev.preventDefault();
  // Deselect all categories
  document.querySelectorAll('#categories a.chosen-category').forEach(a => a.removeAttribute('class'));
  // Select the category
  element.classList.add('chosen-category');

  // Clear search input
  searchEl.value = '';
  const clearIcon = getById('clear-icon');
  if (clearIcon) clearIcon.hidden = true;

  const showAll = category === 'All';
  for (let i = 0, n = CARDS.length; i < n; i++) {
    const card = CARDS[i];
    const cardCategory = card.getElementsByClassName('category')[0].textContent;
    card.hidden = !showAll && !cardCategory.startsWith(category);
  }
  // Update URL without reloading the page
  history.replaceState({}, '', showAll ? '/' : `/${sanitizedCategory}/`);
}

function clearSearch() {
  searchEl.value = '';
  search(searchEl);
  const ci = getById('clear-icon');
  if (ci) ci.hidden = true;
  searchEl.focus();
}

let db;
let articleData = {}; // Global variable to store data
let hasRetried = false;

if (searchEl) {
  searchEl.addEventListener('click', function() {
    if (searchEl.classList.contains('search-error')) {
      loadContentAsync();
    }
  });
  searchEl.addEventListener('keyup', function(event) {
    // Key code 13 is the "Return" key
    if (event.keyCode === 13) {
      // Remove focus to close the keyboard
      searchEl.blur();
    }
  });


  // Open or create the search database
  const openRequest = indexedDB.open("myDatabase", 1);
  openRequest.onupgradeneeded = function(event) {
    db = event.target.result;
    db.createObjectStore("myData", { keyPath: "id" });
  };
  openRequest.onsuccess = function(event) {
    db = event.target.result;
    // Now that the database is open, load the content
    // Start once, but only after DOM is ready
    if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContentAsync, { once: true });
    } else {
      loadContentAsync();
    }
  };
  openRequest.onerror = function(event) {
    //console.error("Error opening IndexedDB:", event);
  };
}

function populateAndEnableSearch(data) {
  try {
    const tempDiv = document.createElement('div');
    articleData = {};
    // Populate articleData with parsed HTML content
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      const id = keys[i];
      tempDiv.innerHTML = data[id];
      articleData[id] = { text: tempDiv.textContent.toLowerCase() };
    }
     tempDiv.remove();
     searchEl.disabled = false;
     searchEl.placeholder = "Search";
     search(searchEl); // Initiate search if necessary
     hasRetried = false;
     buildCardIndex();
     initSearchWorker();
  } catch (error) {
    //console.error("Error:", error);
    if (!hasRetried) { // Reset the cache
      hasRetried = true;
      const transaction = db.transaction(["myData"], "readwrite");
    transaction.objectStore("myData").delete("allData");
      loadContentAsync();
    }
  }
}

// Store entire dataset in IndexedDB with expiration time
function storeAllData(data) {
  const expireTime = new Date().getTime() + 24 * 60 * 60 * 1000; // 24 hours from now
  const transaction = db.transaction(["myData"], "readwrite");
  const objectStore = transaction.objectStore("myData");
  objectStore.put({ id: "allData", content: data, expireTime: expireTime });
}

// Retrieve entire dataset from IndexedDB, checking for expiration
function retrieveAllData(callback) {
  const tx = db.transaction(["myData"], "readonly");
  const store = tx.objectStore("myData");
  const request = store.get("allData");

  request.onsuccess = function(event) {
    const currentTime = new Date().getTime();
    if (request.result && request.result.expireTime > currentTime) {
      callback(request.result.content);
    } else {
      const delTx = db.transaction(["myData"], "readwrite");
    delTx.objectStore("myData").delete("allData");
      callback(null);
    }
  };
}

function getCachedData() {
  return new Promise(resolve => retrieveAllData(resolve));
}

async function loadContentAsync() {
  if (!searchEl) return;
  searchEl.classList.remove('search-error');
  searchEl.readOnly = false;
  searchEl.disabled = true;
  searchEl.placeholder = 'Loading...';

  const cached = await getCachedData();
  if (cached) {
    populateAndEnableSearch(cached);
    searchEl.disabled = false;
    return;
  }

  searchEl.placeholder = 'Loading... 0%';

  try {
    const response = await fetch('/code/loadsearch.php');
    if (!response.ok) throw new Error('Network error');
    const total = parseInt(response.headers.get('X-Total-Uncompressed-Length'), 10);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let raw = '';
    let loaded  = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      raw += chunk;
      loaded += chunk.length;

      const pct = Math.min(100, Math.round((loaded / total) * 100));
      searchEl.placeholder = `Loading... ${pct}%`;
    }
    const data = JSON.parse(raw);
    storeAllData(data);
    populateAndEnableSearch(data);
    searchEl.disabled = false;
  } catch (e) {
    searchEl.disabled = false;
    searchEl.readOnly = true;
    searchEl.classList.add('search-error');
    searchEl.value = '';
    searchEl.placeholder = 'Tap to retry';
  }
}