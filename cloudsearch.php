<?php
// cloudsearch.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

if (isset($_GET['search'])) {
    $query = trim(strtolower($_GET['search']));
} else {
    // 2. Otherwise, read JSON input from fetch POST
    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);

    // The search query
    $query = isset($data['query']) ? trim(strtolower($data['query'])) : '';
}

$searchValue = $query;
$words = preg_split('/\s+/', $searchValue);
$words = array_filter($words, function($word) {
    return $word && $word !== 'the';
});

// If all words are shorter than 3 characters, return nothing.
if (empty($words) || array_reduce($words, function($carry, $w) { 
    return $carry && strlen($w) < 3; 
}, true)) {
    echo '';
    exit;
}

// For snippet extraction, also only use words at least 3 characters long.
$validWords = array_filter($words, function($word) {
    return strlen($word) >= 3;
});

$maxLength = 200; // Maximum number of characters for snippet windows

// ----------------------------------------------------------------------
// 1. Build article list by scanning the "md" folder (same as index.php)
// ----------------------------------------------------------------------
$prioritizeCategories = ['QNA', 'Newsletters', 'Books', 'Books/Old'];
$mdFolder = 'md';
$articles = [];
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS));
foreach ($iterator as $file) {
    if ($file->isDir()) continue;
    $filePath = $file->getPathname();
    $filename = $file->getBasename('.md');
    $category = dirname($filePath);
    if ($category == $mdFolder) {
        $category = 'other';
    } else {
        $category = str_replace($mdFolder, '', $category);
        $category = str_replace("\\", "/", $category);
        $category = ltrim($category, '/');
    }
    // Determine link exactly as in your index.php (change $categoryInLinks if needed)
    $categoryInLinks = false;
    if ($categoryInLinks) {
        $sanitizedCategory = sanitizeFileName($category);
        $sanitizedName = sanitizeFileName($filename);
        $link = "/{$sanitizedCategory}/{$sanitizedName}";
    } else {
        $sanitizedName = sanitizeFileName($filename);
        $link = "/{$sanitizedName}";
    }
    $articles[] = [
        'filePath' => $filePath,
        'filename' => $filename,
        'category' => $category,
        'link' => $link
    ];
}

// Sort articles using the same comparator as before
usort($articles, function ($a, $b) use ($prioritizeCategories) {
    $catA = explode('/', $a['category']);
    $catB = explode('/', $b['category']);
    
    $mainCatA = $catA[0];
    $mainCatB = $catB[0];
    
    $priorityA = array_search($mainCatA, $prioritizeCategories);
    $priorityB = array_search($mainCatB, $prioritizeCategories);
    $priorityA = $priorityA === false ? PHP_INT_MAX : $priorityA;
    $priorityB = $priorityB === false ? PHP_INT_MAX : $priorityB;
    
    if ($priorityA != $priorityB) {
        return $priorityA - $priorityB;
    }
    
    if ($mainCatA != $mainCatB) {
        return strcmp($mainCatA, $mainCatB);
    }
    
    if ($mainCatA == $mainCatB) {
        if ($mainCatA == 'QNA') {
            preg_match('/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s(\d{1,2}),\s(\d{4})\b/', $a['filename'], $matchesA);
            preg_match('/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s(\d{1,2}),\s(\d{4})\b/', $b['filename'], $matchesB);
            
            $dateStrA = isset($matchesA[0]) ? $matchesA[0] : 'January 1, 1970';
            $dateStrB = isset($matchesB[0]) ? $matchesB[0] : 'January 1, 1970';

            $timestampA = strtotime($dateStrA);
            $timestampB = strtotime($dateStrB);
            
            return $timestampB - $timestampA;  // Newest first
        }
        
        $fullCatA = $a['category'];
        $fullCatB = $b['category'];
        
        $subPriorityA = array_search($fullCatA, $prioritizeCategories);
        $subPriorityB = array_search($fullCatB, $prioritizeCategories);
        
        if ($subPriorityA !== false || $subPriorityB !== false) {
            $subPriorityA = $subPriorityA === false ? PHP_INT_MAX : $subPriorityA;
            $subPriorityB = $subPriorityB === false ? PHP_INT_MAX : $subPriorityB;
            if ($subPriorityA != $subPriorityB) {
                return $subPriorityA - $subPriorityB;
            }
        }
        
        $subCatA = isset($catA[1]) ? $catA[1] : '';
        $subCatB = isset($catB[1]) ? $catB[1] : '';
        
        if ($subCatA != $subCatB) {
            if ($subCatA === '' && $subCatB !== '') return -1;
            if ($subCatA !== '' && $subCatB === '') return 1;
            return strcmp($subCatA, $subCatB);
        }
    }
    
    return strcmp($a['filename'], $b['filename']);
});

