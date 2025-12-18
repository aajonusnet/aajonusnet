<?php
// ====================== serverSearch.php =======================

// Turn on error display (optional for debugging)
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
if (strlen($query) < 3) {
    // Return empty result sets if <3 chars:
    echo json_encode([
        "titleMatches"   => [],
        "exactMatches"   => [],
        "partialMatches" => []
    ]);
    exit;
}

// Optionally remove "the" or short words from partial logic:
$words = preg_split('/\s+/', $query);
$words = array_filter($words, function($w){
    return strlen($w) >= 3 && $w !== "the";
});

// Prepare arrays for final result
$titleMatches   = [];
$exactMatches   = [];
$partialMatches = [];

// Example: read the same set of files you used on the client
// NOTE: If your structure is big, consider using a more efficient indexing
$mdFolder = 'md';
$allFiles = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);

foreach ($allFiles as $file) {
    if ($file->isDir()) {
        continue;
    }
    $filePath = $file->getPathname();
    $filename = $file->getBasename('.md');

    // e.g. build a URL to that file:
    // if you have logic to sanitize the name for the final URL, do it here
    $sanitizedName = sanitizeFileName($filename);
    $categoryPart  = str_replace($mdFolder, '', dirname($filePath));
    $categoryPart  = ltrim($categoryPart, '/\\');
    
    // If your site uses categoryInLinks, adjust accordingly
    // For example:
    $url = '/' . $sanitizedName;

    // Read file content
    $contentRaw = file_get_contents($filePath);
    // We'll keep a lowercase copy for searching
    $contentLower = strtolower($contentRaw);

    // ---- 1) Check for title match (like your JS did) ----
    if (strpos(strtolower($filename), $query) !== false) {
        // We'll add a “titleMatch” entry
        $titleMatches[] = [
            "title" => $filename,
            "url"   => $url,
        ];
    }

    // ---- 2) Check for exact and partial matches in content ----
    // Because you had highlight code in JS, we replicate that here in PHP

    // We'll collect snippet arrays (like your exactResults / partialResults)
    $foundExact   = [];
    $foundPartial = [];

    // We'll define some snippet-length logic:
    $maxLength = 200;

    // For each word, or for the entire $query?
    // Let's follow your original style:
    //  - exact match means content has the full $query (with spaces)
    //  - partial means all words are present, but not necessarily consecutively
    $exactPos = stripos($contentLower, $query);
    if ($exactPos !== false) {
        // Extract snippet
        $snippet = snippetWithHighlight($contentRaw, $exactPos, strlen($query), $maxLength, [$query]);
        if ($snippet) {
            $foundExact[] = makeSnippetLink($url, $query, $snippet, /* exact */ true);
        }
    }

    // partial match: ensure all $words exist
    if (count($words) > 0 && allWordsFound($contentLower, $words)) {
        // Could find the first position or do multiple snippet windows
        // For simplicity, just find each instance of the first word
        // or replicate the "while offset != -1" logic from JS.

        $firstWord = reset($words);
        $offset    = 0;
        while (($offset = stripos($contentLower, $firstWord, $offset)) !== false) {
            // snippet
            $snippet = snippetWithHighlight($contentRaw, $offset, strlen($firstWord), $maxLength, $words);
            if ($snippet) {
                $foundPartial[] = makeSnippetLink($url, implode('+', $words), $snippet, /* exact */ false);
            }
            $offset = $offset + 1;
        }
    }

    // If we found any matches, push them to final
    if (!empty($foundExact)) {
        $exactMatches[] = [
            "title"    => $filename,
            "url"      => $url,
            "snippets" => $foundExact
        ];
    }
    if (!empty($foundPartial)) {
        $partialMatches[] = [
            "title"    => $filename,
            "url"      => $url,
            "snippets" => $foundPartial
        ];
    }
}

// Output JSON
echo json_encode([
    "titleMatches"   => $titleMatches,
    "exactMatches"   => $exactMatches,
    "partialMatches" => $partialMatches
]);


// ------------------------------------------------------
// Helper functions
// ------------------------------------------------------

function sanitizeFileName($string) {
    $string = preg_replace('/[^a-zA-Z0-9\s]/', '', $string);
    $string = preg_replace('/\s+/', '-', $string);
    return strtolower($string);
}

// Return snippet around $offset, highlight $searchTerms, up to $maxLen on each side
function snippetWithHighlight($contentRaw, $offset, $length, $maxLen, $searchTerms) {
    $start = max(0, $offset - $maxLen);
    $end   = min(strlen($contentRaw), $offset + $length + $maxLen);
    $windowText = substr($contentRaw, $start, $end - $start);

    // Basic highlighting: wrap search terms in <span class="highlight">:
    // If you want partial words highlighted, replicate your old “RegExp” approach
    foreach ($searchTerms as $term) {
        // Escape for regex
        $escaped = preg_quote($term, '/');
        // Use a callback if you want case-insensitive
        $windowText = preg_replace_callback(
            "/($escaped)/i",
            function($m) { 
                return '<span class="highlight">' . $m[1] . '</span>';
            },
            $windowText
        );
    }

    // We can return the snippet as HTML
    return htmlentities($windowText, ENT_QUOTES, 'UTF-8');
}

// Create an <a> link snippet like your old code
function makeSnippetLink($url, $searchParam, $highlightedSnippet, $exact) {
    // We might build something like:  <a class='result-link' href='...?s=searchParam&search=snippetEncoded'>highlightedSnippet</a>
    // Or we just return the highlightedSnippet as is.  
    // For example, returning something that matches your createResultCard usage:

    // Keep it simple for demonstration:
    $encodedSnippet = rawurlencode($highlightedSnippet);
    $encodedSearchParam = rawurlencode($searchParam);
    $final = "<a class='result-link' href='{$url}?s={$encodedSearchParam}&search={$encodedSnippet}'>"
           . $highlightedSnippet
           . "</a><br><br><hr>";

    return $final;
}

// Check if all words appear in $text (case-insensitive)
function allWordsFound($text, $words) {
    foreach ($words as $w) {
        if (stripos($text, $w) === false) {
            return false;
        }
    }
    return true;
}
