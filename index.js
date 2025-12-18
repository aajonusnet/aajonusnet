async function search(input) {
    const searchValue = input.value.toLowerCase();
    const grid = document.querySelector('.grid');
    const results_DOM = document.querySelector('.results');
    const search_min_length = 3;
    results_DOM.innerHTML = '';

	const hasThreeConsecutiveChars = /.*\S{3,}.*/.test(searchValue);

    if (!hasThreeConsecutiveChars || searchValue.length < search_min_length) {
        // Less than 3 consecutive non-space characters, ignore this search
        grid.style.display = 'block';
        results_DOM.style.display = 'none';
        return;
    }
    grid.style.display = 'none';
    results_DOM.style.display = 'block';
    
    const cards = document.querySelectorAll('.card-md');
    const fragmentExact = document.createDocumentFragment(); // Fragment for exact matches
    const fragmentPartial = document.createDocumentFragment(); // Fragment for partial matches
    
    let totalResults = 0;

    for (let i = 0; i < cards.length; i++) {
       const card = cards[i];
       const title = card.querySelector('h2').textContent.toLowerCase();
       const content = card.querySelector('.data').innerHTML.toLowerCase();
       const link = card.querySelector('.read-more').href;
       const [exactResults, partialResults] = await highlightSearchText(content, searchValue, searchValue.trim(), link);
    
         // Collect all the exact results in a set
        let exactContents = new Set(exactResults.map(result => normalizeContent(result)));

        // Filter out partial results that are in the exact results set
        let filteredPartialResults = partialResults.filter(partial => !exactContents.has(normalizeContent(partial)));

       totalResults += exactResults.length + filteredPartialResults.length;

	   if (exactResults.length > 0) {
           const resultCard = createResultCard(card, exactResults, link);
           fragmentExact.appendChild(resultCard); // Append the result card to the exact matches fragment
       }
	   if (filteredPartialResults.length > 0) {
            const resultCard = createResultCard(card, filteredPartialResults, link);
            fragmentPartial.appendChild(resultCard); // Append the result card to the partial matches fragment
        }
     }

     // Display the total number of results
    const resultsSummary = document.createElement('p');
    resultsSummary.textContent = `There are ${totalResults} results.`;
    results_DOM.insertBefore(resultsSummary, results_DOM.firstChild);
    
     if (fragmentExact.childElementCount === 0 && fragmentPartial.childElementCount === 0) {
       const noResults = document.createElement('p');
       noResults.textContent = 'No results found';
       fragmentExact.appendChild(noResults); // Append the "No results found" message to the fragment
     }
    
     results_DOM.appendChild(fragmentExact); // Append exact matches
     results_DOM.appendChild(fragmentPartial); // Append partial matches
}

function normalizeContent(html) {
    const div = document.createElement('div');
    div.innerHTML = html.replace(/<span class="highlight">(\s*)<\/span>/g, '$1');
    return div.textContent.replace(/\s+/g, ' ').trim().toLowerCase() || "";
}
function isSimilar(str1, str2) {
    return false;
    /*const maxLengthDifference = 5; // You can adjust this value
    const maxSpaceDifference = 3; // You can adjust this value

    if (Math.abs(str1.length - str2.length) > maxLengthDifference) return false;

    let spaceDifference = 0;
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
        if (str1[i] !== str2[i]) {
            if (str1[i] === ' ' || str2[i] === ' ') {
                spaceDifference++;
                if (spaceDifference > maxSpaceDifference) return false;
            } else {
                return false;
            }
        }
    }

    return true;*/
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

    for (let result of uniqueResults) {
        const resultContent = document.createElement('p');
        resultContent.innerHTML = result;
        resultCard.appendChild(resultContent);
    }

    return resultCard;
}
          

async function highlightSearchText(text, searchValue, trimmedSearchValue, link) {
    var maxLength = 200; // Maximum number of characters to display before and after the search value
    
    let words = searchValue.split(" ").filter(
        word => word.length >= 3 && word !== 'and' && word !== 'the'
        ).join("|");

    let exactMatchRegex = new RegExp(searchValue, 'gi');
    let partialMatchRegex = new RegExp(words, 'gi');
            
    let exactMatches = findMatches(text, searchValue, exactMatchRegex, maxLength, link);
    let partialMatches = findMatches(text, words, partialMatchRegex, maxLength, link);

 // Return two separate arrays for exact and partial matches
    return [exactMatches, partialMatches];
}

function findMatches(text, searchValue, regex, maxLength, link) {
    let results = [];
    let searchTerms = searchValue.split("|");

    // Keep track of the last window checked
    let lastWindowStart = -1;

    // Iterate through each match of the regex
    let match;
    while ((match = regex.exec(text)) !== null) {
        let offset = match.index;
        let start = Math.max(0, offset - maxLength);
        let end = Math.min(text.length, offset + match[0].length + maxLength);

        // Ensure the window is at least 200 characters long
        if (end - start < 200) {
            let extra = 200 - (end - start);
            start = Math.max(0, start - extra);
            end = Math.min(text.length, end + extra);
        }

        // Avoid checking the same window multiple times
        if (start <= lastWindowStart) {
            regex.lastIndex = offset + 1;
            continue;
        }
        lastWindowStart = start;

        let windowText = text.substring(start, end);

        // Check if all search terms are present in the window
        if (searchTerms.every(term => windowText.toLowerCase().includes(term.toLowerCase()))) {
            let highlightedResult = windowText.replace(regex, m => '<span class="highlight">' + m + '</span>');
            results.push(`<a class='result-link' href=${link}&len=${end-start}&s=${encodeURIComponent(windowText)}>${highlightedResult}</a><br><br><hr>`);
        }

        // Reset the regex position to allow checking around the next occurrence
        regex.lastIndex = offset + 1;
    }

    return results;
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

document.addEventListener('DOMContentLoaded', function() {
    var imageLinks = document.querySelectorAll('a[href$=".jpg"], a[href$=".png"], a[href$=".gif"]');
    imageLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var imgSrc = this.href;
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
            if (this.nextElementSibling && this.nextElementSibling.className === 'image-preview') {
                this.parentNode.removeChild(this.nextElementSibling);
            } else {
                this.parentNode.insertBefore(previewDiv, this.nextSibling);
            }
        });
    });
});