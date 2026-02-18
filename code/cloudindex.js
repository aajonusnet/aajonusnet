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

// debounce + abort management
let searchTimeout = null;
let currentSearchController = null;

const searchEl = getById('search');

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

// escape helper for exact‑match detection
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function performCloudSearch(query, controller) {
  const resultsDOM = getById('results');

  try {
    const response = await fetch('code/cloudsearch.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      resultsDOM.innerHTML = '<p>Error performing search.</p>';
      return;
    }

    const data = await response.json();
    // clear old
    resultsDOM.innerHTML = '';

    // fragments for grouping
    const fragTitle = document.createDocumentFragment();
    const fragExact = document.createDocumentFragment();
    const fragPartial = document.createDocumentFragment();

    // count total snippets
    const totalResults = data.reduce(
      (sum, item) => sum + ((item.sn && item.sn.length) ? item.sn.length : 0), 0);

    // build regex to detect exact‐phrase highlights
    const escapedQuery = escapeRegExp(query);
    const exactRegex = new RegExp(`<mark>${escapedQuery}</mark>`, 'i');
    const terms = query.trim().split(/\s+/).filter(Boolean);
    const urlSearchTermsExact = encodeURIComponent(terms.join('+'));
    const urlSearchTermsPartial = (terms.length > 1) ? encodeURIComponent(terms.join('+')) : urlSearchTermsExact;

    data.forEach(item => {
      const { t: title, l: link, sn: snippets = []} = item;

      if (snippets.length === 0) {
        // title-only
        fragTitle.appendChild(createResultCard(title, [], link));
      } else {
        // decide exact vs partial by looking for the full phrase highlight
        const isExact = snippets.some(s => exactRegex.test(s));
        const sParam = isExact ? urlSearchTermsExact : urlSearchTermsPartial;

        const snippetStrings = snippets.map(htmlSnippet => {
          const tmp = document.createElement('div');
          tmp.innerHTML = htmlSnippet;
          const snippetText = tmp.textContent || tmp.innerText || '';
          return `<a class="result-text" href="${link}?s=${sParam}&search=${encodeURIComponent(snippetText)}">${htmlSnippet}</a><hr>`;
        });

        if (isExact) {
          fragExact.appendChild(createResultCard(title, snippetStrings, link));
        } else {
          fragPartial.appendChild(createResultCard(title, snippetStrings, link));
        }
      }
    });

    // 1) total summary
    const summary = document.createElement('p');
    summary.className = 'results-summary';
    summary.textContent = `There ${totalResults === 1 ? 'is 1 result' : `are ${totalResults} results`}.`;
    resultsDOM.appendChild(summary);

    // 2) title matches
    resultsDOM.appendChild(fragTitle);

    // 3) exact matches
    resultsDOM.appendChild(fragExact);

    // 4) partial heading (if needed)
    if (fragPartial.childElementCount > 0) {
      const header = document.createElement('p');
      header.className = 'partial-heading';
      header.textContent = 'Partial matches:';
      resultsDOM.appendChild(header);
    }

    // 5) partial matches
    resultsDOM.appendChild(fragPartial);

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Error during cloud search:', err);
    resultsDOM.innerHTML = '<p>Error performing search.</p>';
  }
}

function search(input) {
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
    if (currentSearchController) currentSearchController.abort();
    return;
  }

  catBar.hidden = true;
  grid.hidden = true;
  results_DOM.hidden = false;

  results_DOM.innerHTML = '<p>Searching…</p>';

  // debounce + abort (same as before)
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (currentSearchController) currentSearchController.abort();
    currentSearchController = new AbortController();
    // send the query to backend
    performCloudSearch(searchValue, currentSearchController);
  }, 300);
}

function clearSearch() {
  searchEl.value = '';
  search(searchEl);
  const ci = getById('clear-icon');
  if (ci) ci.hidden = true;
  searchEl.focus();
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

if (searchEl) {
  searchEl.focus();
  searchEl.addEventListener('keyup', function(event) {
    // Key code 13 is the "Return" key
    if (event.keyCode === 13) {
      // Remove focus to close the keyboard
      searchEl.blur();
    }
  });
}

document.addEventListener("DOMContentLoaded", function() {
  searchEl.disabled = false;
  searchEl.placeholder = 'Search';
});