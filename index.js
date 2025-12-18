async function search(input) {
    const searchValue = input.value.toLowerCase();
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
  searchEl.placeholder = 'Loading…';

  const cached = await getCachedData();
  if (cached) {
    populateAndEnableSearch(cached);
    return;
  }

  searchEl.placeholder = 'Loading… 0%';

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
    searchEl.placeholder = `Loading… ${pct}%`;
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