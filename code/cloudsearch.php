<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');

// Loads: $mdFolder, $prioritizeCategories, categoryinLinks, pinnedArticles, sortArticlesByDate
require_once dirname(__DIR__) . '/config.php';
$mdFolder = dirname(__DIR__) . '/' . $mdFolder;

function sanitizeFileName(string $s): string {
    $t = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    if ($t !== false) $s = $t;
    $s = preg_replace('/[^a-zA-Z0-9\s]/', '', $s);
    $s = preg_replace('/\s+/', '-', $s);
    return strtolower(trim($s, '-'));
}

function titleDateTs(string $s): int {
    if (preg_match('/(?:of\s+)?([A-Za-z]{3,9}\.?)\s*(\d{1,2}(?:st|nd|rd|th)?)?,?\s*((?:19|20)\d{2})/i',$s,$m))
        return strtotime(rtrim($m[1],'.').' '.(preg_replace('/\D/','',$m[2]??'1')).' '.$m[3]);
    if (preg_match('/\b((?:19|20)\d{2})(?:[-_ ]?([01]\d)(?:[-_ ]?([0-3]\d))?)?\b/',$s,$m))
        return strtotime(sprintf('%s-%02d-%02d', $m[1], $m[2] ?? 1, $m[3] ?? 1));
    if (preg_match('/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9}\.?),?\s+((?:19|20)\d{2})\b/i',$s,$m))
        return strtotime((int)$m[1].' '.rtrim($m[2],'.').' '.$m[3]);
    return 0;
}

// 1) Read the raw query (preserve spaces)
if (isset($_GET['search'])) {
    $searchValue = strtolower($_GET['search']);
} else {
    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);
    $searchValue = isset($data['query']) ? strtolower($data['query']) : '';
}
$trimmedSearchValue = trim($searchValue);

// 2) Tokenize
$words = preg_split('/\s+/', $trimmedSearchValue);
$words = array_values(array_filter($words, fn($w) => $w !== ''));

// If no words, return empty JSON array
if (empty($words)) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([], JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

$validWords = $words;
$wantPartial = count($validWords) > 1;
$maxLength = 200;

// ----------------------------------------------------------------------
// 3) Build article list by scanning the "md" folder
// ----------------------------------------------------------------------

$articles = [];

$rootLen = strlen($mdFolder) + 1;
$it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS)
);
foreach ($it as $file) {
    if ($file->isDir()) continue;
    $path = $file->getPathname();
    $ext = strtolower($file->getExtension());
    if ($ext !== 'md' && $ext !== 'txt') continue;

    $rel = substr($path, $rootLen);
    $name = $file->getBasename('.' . $ext);

    $catDir = str_replace('\\', '/', dirname($rel));
    $catDir = ($catDir === '.' ? 'other' : ltrim($catDir, '/'));
    [$main, $sub] = array_pad(explode('/', $catDir, 2), 2, '');

    $slug = sanitizeFileName($name);
    $dateTs = titleDateTs($name);

    // build link (toggle $categoryInLinks if desired)
    if ($categoryInLinks) {
        $link = '/' . sanitizeFileName($main) . '/' . $slug;
    } else {
        $link = '/' . $slug;
    }

    $articles[] = [
        'filePath' => $path,
        'filename' => $name,
        'category' => $catDir,
        'main' => $main,
        'sub' => $sub,
        'slug' => $slug,
        'dateTs' => $dateTs,
        'link' => $link,
    ];
}

// ----------------------------------------------------------------------
// 4) Sort articles using original comparator
// ----------------------------------------------------------------------
$prioIdx = array_flip($prioritizeCategories ?? []);
$pinSet = array_flip($pinnedArticles ?? []);
$sortDateSet = array_flip($sortArticlesByDate ?? []);

