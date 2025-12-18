const EMOJI_VS = /[\uFE0E\uFE0F]/g; // Ignore emoji variation selector

async function search(input) {
    const searchValue = input.value.replace(EMOJI_VS, '').toLowerCase();
    const trimmedSearchValue = searchValue.trim();
    const catBar = document.querySelector('.categories');
    const grid = document.querySelector('.grid');
    const results_DOM = document.querySelector('.results');
    results_DOM.innerHTML = '';

    const words = searchValue.split(/\s+/).filter(word => word && word !== "the");

    document.getElementById('clear-icon').style.display = searchValue.length > 0 ? 'block' : 'none';

    const isAl = /^[a-z]+$/i;
    const hasValidToken = words.some(word => {
        return !isAl.test(word) || word.length >= 3;
    });
    if (!hasValidToken) {
        // Less than 3 consecutive non-space characters, ignore this search
        grid.style.display = 'block';
        results_DOM.style.display = 'none';
        catBar.style.display = 'flex';
        return;
    }
    catBar.style.display = 'none';
    grid.style.display = 'none';
    results_DOM.style.display = 'block';
    
    const cards = document.querySelectorAll('.card-md');
    const fragmentTitle = document.createDocumentFragment();
    const fragmentExact = document.createDocumentFragment();
    const fragmentPartial = document.createDocumentFragment();
    
    let totalResults = 0;

    const searchTitleWords = trimmedSearchValue.split(/\s+/);
    for (let i = 0; i < cards.length; i++) {
       const card = cards[i];
       const title = card.querySelector('h2').textContent.toLowerCase();
       const link = card.querySelector('.read-more').href;
       const dataId = card.querySelector('.data').id;
       const dataEntry = articleData[dataId];

       if (!dataEntry || !dataEntry.text) {
           console.warn(`Missing article data for ID: ${dataId}`);
           continue;
       }

       const content = dataEntry.text;
       const [exactResults, partialResults] = highlightSearchText(content, searchValue, words, link);

       if (searchTitleWords.every(word => title.includes(word))) {
           const resultCard = createResultCard(card, [], link);
           fragmentTitle.appendChild(resultCard);
       }

       totalResults += exactResults.length + partialResults.length;

	   if (exactResults.length > 0) {
           const resultCard = createResultCard(card, exactResults, link);
           fragmentExact.appendChild(resultCard);
       }
	   if (partialResults.length > 0) {
            const resultCard = createResultCard(card, partialResults, link);
            fragmentPartial.appendChild(resultCard);
        }
     }

     // Display the total number of results
     const resultsSummary = document.createElement('p');
     resultsSummary.classList.add('results-summary');
     resultsSummary.textContent = `There are ${totalResults} results.`;
     results_DOM.insertBefore(resultsSummary, results_DOM.firstChild);
    
     if (fragmentExact.childElementCount === 0 && fragmentPartial.childElementCount === 0) {
       const noResults = document.createElement('p');
       noResults.textContent = 'No results found';
       fragmentExact.appendChild(noResults);
     }
    
     results_DOM.appendChild(fragmentTitle);
     results_DOM.appendChild(fragmentExact); // Append exact matches


     if (fragmentPartial.childElementCount > 0) {
          results_DOM.insertAdjacentHTML('beforeend', '<p style="font-style:italic; margin:20px 0 10px;">Partial matches:</p>');
     }
     results_DOM.appendChild(fragmentPartial); // Append partial matches
}

function createResultCard(card, results, link) {
    // Create a new card for the search result
    const resultCard = document.createElement('div');
    resultCard.className = 'card';

    const resultTitle = document.createElement('h2');
    resultTitle.innerHTML = `<a class="result-link" href="${link}">${card.querySelector('h2').textContent}</a>`;
    resultCard.appendChild(resultTitle);

    if (results.length == 0) {
        return resultCard;
    }

    for (let result of results) {
        const resultContent = document.createElement('p');
        resultContent.innerHTML = result;
        resultCard.appendChild(resultContent);
    }

    return resultCard;
}