// ----------------------------------------------------------------------
// 2. Define helper functions for result–card creation and text highlighting
// ----------------------------------------------------------------------
function createResultCard($title, $snippets, $link) {
    $card = "<div class=\"card\">";
    $card .= "<h2><a class=\"result-link\" href=\"{$link}\">{$title}</a></h2>";
    if (!empty($snippets)) {
        foreach ($snippets as $snippet) {
            $card .= "<p>{$snippet}</p>";
        }
    }
    $card .= "</div>";
    return $card;
}

function highlightTerms($text, $terms) {
    // Build a regex that matches any of the terms (case–insensitive)
    $pattern = '/' . implode('|', array_map(function($term) {
        return preg_quote($term, '/');
    }, $terms)) . '/i';
    return preg_replace($pattern, '<span class="highlight">$0</span>', $text);
}

function findMatches($text, $searchValue, $words, $maxLength, $link) {
    $exactMatches = [];
    $partialMatches = [];
    // Prepare URL query parts similar to the JS version
    $urlSearchTermsExact = urlencode(implode('+', preg_split('/\s+/', $searchValue)));
    $urlSearchTermsPartial = urlencode(implode('+', $words));
    $lastWindowEnd = 0;
    foreach ($words as $word) {
        $offset = 0;
        while (($pos = strpos($text, $word, $offset)) !== false) {
            $start = max(0, $pos - $maxLength);
            $end = min(strlen($text), $pos + $maxLength);
            if ($start < $lastWindowEnd) {
                $offset = $pos + 1;
                continue;
            }
            $windowText = substr($text, $start, $end - $start);
            $exactMatchPos = strpos($windowText, $searchValue);
            // Determine if all words exist in this snippet (for a partial match)
            $allWordsPresent = true;
            foreach ($words as $w) {
                if (strpos($windowText, $w) === false) {
                    $allWordsPresent = false;
                    break;
                }
            }
            $partialMatchPos = $allWordsPresent ? strpos($windowText, $words[0]) : false;
            $fragment = urlencode($windowText);
            if ($exactMatchPos !== false) {
                $highlightedResult = highlightTerms($windowText, [$searchValue]);
                $exactMatches[] = "<a class='result-link' href='{$link}?s={$urlSearchTermsExact}&search={$fragment}'>{$highlightedResult}</a><br><br><hr>";
            } else if ($partialMatchPos !== false) {
                $highlightedResult = highlightTerms($windowText, $words);
                $partialMatches[] = "<a class='result-link' href='{$link}?s={$urlSearchTermsPartial}&search={$fragment}'>{$highlightedResult}</a><br><br><hr>";
            }
            $lastWindowEnd = $end;
            $offset = $pos + 1;
        }
    }
    return [$exactMatches, $partialMatches];
}

// ----------------------------------------------------------------------
// 3. Loop over articles, perform search on each and build result cards
// ----------------------------------------------------------------------
$titleResultsHTML = "";
$exactResultsHTML = "";
$partialResultsHTML = "";

foreach ($articles as $article) {
    $filePath = $article['filePath'];
    $filename = $article['filename'];
    $link = $article['link'];
    if (!file_exists($filePath)) continue;
    $content = file_get_contents($filePath);
    // Replace newlines, tabs, etc. with a space
    $replaceArray = ["\n", "\r", "\t"];
    $content = str_replace($replaceArray, ' ', $content);
    // Use plain–text lowercase content for matching
    $text = strtolower($content);
    $titleLower = strtolower($filename);

    list($exactMatches, $partialMatches) = findMatches($text, $searchValue, $validWords, $maxLength, $link);
    
    // If the article’s title contains the search query, add a title–result card (with no snippet)
    if (strpos($titleLower, $searchValue) !== false) {
        $titleResultsHTML .= createResultCard($filename, [], $link);
    }
    // Add a card if any exact matches were found
    if (!empty($exactMatches)) {
        $exactResultsHTML .= createResultCard($filename, $exactMatches, $link);
    }
    // Add a card if any partial matches were found
    if (!empty($partialMatches)) {
        $partialResultsHTML .= createResultCard($filename, $partialMatches, $link);
    }
}

// If no exact or partial snippet matches were found, show "No results found"
if (empty($exactResultsHTML) && empty($partialResultsHTML)) {
    $exactResultsHTML .= "<p>No results found</p>";
}

// Combine the three groups in order: Title matches, then Exact matches, then (if present) a heading plus Partial matches.
$outputHTML = $titleResultsHTML . $exactResultsHTML;
if (!empty($partialResultsHTML)) {
    $outputHTML .= '<p style="font-style:italic; margin:20px 0 10px;">Partial matches:</p>' . $partialResultsHTML;
}

// Output the complete HTML
echo $outputHTML;

// ----------------------------------------------------------------------
// 4. Helper function for sanitizing file names (same as in index.php)
// ----------------------------------------------------------------------
function sanitizeFileName($string) {
    $string = preg_replace('/[^a-zA-Z0-9\s]/', '', $string);
    $string = preg_replace('/\s+/', '-', $string);
    return strtolower($string);
}
?>