usort($articles, function ($a, $b) use ($prioIdx, $pinSet, $sortDateSet) {
    // main category priority
    $pmA = $prioIdx[$a['main']] ?? PHP_INT_MAX;
    $pmB = $prioIdx[$b['main']] ?? PHP_INT_MAX;
    if ($pmA !== $pmB) return $pmA <=> $pmB;

    // different mains but same (or missing) priority -> alpha
    if ($a['main'] !== $b['main']) return $a['main'] <=> $b['main'];

    // special: date-sorted mains
    if (isset($sortDateSet[$a['main']])) {
        if ($a['dateTs'] !== $b['dateTs']) return $b['dateTs'] <=> $a['dateTs']; // newest first
        return $a['filename'] <=> $b['filename']; // deterministic tie-break
    }

    // pinned (outside date-sorted mains)
    $pinA = isset($pinSet[$a['slug']]);
    $pinB = isset($pinSet[$b['slug']]);
    if ($pinA !== $pinB) return $pinB <=> $pinA; // pinned first

    // full-category priority (subpriority)
    $psA = $prioIdx[$a['category']] ?? PHP_INT_MAX;
    $psB = $prioIdx[$b['category']] ?? PHP_INT_MAX;
    if ($psA !== $psB) return $psA <=> $psB;

    // subcategory ordering
    if ($a['sub'] !== $b['sub']) {
        if ($a['sub'] === '') return -1;
        if ($b['sub'] === '') return 1;
        return $a['sub'] <=> $b['sub'];
    }

    // finally by name
    return $a['filename'] <=> $b['filename'];
});

// ----------------------------------------------------------------------
// 5) Highlight helper
// ----------------------------------------------------------------------
function highlightTerms(string $text, array $terms): string {
    if (empty($terms)) return $text;
    $parts = array_map(fn($t)=>preg_quote($t,'/'), $terms);
    $pattern = '/(' . implode('|', $parts) . ')/i';
    return preg_replace($pattern, '<mark>$0</mark>', $text);
}

// ----------------------------------------------------------------------
// 6) Find matches
// ----------------------------------------------------------------------
function findMatches($body, $searchValue, $words, $maxLen, $wantPartial): array {
    $exact = [];
    $partial = [];
    $lastEnd = 0;

    foreach ($words as $w) {
        $offset = 0;
        while (false !== ($pos = strpos($body, $w, $offset))) {
            $start = max(0, $pos - $maxLen);
            if ($start < $lastEnd) $start = $lastEnd;

            $end = min(strlen($body), $start + ($maxLen * 2));

            $win = substr($body, $start, $end - $start);
            $win = preg_match('//u', $win) ? $win : @iconv('UTF-8', 'UTF-8//IGNORE', $win);

            $isExact = ($searchValue !== '' && strpos($win, $searchValue) !== false);
            $allWordsPresent = $wantPartial ? array_reduce(
                $words, fn($c, $t) => $c && strpos($win, $t) !== false, true) : false;

            if ($isExact) {
                $exact[] = highlightTerms($win, [$searchValue]);
            } elseif ($allWordsPresent) {
                $partial[] = highlightTerms($win, $words);
            }

            $lastEnd = $end;
            $offset = $pos + 1;
        }
    }

    return [$exact, $partial];
}

// ----------------------------------------------------------------------
// 7) Loop → separate title/exact/partial results
// ----------------------------------------------------------------------
$titleResults = [];
$exactResults = [];
$partialResults = [];

foreach ($articles as $a) {
    if (!file_exists($a['filePath'])) continue;

    $raw = file_get_contents($a['filePath']);
    $body = strtolower(str_replace(["\n","\r","\t"], ' ', $raw));
    $title = $a['filename'];
    $tLow = strtolower($title);

    [$ex, $pa] = findMatches(
        $body,
        $searchValue,
        $validWords,
        $maxLength,
        $wantPartial
    );

    // title‐only match?
    $tWords = preg_split('/\s+/', $trimmedSearchValue);
    $allOk = array_reduce(
        $tWords, fn($carry, $w) => $carry && ($w === '' || strpos($tLow, $w) !== false), true
    );
    if ($allOk) {
        $titleResults[] = ['t' => $title, 'l' => $a['link'], 'sn' => []];
    }
    if (!empty($ex)) {
        $exactResults[] = ['t' => $title, 'l' => $a['link'], 'sn' => $ex];
    }
    if (!empty($pa)) {
        $partialResults[] = ['t' => $title, 'l' => $a['link'], 'sn' => $pa];
    }
}

// merge so titles come first
$results = array_merge($titleResults, $exactResults, $partialResults);

// ----------------------------------------------------------------------
// 8) Output JSON
// ----------------------------------------------------------------------
$json = json_encode($results,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR
);
if ($json === false) {
    header('Content-Type: text/plain; charset=utf-8');
    echo 'JSON encode error: ' . json_last_error_msg();
} else {
    echo $json;
}
exit;