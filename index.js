async function search(input) {
    const searchValue = input.value.toLowerCase();
    const trimmedSearchValue = searchValue.trim();
    const grid = document.querySelector('.grid');
    const results_DOM = document.querySelector('.results');
    results_DOM.innerHTML = '';

    const words = searchValue.split(/\s+/).filter(word => word && word !== "the");

    document.getElementById('clear-icon').style.display = searchValue.length > 0 ? 'block' : 'none';

    if (words.every(word => word.length < 3)) {
        // Less than 3 consecutive non-space characters, ignore this search
        grid.style.display = 'block';
        results_DOM.style.display = 'none';
        return;
    }
    grid.style.display = 'none';
    results_DOM.style.display = 'block';
    
    const cards = document.querySelectorAll('.card-md');
    const fragmentTitle = document.createDocumentFragment();
    const fragmentExact = document.createDocumentFragment();
    const fragmentPartial = document.createDocumentFragment();
    
    let totalResults = 0;

    let validwords = searchValue.split(" ").filter(
        word => word.length >= 3 && word !== "the"
        );

    for (let i = 0; i < cards.length; i++) {
       const card = cards[i];
       const title = card.querySelector('h2').textContent.toLowerCase();
       const content = card.querySelector('.data').innerHTML.toLowerCase();
       const link = card.querySelector('.read-more').href;
       const [exactResults, partialResults] = await highlightSearchText(content, searchValue, validwords, trimmedSearchValue, link);

       if (title.includes(searchValue)) {
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
    //const resultsSummary = document.createElement('p');
    //resultsSummary.textContent = `There are ${totalResults} results.`;
    //results_DOM.insertBefore(resultsSummary, results_DOM.firstChild);
    
     if (fragmentExact.childElementCount === 0 && fragmentPartial.childElementCount === 0) {
       const noResults = document.createElement('p');
       noResults.textContent = 'No results found';
       fragmentExact.appendChild(noResults);
     }
    
     results_DOM.appendChild(fragmentTitle);
     results_DOM.appendChild(fragmentExact); // Append exact matches
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

async function highlightSearchText(text, searchValue, words, trimmedSearchValue, link) {
    var maxLength = 200; // Maximum number of characters to display before and after the search value
    
    let exactMatches = [], partialMatches = [];
    findMatches(text, searchValue, words, maxLength, link, exactMatches, partialMatches);

    return [exactMatches, partialMatches];
}

function findMatches(text, searchValue, words, maxLength, link, exactMatches, partialMatches) {
    let urlSearchTermsExact = encodeURIComponent(searchValue.split(" ").join('+'));
    let urlSearchTermsPartial = encodeURIComponent(words.join('+'));

    let lastWindowEnd = 0;
    words.forEach(word => {
        let offset = text.indexOf(word);
        while (offset !== -1) {
            let start = Math.max(0, offset - maxLength);
            let end = Math.min(text.length, offset + maxLength);

            if (start < lastWindowEnd) {
                offset = text.indexOf(word, offset + 1);
                continue;
            }
            let windowText = text.substring(start, end);

            let exactMatchPos = windowText.indexOf(searchValue);
            let partialMatchPos = words.every(w => windowText.indexOf(w) !== -1) ? windowText.indexOf(words[0]) : -1;

            let se = windowText.substr(0, windowText.length);
            let fragment = encodeURIComponent(se);

            if (exactMatchPos !== -1) {
                let highlightedResult = windowText.split(searchValue).join('<span class="highlight">' + searchValue + '</span>');
                exactMatches.push(`<a class='result-link' href=${link}?s=${urlSearchTermsExact}&search=${fragment}>${highlightedResult}</a><br><br><hr>`);
            } else if (partialMatchPos !== -1) {
                let highlightedResult = words.reduce((result, w) => result.split(w).join('<span class="highlight">' + w + '</span>'), windowText);
                partialMatches.push(`<a class='result-link' href=${link}?s=${urlSearchTermsPartial}&search=${fragment}>${highlightedResult}</a><br><br><hr>`);
            }

            lastWindowEnd = end;
            offset = text.indexOf(word, offset + 1);
        }
    });
    return;
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
	var searchInput = document.getElementById('search');
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
	var viewHeight = window.innerHeight;
	var elementPosition = element.getBoundingClientRect().top;
	var scrollPosition = elementPosition - (viewHeight / 2);
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
    var target = e.target;
    
    // Traverse up to find the anchor tag
    while (target && target.tagName !== 'A') {
        target = target.parentNode;
    }
    
    // If an anchor tag is found and it matches the criteria
    if (target && /\.(jpg|png|gif)$/.test(target.href)) {
        e.preventDefault();
        var imgSrc = target.href;
        var previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        var img = document.createElement('img');
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
  var links = document.querySelectorAll('.links a');
  for (var i = 0; i < links.length; i++) {
    links[i].classList.remove('chosen-link');
  }

  // Clear search input
  var searchInput = document.getElementById('search');
  searchInput.value = '';
  search(searchInput);


  // Select the clicked category
  element.classList.add('chosen-link');

  var cards = document.getElementsByClassName('card-md');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var cardCategory = card.getElementsByClassName('category')[0].innerText;

    if (category === 'All' || cardCategory.startsWith(category)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  }

  var notFoundMessage = document.getElementById('not-found');
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
  var removeHighlightsBtn = document.getElementById("removeHighlights");
  
  if (removeHighlightsBtn) {
    removeHighlightsBtn.addEventListener("click", function() {
        removeHighlights();
    });
  }
  
  // Check if running as a web app and article is open
  if (window.navigator.standalone && document.getElementById("share-button")) {
      document.getElementById("share-button").style.display = "inline-block";
  }
});

function removeHighlights() {
      var removeHighlightsBtn = document.getElementById("removeHighlights");
      if (!removeHighlightsBtn) {
          return;
      }
      // Remove highlights
      var highlighted = document.querySelectorAll(".highlight");
      for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].outerHTML = highlighted[i].innerHTML;
      }

      // Hide the "X Remove Highlights" button
      removeHighlightsBtn.style.display = "none";
  
      // Update URL
      var url = window.location.href;
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
      textArea.value = text;
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

// Populate HTML and enable search
function populateAndEnableSearch(data) {
try {
  Object.keys(data).forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = data[id];
    el.style.display = "none"; // Keep it hidden for search later
  });
  const searchEl = document.getElementById("search");
  searchEl.disabled = false;
  searchEl.placeholder = "Search";
  search(searchEl); // Assuming you have a search function
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

// Main content loading function
function loadContentAsync() {
  // Collect all the IDs for the .data elements
  const ids = Array.from(document.querySelectorAll(".data")).map(el => el.id);
  if (ids.length === 0) {
    return;
  }

  retrieveAllData(function(cachedData) {
    if (cachedData) {
      populateAndEnableSearch(cachedData);
    } else {
      fetch('/searchloader.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: ids }),
      })
      .then(response => response.json())
      .then(data => {
        storeAllData(data);
        populateAndEnableSearch(data);
      })
      .catch(error => {
        console.error("Error fetching content:", error);
      });
    }
  });
}

// Entry point: Wait for the DOM to load before proceeding
document.addEventListener("DOMContentLoaded", function() {
  if (db) {
    loadContentAsync();
  }
  // If db is not available yet, it will be triggered by openRequest.onsuccess
});



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

function showFindOnPage() {
    removeHighlights();
    document.getElementById('find-on-page').style.display = 'flex';
    document.getElementById('activate-find-on-page').style.display = 'none';
    document.body.classList.add('find-on-page-active');
    const searchInput = document.getElementById('find-on-page-input');
    searchInput.focus();
    
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
        const scrollY = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
        window.scrollTo({
            top: scrollY,
            behavior: 'smooth'
        });
        updateCurrentResultHighlight();
    }
}

function moveToNextResult() {
    if (searchResults.length > 0) {
        currentResultIndex = (currentResultIndex + 1) % searchResults.length;
        scrollToCurrentResult();
        updateSearchCount();
    }
}

function moveToPreviousResult() {
    if (searchResults.length > 0) {
        currentResultIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
        scrollToCurrentResult();
        updateSearchCount();
    }
}

function isElementVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function performSearch() {
    clearHighlights();
    const searchText = document.getElementById('find-on-page-input').value.toLowerCase();
    if (searchText.length === 0) return;

    const body = document.body;
    const regex = new RegExp(searchText, 'gi');
    
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
});

// Add a keyboard shortcut to open the search (e.g., Ctrl+F or Cmd+F)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        showFindOnPage();
    } else if (e.key === 'Escape' && document.getElementById('find-on-page').style.display === 'flex') {
        e.preventDefault();
        hideFindOnPage();
    }
});