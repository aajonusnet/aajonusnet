async function search(input) {
    const searchValue = input.value.toLowerCase();
    const trimmedSearchValue = searchValue.trim();
    const grid = document.querySelector('.grid');
    const results_DOM = document.querySelector('.results');
    const search_min_length = 3;
    results_DOM.innerHTML = '';

    const words = searchValue.split(/\s+/).filter(word => word && word !== "the");

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
           fragmentExact.appendChild(resultCard); // Append the result card to the exact matches fragment
       }
	   if (partialResults.length > 0) {
            const resultCard = createResultCard(card, partialResults, link);
            fragmentPartial.appendChild(resultCard); // Append the result card to the partial matches fragment
        }
     }

     // Display the total number of results
    //const resultsSummary = document.createElement('p');
    //resultsSummary.textContent = `There are ${totalResults} results.`;
    //results_DOM.insertBefore(resultsSummary, results_DOM.firstChild);
    
     if (fragmentExact.childElementCount === 0 && fragmentPartial.childElementCount === 0) {
       const noResults = document.createElement('p');
       noResults.textContent = 'No results found';
       fragmentExact.appendChild(noResults); // Append the "No results found" message to the fragment
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
    // Convert results array to Set to remove duplicates
    const uniqueResults = [...new Set(results)];

    if (uniqueResults.length == 0) {
        return resultCard;
    }

    for (let result of uniqueResults) {
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
                exactMatches.push(`<a class='result-link' href=${link}&s=${urlSearchTermsExact}&search=${fragment}>${highlightedResult}</a><br><br><hr>`);
            } else if (partialMatchPos !== -1) {
                let highlightedResult = words.reduce((result, w) => result.split(w).join('<span class="highlight">' + w + '</span>'), windowText);
                partialMatches.push(`<a class='result-link' href=${link}&s=${urlSearchTermsPartial}&search=${fragment}>${highlightedResult}</a><br><br><hr>`);
            }

            lastWindowEnd = end;
            offset = text.indexOf(word, offset + 1);
        }
    });
    return;
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

if (document.getElementById("scrollToThis"))
scrollToElement(document.getElementById("scrollToThis"));

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

function filterCategory(category, element) {
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

    if (category === 'All' || cardCategory === category) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  }

  // Update URL without reloading the page
  if (category === 'All') {
    window.history.replaceState({}, '', '/');
  } else {
    window.history.replaceState({}, '', `/${category}`);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var removeHighlightsBtn = document.getElementById("removeHighlights");
  
  if (removeHighlightsBtn) {
    removeHighlightsBtn.addEventListener("click", function() {
      // Remove highlights
      var highlighted = document.querySelectorAll(".highlight");
      for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].outerHTML = highlighted[i].innerHTML;
      }

      // Hide the "X Remove Highlights" button
      removeHighlightsBtn.style.display = "none";
  
      // Update URL
      var url = window.location.href;
      url = url.split('&')[0];
      window.history.replaceState({}, '', url);
    });
  }
});