function highlightSearchText(text, searchValue, words, link) {
    const maxLength = 200; // Maximum number of characters to display before and after the search value
    
    let exactMatches = [], partialMatches = [];
    findMatches(text, searchValue, words, maxLength, link, exactMatches, partialMatches);

    return [exactMatches, partialMatches];
}

function findMatches(text, searchValue, words, maxLength, link, exactMatches, partialMatches) {
    const partial = words.length > 1;
    let urlSearchTermsExact = encodeURIComponent(searchValue.split(" ").join('+'));
    let urlSearchTermsPartial = partial ? (encodeURIComponent(words.join('+'))) : null;

    const exactRegex = new RegExp(`(${escapeRegExp(searchValue)})`, 'gi');
    const partialRegex = partial ? (new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi')) : null;

    let lastWindowEnd = 0;
    words.forEach(word => {
        let offset = text.indexOf(word);
        while (offset !== -1) {
            let start = Math.max(0, offset - maxLength);
            if (start < lastWindowEnd) start = lastWindowEnd;

            let end = Math.min(text.length, start + (maxLength * 2));

            // Support emojis
            if (start > 0 && isLow(text.charCodeAt(start))) start--;
            if (end < text.length && isHigh(text.charCodeAt(end - 1))) end++;

            let windowText = text.substring(start, end);

            let exactMatchPos = windowText.indexOf(searchValue);
            let partialMatchPos = partial ? (words.every(w => windowText.indexOf(w) !== -1) ? windowText.indexOf(words[0]) : -1) : -1;

            if (exactMatchPos !== -1) {
                let fragment = encodeURIComponent(windowText);
                let highlightedResult = highlightTerms(windowText, exactRegex);
                exactMatches.push(`<a class='result-link' href=${link}?s=${urlSearchTermsExact}&search=${fragment}>${highlightedResult}</a><br><br><hr>`);
            } else if (partial && partialMatchPos !== -1) {
                let fragment = encodeURIComponent(windowText);
                let highlightedResult = highlightTerms(windowText, partialRegex);
                partialMatches.push(`<a class='result-link' href=${link}?s=${urlSearchTermsPartial}&search=${fragment}>${highlightedResult}</a><br><br><hr>`);
            }

            lastWindowEnd = end;
            offset = text.indexOf(word, offset + 1);
        }
    });
}

function highlightTerms(text, regex) {
    return text.replace(regex, '<span class="highlight">$1</span>');
}


function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isHigh(cp) { return cp >= 0xD800 && cp <= 0xDBFF; }
function isLow(cp) { return cp >= 0xDC00 && cp <= 0xDFFF; }


function clearSearch() {
    const searchInput = document.getElementById('search');
    searchInput.value = '';
    search(searchInput);
    document.getElementById('clear-icon').style.display = 'none';
    searchInput.focus();
}

function goBack() {
    if (document.referrer == "" || document.referrer.indexOf(window.location.hostname) < 0 || window.history.length <= 1) {
        // There is no previous page, go to the homepage
        window.location.href = '/';
    } else {
        // There is a previous page in the history stack, go back to it
        window.history.back();
    }
}

window.onload = function() {
	const searchInput = document.getElementById('search');
	if (searchInput){
		searchInput.focus();
		search(searchInput) // may be not needed
        searchInput.addEventListener('keyup', function(event) {
            // Key code 13 is the "Return" key
            if (event.keyCode === 13) {
                // Remove focus to close the keyboard
                searchInput.blur();
            }
        });
	}
};

function scrollToElement(element) {
	const viewHeight = window.innerHeight;
	const elementPosition = element.getBoundingClientRect().top;
	const scrollPosition = elementPosition - (viewHeight / 2);
	window.scrollBy({
		top: scrollPosition,
		behavior: 'smooth'
     });
}
function scrollToPosition() {
    const element = document.getElementById("scrollToThis");
    if (element) {
        scrollToElement(element);
        return;
    }
    const specialBlocks = document.querySelectorAll("code, pre");
    for (let block of specialBlocks) {
        const index = block.textContent.indexOf('<span id="scrollToThis"></span>');
        if (index !== -1) {
            scrollToElement(block);
            // Remove the <span id="scrollToThis"></span> from the text content
            block.textContent = block.textContent.replace('<span id="scrollToThis"></span>', '');
            return;
         }
     }
}
scrollToPosition();

document.body.addEventListener('click', function(e) {
    let target = e.target;
    
    // Traverse up to find the anchor tag
    while (target && target.tagName !== 'A') {
        target = target.parentNode;
    }
    
    // If an anchor tag is found and it matches the criteria
    if (target && /\.(jpg|png|gif)$/.test(target.href)) {
        e.preventDefault();
        const imgSrc = target.href;
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '10px auto';
        img.style.border = '1px solid #ddd';
        previewDiv.appendChild(img);

        // Toggle the image preview
        if (target.nextElementSibling && target.nextElementSibling.className === 'image-preview') {
            target.parentNode.removeChild(target.nextElementSibling);
        } else {
            target.parentNode.insertBefore(previewDiv, target.nextSibling);
        }
    }
});

function filterCategory(category, sanitizedCategory, element) {
  // Deselect all categories
  event.preventDefault();
  const categories = document.querySelectorAll('.categories a');
  for (let i = 0; i < categories.length; i++) {
    categories[i].classList.remove('chosen-category');
  }

  // Clear search input
  const searchInput = document.getElementById('search');
  searchInput.value = '';
  search(searchInput);


  // Select the clicked category
  element.classList.add('chosen-category');

  const cards = document.getElementsByClassName('card-md');
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const cardCategory = card.getElementsByClassName('category')[0].innerText;

    if (category === 'All' || cardCategory.startsWith(category)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  }

  const notFoundMessage = document.getElementById('not-found');
  if (notFoundMessage) {
    notFoundMessage.style.display = 'none';
  }

  // Update URL without reloading the page
  if (category === 'All') {
    window.history.replaceState({}, '', '/');
  } else {
    window.history.replaceState({}, '', `/${sanitizedCategory}/`);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const removeHighlightsBtn = document.getElementById("removeHighlights");
  
  if (removeHighlightsBtn) {
    removeHighlightsBtn.addEventListener("click", function() {
        removeHighlights();
    });
    document.querySelectorAll("code, pre").forEach(el => {
        el.innerHTML = el.innerHTML.replace(/&lt;span class="highlight"&gt;(.*?)&lt;\/span&gt;/g, '<span class="highlight">$1</span>');
    });
  }
});

function removeHighlights() {
      const removeHighlightsBtn = document.getElementById("removeHighlights");
      if (!removeHighlightsBtn) {
          return;
      }
      // Remove highlights
      const highlighted = document.querySelectorAll(".highlight");
      for (let i = 0; i < highlighted.length; i++) {
        highlighted[i].outerHTML = highlighted[i].innerHTML;
      }

      // Hide the "X Remove Highlights" button
      removeHighlightsBtn.style.display = "none";
  
      // Update URL
      let url = window.location.href;
      url = url.split('?')[0];
      window.history.replaceState({}, '', url);
}

function shareArticle() {
    const url = window.location.href;

    // Check if Web Share API is supported
    if (navigator.share) {
        navigator.share({
            title: document.title,
            url: url
        }).then(() => {
            console.log("Successfully shared.");
        }).catch((error) => {
            console.log("Error sharing:", error);
        });
    } else {
      // Fallback to copying URL to clipboard
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("Copy");
      textArea.remove();
      alert("URL copied to clipboard.");
    }
}

// Open or create the database
let db;
const openRequest = indexedDB.open("myDatabase", 1);

openRequest.onupgradeneeded = function(event) {
  db = event.target.result;
  db.createObjectStore("myData", { keyPath: "id" });
};

openRequest.onsuccess = function(event) {
  db = event.target.result;
  // Now that the database is open, load the content
  loadContentAsync();
};

openRequest.onerror = function(event) {
  console.error("Error opening IndexedDB:", event);
};

let hasRetried = false;

// Global variable to store data
let articleData = {};

function populateAndEnableSearch(data) {
    try {
        const tempDiv = document.createElement('div');
        
        // Populate articleData with parsed HTML content
        Object.keys(data).forEach(id => {
            tempDiv.innerHTML = data[id];
            articleData[id] = {
                html: data[id],
                text: tempDiv.textContent.toLowerCase()
            };
        });
        const searchEl = document.getElementById("search");
        searchEl.disabled = false;
        searchEl.placeholder = "Search";
        search(searchEl); // Initiate search if necessary
        hasRetried = false;
    } catch (error) {
        console.error("Error:", error);
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
  const transaction = db.transaction(["myData"], "readonly");
  const objectStore = transaction.objectStore("myData");
  const request = objectStore.get("allData");

  request.onsuccess = function(event) {
    const currentTime = new Date().getTime();
    if (request.result && request.result.expireTime > currentTime) {
      callback(request.result.content);
    } else {
      const delTransaction = db.transaction(["myData"], "readwrite");
    delTransaction.objectStore("myData").delete("allData");
      callback(null);
    }
  };
}

function getCachedData() {
  return new Promise(resolve => retrieveAllData(resolve));
}

async function loadContentAsync() {
  const searchEl = document.getElementById('search');
  if (!searchEl) return;
  searchEl.disabled = true;
  searchEl.placeholder = 'Loading...';

  const cached = await getCachedData();
  if (cached) {
    populateAndEnableSearch(cached);
    return;
  }

  searchEl.placeholder = 'Loading... 0%';

  const response = await fetch('/loadsearch.php');

  const total = parseInt(
    response.headers.get('X-Total-Uncompressed-Length'),
    10
  );

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
}



// Entry point: Wait for the DOM to load before proceeding
document.addEventListener("DOMContentLoaded", function() {
  if (db) {
    loadContentAsync();
  }
  // If db is not available yet, it will be triggered by openRequest.onsuccess
});

const isPWA = () =>
  window.matchMedia?.('(display-mode: standalone)')?.matches ||
  !!window.navigator.standalone;

// FIND ON PAGE

let searchResults = [];
let currentResultIndex = -1;

// Debounce function to limit how often a function is called
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateFindOnPagePosition() {
    const bar = document.getElementById('find-on-page');
    if (window.visualViewport) {
        const { innerHeight } = window;
        const { height: vvHeight, offsetTop } = window.visualViewport;
        let kbHeight = innerHeight - (vvHeight + offsetTop);
        if (kbHeight < 0) kbHeight = 0;
        bar.style.bottom = kbHeight + 'px';
    } else {
        bar.style.bottom = '0';
    }
    if (isPWA()) bar.style.paddingBottom = 'calc(env(safe-area-inset-bottom, 0px) + 50px)';
}

function showFindOnPage() {
    removeHighlights();
    document.getElementById('find-on-page').style.display = 'flex';
    document.getElementById('activate-find-on-page').style.display = 'none';
    document.body.classList.add('find-on-page-active');
    const searchInput = document.getElementById('find-on-page-input');
    searchInput.focus();

    updateFindOnPagePosition();
    
    // Perform search if there's already text in the input
    if (searchInput.value.trim() !== '') {
        performSearch();
    }
}

function hideFindOnPage() {
    document.getElementById('find-on-page').style.display = 'none';
    document.getElementById('activate-find-on-page').style.display = 'flex';
    document.body.classList.remove('find-on-page-active');
    clearHighlights();
}

function clearHighlights() {
    document.querySelectorAll('.find-on-page-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
    });
    searchResults = [];
    currentResultIndex = -1;
    updateSearchCount();
}

function updateSearchCount() {
    const countElement = document.getElementById('find-on-page-count');
    if (searchResults.length > 0) {
        countElement.textContent = `${currentResultIndex + 1} of ${searchResults.length}`;
    } else {
        countElement.textContent = '0 of 0';
    }
}

function updateCurrentResultHighlight() {
    document.querySelectorAll('.find-on-page-highlight-current').forEach(el => {
        el.classList.remove('find-on-page-highlight-current');
    });
    if (currentResultIndex >= 0 && currentResultIndex < searchResults.length) {
        searchResults[currentResultIndex].classList.add('find-on-page-highlight-current');
    }
}

function scrollToCurrentResult() {
    if (currentResultIndex >= 0 && currentResultIndex < searchResults.length) {
        const result = searchResults[currentResultIndex];
        const rect = result.getBoundingClientRect();
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const scrollY = window.scrollY + rect.top - viewportHeight / 2 + rect.height / 2;
        window.scrollTo({
            top: scrollY,
            behavior: isPWA() ? 'auto' : 'smooth'
        });
        updateCurrentResultHighlight();
    }
}

function moveToNextResult() {
    if (searchResults.length > 0) {
        currentResultIndex = (currentResultIndex + 1) % searchResults.length;
        scrollToCurrentResult();
        updateSearchCount();
        if (isKeyboardOpen()) {
            document.getElementById('find-on-page-input').focus();
        }
    }
}

function moveToPreviousResult() {
    if (searchResults.length > 0) {
        currentResultIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
        scrollToCurrentResult();
        updateSearchCount();
        if (isKeyboardOpen()) {
            document.getElementById('find-on-page-input').focus();
        }
    }
}

function isKeyboardOpen() {
    return window.visualViewport && (window.innerHeight - window.visualViewport.height > 100);
}

function isElementVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function performSearch() {
    clearHighlights();
    const rawInput = document.getElementById('find-on-page-input').value.toLowerCase();
    if (rawInput.length === 0) return;

    const searchText = escapeRegExp(rawInput);
    const regex = new RegExp(searchText, 'gi');
    const body = document.body;
    
    function highlightMatches(node) {
        if (node.nodeType === Node.TEXT_NODE && isElementVisible(node.parentElement)) {
            const matches = node.textContent.match(regex);
            if (matches) {
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                matches.forEach((match) => {
                    const index = node.textContent.indexOf(match, lastIndex);
                    if (index > lastIndex) {
                        fragment.appendChild(document.createTextNode(node.textContent.slice(lastIndex, index)));
                    }
                    const span = document.createElement('span');
                    span.className = 'find-on-page-highlight';
                    span.textContent = match;
                    fragment.appendChild(span);
                    searchResults.push(span);
                    lastIndex = index + match.length;
                });
                if (lastIndex < node.textContent.length) {
                    fragment.appendChild(document.createTextNode(node.textContent.slice(lastIndex)));
                }
                node.parentNode.replaceChild(fragment, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && isElementVisible(node) && !['script', 'style', 'iframe', 'canvas', 'svg'].includes(node.tagName.toLowerCase())) {
            Array.from(node.childNodes).forEach(highlightMatches);
        }
    }

    highlightMatches(body);

    if (searchResults.length > 0) {
        currentResultIndex = 0;
        scrollToCurrentResult();
    }
    updateSearchCount();
}

// Wrap all event listeners in a DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    const activateButton = document.getElementById('activate-find-on-page');
    const searchInput = document.getElementById('find-on-page-input');
    const searchUp = document.getElementById('find-on-page-up');
    const searchDown = document.getElementById('find-on-page-down');
    const searchClose = document.getElementById('find-on-page-close');

    if (activateButton) {
        activateButton.addEventListener('click', showFindOnPage);
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(performSearch, 300));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                moveToNextResult();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideFindOnPage();
            }
        });
    }

    if (searchUp) {
        searchUp.addEventListener('click', moveToPreviousResult);
    }

    if (searchDown) {
        searchDown.addEventListener('click', moveToNextResult);
    }

    if (searchClose) {
        searchClose.addEventListener('click', hideFindOnPage);
    }
    if (activateButton && window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateFindOnPagePosition);
        window.visualViewport.addEventListener('scroll', updateFindOnPagePosition);
        window.addEventListener('focusin', updateFindOnPagePosition);
        window.addEventListener('focusout', () => setTimeout(updateFindOnPagePosition, 50));
        window.addEventListener('scroll',  updateFindOnPagePosition);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('find-on-page').style.display === 'flex') {
        e.preventDefault();
        hideFindOnPage();
    }
});

// ===== Transcript ↔ Audio Sync v3 (no offsets, no drift, DOM-safe) =====
(function () {
  const VS_RE = /[\uFE0E\uFE0F]/g;

  document.addEventListener('DOMContentLoaded', async () => {
    const meta   = document.getElementById('transcript-meta');
    const root   = document.querySelector('.content');
    const player = document.getElementById('player');
    if (!root || !player) return;

    const mdPath    = meta?.dataset.mdPath || '';
    const base      = mdPath ? mdPath.replace(/\.md$/i, '') : '';
    const audioPref = (meta?.dataset.audioSrc || '').trim();

    // pick audio (optional; remove if you set src in PHP)
    const audioCandidates = [audioPref, base && (base + '.mp3'), base && (base + '.m4a'), base && (base + '.wav')].filter(Boolean);
    if (!player.src) player.src = await firstExisting(audioCandidates).catch(() => '') || player.src || '';

    // load timestamped transcript
    const timefile = await firstExisting([base + '.srt', base + '.vtt', base + '.timestamped.txt'].filter(Boolean)).catch(() => null);
    if (!timefile) return;
    const tsText = await fetch(timefile).then(r => r.text());

    // parse → segments
    const segments = parseTimestamped(tsText);
    if (!segments.length) return;

    // wrap DOM text nodes → chunks (preserve links/formatting)
    const chunks = wrapTextNodesToChunks(root);
    if (!chunks.length) return;

    // align without adding seconds; all times come from transcript
    alignChunksToSegments(chunks, segments);

    // interactions
    setupClicks(chunks, player);
    setupTimeUpdate(chunks, player);

    injectMiniCSS(`
      .sync-chunk { display:inline; white-space:inherit; cursor:pointer }
      .sync-chunk.playing { background: rgba(255,235,150,.6); border-radius:4px }
    `);
  });

  // ---------- fetch helpers ----------
  async function firstExisting(cands){
    for (const url of cands){
      try {
        let r = await fetch(url, { method:'HEAD' });
        if (!r.ok) r = await fetch(url);
        if (r.ok) return url;
      } catch(e){}
    }
    throw new Error('no candidate');
  }

  // ---------- normalize / clean ----------
  function stripLabels(s){
    return s
      .replace(VS_RE, '')
      .replace(/\[[^\]]*?\]/g, ' ')                          // [Speaker 1], [laughs]
      .replace(/^\s*(?:speaker\s*\d+|spk\s*\d+)\s*[:\-–.]?\s*/i, '')
      .replace(/^\s*(?:q|a|f|h|m)\s*[:\-–.]?\s+/i, '')       // Q: A: F: H: M:
      .replace(/^\s*(?:fred|aajonus|kathy|host|caller|interviewer|audience|question|answer)\s*[:\-–.]?\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function normalize(s){
    return stripLabels(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---------- parse SRT/VTT or flat timestamped lines ----------
  function parseTimestamped(txt){
    const lines = txt.replace(/\r/g,'').split('\n');
    const segs = [];
    const cue = { start:null, end:null, buf:[] };
    const tsRE = /(\d{2}):(\d{2}):(\d{2})(?:[,\.](\d{1,3}))?\s*-->\s*(\d{2}):(\d{2}):(\d{2})(?:[,\.](\d{1,3}))?/;

    const push = () => {
      if (cue.start==null) return;
      const text = stripLabels(cue.buf.join(' ').trim());
      if (text) segs.push({ start:cue.start, end:cue.end, text, norm: normalize(text) });
      cue.start = cue.end = null; cue.buf.length = 0;
    };

    for (let i=0;i<lines.length;i++){
      const L = lines[i];
      if (i===0 && /^WEBVTT/i.test(L)) continue;
      const m = L.match(tsRE);
      if (m){
        push();
        cue.start = hms(m[1],m[2],m[3],m[4]);
        cue.end   = hms(m[5],m[6],m[7],m[8]);
        continue;
      }
      if (/^\s*$/.test(L)) { push(); continue; }
      if (/^\d+$/.test(L.trim())) continue; // cue id
      cue.buf.push(L);
    }
    push();

    if (!segs.length){
      // flat: "00:00:03,679 text..."
      const flat = /^(\d{2}):(\d{2}):(\d{2})(?:[,\.](\d{1,3}))?\s+(.*)$/;
      for (const L of lines){
        const m = L.match(flat);
        if (m){
          const t = hms(m[1],m[2],m[3],m[4]);
          const text = stripLabels(m[4]||'');
          if (text) segs.push({ start:t, end:t+3, text, norm: normalize(text) });
        }
      }
    }

    segs.sort((a,b)=>a.start-b.start);
    segs._starts = segs.map(s=>s.start);
    segs._t0 = segs[0]?.start || 0;
    segs._t1 = segs[segs.length-1]?.end || 0;
    segs._dur = Math.max(0, segs._t1 - segs._t0);
    return segs;
  }
  function hms(h,m,s,ms){
    let t = (+h)*3600 + (+m)*60 + (+s);
    if (ms) t += (+ms)/1000;
    return t;
  }

  // ---------- DOM-safe chunking ----------
  function wrapTextNodesToChunks(root){
    const isBlacklisted = (el) => !!el.closest('a, code, pre, kbd, samp, var, svg, figcaption, button, input, textarea, select');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n){
        if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || isBlacklisted(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    for (let n=walker.nextNode(); n; n=walker.nextNode()) nodes.push(n);

    const chunks = [];
    let idx = 0;
    for (const n of nodes){
      const text = n.nodeValue;
      const runs = splitIntoRuns(text); // keeps whitespace
      if (!runs.length) continue;

      const frag = document.createDocumentFragment();
      for (const run of runs){
        if (/\S/.test(run)){
          const span = document.createElement('span');
          span.className = 'sync-chunk';
          span.dataset.idx = String(idx);
          span.textContent = run; // preserve exact run (no trimming)
          frag.appendChild(span);
          chunks.push({ el:span, text:run, norm: normalize(run), idx, time:NaN });
          idx++;
        } else {
          frag.appendChild(document.createTextNode(run));
        }
      }
      n.parentNode.insertBefore(frag, n);
      n.parentNode.removeChild(n);
    }

    // merge tiny neighbors for stability
    const MIN = 14;
    for (let i=0;i<chunks.length-1;i++){
      const a = chunks[i], b = chunks[i+1];
      if (a.el.parentNode===b.el.parentNode && a.text.trim().length<MIN){
        const mergedText = (a.text + b.text).replace(/\s+/g,' ');
        a.text = mergedText;
        a.norm = normalize(mergedText);
        a.el.textContent = mergedText;
        b.el.remove();
        chunks.splice(i+1,1);
        i--;
      }
    }
    return chunks;
  }
  function splitIntoRuns(text){
    // sentence-ish; preserves trailing spaces/newlines by not trimming
    const re = /[^.!?…\n]+(?:[.!?…]+|\n+|$)\s*/g;
    const out = [];
    let m; while ((m = re.exec(text)) !== null) out.push(m[0]);
    return out.length ? out : [text];
  }

  // ---------- alignment (no additive seconds) ----------
  function alignChunksToSegments(chunks, segs){
    const SIZES  = [1,2,3];     // text windows on segment side
    const THRESH = 0.28;        // match threshold
    const MIN_STEP = 0.15;      // keep strictly increasing

    const starts = segs._starts;
    const t0 = segs._t0, dur = segs._dur || 1;

    let prevTime = t0;

    for (let i=0; i<chunks.length; i++){
      // expected index by *time* proportion
      const expectedTime = t0 + (i / Math.max(1, chunks.length-1)) * dur;
      let expIdx = lowerBound(starts, expectedTime);
      if (expIdx >= segs.length) expIdx = segs.length - 1;

      // search around expected index
      const windowByIdx = 40;
      const lo = Math.max(0, expIdx - windowByIdx);
      const hi = Math.min(segs.length - 1, expIdx + windowByIdx);

      let best = { score:-1, j:-1 };
      for (let j=lo; j<=hi; j++){
        for (const w of SIZES){
          if (j+w-1 >= segs.length) break;
          const win = joinSegText(segs, j, w);
          const score = similarity(chunks[i].norm, win.norm) - 0.0008 * Math.abs(j-expIdx);
          if (score > best.score) best = { score, j };
        }
      }

      // decide time: either best match, or the **nearest real timestamp** (no drift)
      let t = (best.score >= THRESH && best.j >= 0) ? segs[best.j].start
              : segs[expIdx].start;

      // monotonic clamp
      if (t < prevTime + MIN_STEP) t = prevTime + MIN_STEP;
      if (t > segs._t1) t = segs._t1;

      chunks[i].time = t;
      chunks[i].el.dataset.t = String(t.toFixed(3));
      prevTime = t;
    }
  }
  function joinSegText(segs, j, w){
    let s = '';
    for (let k=0;k<w;k++) s += (k?' ':'') + segs[j+k].text;
    return { raw:s, norm: normalize(s) };
  }

  // ---------- similarity ----------
  function tokens(s){ return s.split(' ').filter(w => w && w.length>1 && w!=='the'); }
  function jaccard(a,b){
    if (!a.length || !b.length) return 0;
    const A=new Set(a), B=new Set(b);
    let inter=0; for (const x of A) if (B.has(x)) inter++;
    const uni = A.size + B.size - inter;
    return uni? inter/uni : 0;
  }
  function dice(a,b){
    if (a.length<2 || b.length<2) return 0;
    const grams = s => {
      const m=new Map();
      for (let i=0;i<s.length-1;i++){ const g=s.slice(i,i+2); m.set(g,(m.get(g)||0)+1); }
      return m;
    };
    const A=grams(a), B=grams(b);
    let inter=0, tot=0;
    for (const [k,v] of A){ tot+=v; const w=B.get(k); if (w) inter+=Math.min(v,w); }
    for (const [,v] of B) tot+=v;
    return tot? (2*inter)/tot : 0;
  }
  function similarity(normA, normB){
    return 0.6*jaccard(tokens(normA), tokens(normB)) + 0.4*dice(normA, normB);
  }

  // ---------- playback glue ----------
  function setupClicks(chunks, player){
    chunks.forEach(c => {
      c.el.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; // we didn't wrap <a>, but guard anyway
        const t = (+c.el.dataset.t || 0);
        player.currentTime = Math.max(0, t);
        player.play().catch(()=>{});
        setActive(chunks, c.el, true);
      });
    });
  }
  function setupTimeUpdate(chunks, player){
    const times = chunks.map(c => c.time);
    let last = null;
    player.addEventListener('timeupdate', () => {
      const t = player.currentTime + 1e-3;
      let i = lowerBound(times, t);
      if (i >= times.length) i = times.length-1;
      const el = chunks[i].el;
      if (el !== last) {
        setActive(chunks, el, false);
        last = el;
      }
    });
  }
  function setActive(chunks, el, scroll){
    for (const c of chunks) c.el.classList.remove('playing');
    el.classList.add('playing');
    if (scroll) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  // ---------- small utils ----------
  function injectMiniCSS(css){ const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s); }
  function lowerBound(arr, x){
    let lo=0, hi=arr.length;
    while (lo<hi){ const mid=(lo+hi)>>1; (arr[mid] < x) ? (lo=mid+1) : (hi=mid); }
    return lo;
  }
})();
