<?php

//error_reporting(E_ALL);
//ini_set('display_errors', 1);

// Loads:
// $siteTitle, $siteDescription, $siteKeywords, $siteName, $twitterAccount, $categoryInLinks
// $mdFolder, $baseUrl, $prioritizeCategories, $pinnedArticles
require_once __DIR__ . '/config.php';

$articleMap = [];
$categoryMap = [];

$script = isset($_GET['cloudsearch']) ? 'cloudindex.js' : 'index.js';

function sanitizeFileName($string) {
    $string = iconv('UTF-8', 'ASCII//TRANSLIT', $string);
    $string = preg_replace('/[^a-zA-Z0-9\s]/', '', $string);
    $string = preg_replace('/\s+/', '-', $string);
    return strtolower(trim($string, '-'));
}

$articles = buildIndex();

function buildIndex() {
    global $articleMap, $categoryMap, $mdFolder;

    $rootLen = strlen($mdFolder) + 1;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    $articles = [];
    foreach ($it as $f) {
        $path = $f->getPathname();

        if ($f->isDir()) {
            $rel = substr($path, $rootLen);
            if ($rel !== '') $categoryMap[sanitizeFileName($rel)] = $rel;
            continue;
        }

        $ext = strtolower($f->getExtension());
        if (!in_array($ext, ['md','txt'], true)) continue;

        $relNoExt = substr($path, $rootLen, -(strlen($ext)+1));
        $filename = $f->getBasename('.'.$ext);

        // derive normalized category with forward slashes
        $cat = dirname(substr($path, $rootLen));
        $cat = $cat === '.' ? 'other' : ltrim(str_replace('\\','/',$cat), '/');

        $slug = sanitizeFileName(basename($relNoExt));
        $articleMap[$slug] = $relNoExt;
        $articles[] = [
            'filePath' => $path,
            'filename' => $filename,
            'category' => $cat
        ];
    }
    return $articles;
}
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$slug = basename(trim($uri, '/'));

$originalFile = $slug !== '' ? ($articleMap[strtolower($slug)] ?? null) : null;
$dynamicTitle = $originalFile ? basename($originalFile) : $siteTitle;

$isHome = ($slug === '' || $uri === '/');
$is404  = !$isHome && !$originalFile && !isset($categoryMap[sanitizeFileName($slug)]);
if ($is404) {
    http_response_code(404);
    header('X-Robots-Tag: noindex', true);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?= $dynamicTitle ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php if (!$is404): ?>
    <link rel="canonical" href="<?= $baseUrl ?>">
    <?php endif; ?>
    <base href="/">
    <link rel="stylesheet" href="style.css?v=54">
    <link rel="icon" href="logos/favicon.ico" type="image/x-icon" sizes="any">
    <link rel="apple-touch-icon" href="logos/apple-touch-icon.png">

    <meta name="title" content="<?= $dynamicTitle ?>">
    <meta name="description" content="<?= $siteDescription ?>">
    <meta name="keywords" content="<?= $siteKeywords ?>">

    <meta property="og:title" content="<?= $dynamicTitle ?>">
    <meta property="og:description" content="<?= $siteDescription ?>">
    <meta property="og:url" content="<?= $baseUrl ?>">
    <meta property="og:site_name" content="<?= $siteName ?>">
    <meta property="og:type" content="website">
    <meta property="og:image" content="<?= $baseUrl ?>logos/large-logo.jpg">

    <meta name="twitter:card" content="summary">
    <meta property="twitter:image" content="<?= $baseUrl ?>logos/large-logo.jpg">
    <meta name="twitter:site" content="<?= $twitterAccount ?>">
    <meta name="format-detection" content="telephone=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">

    <link rel="manifest" href="manifest.json">
</head>
<body>
    <div class="header">
        <div class="title-container">
            <?php if ($originalFile) { ?>
                <a href="/" class="back-arrow" onclick="goBack()" role="button" aria-label="Go back">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><polyline points="13.42,5.41 4,12 13.41,18.59" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </a>
            <?php } ?>
            <a class="title" href="/"><h1><?= $dynamicTitle === "Aajonus Vonderplanitz" ? "Aajonus.net" : $dynamicTitle ?></h1>
</a>
            <?php if ($originalFile) { ?>
                <div id="share-button" onclick="shareArticle()" role="button" tabindex="0" aria-label="Share">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" fill="white"/></svg>
</div>
            <?php } ?>
        </div>
    </div>
    <?php if (!$originalFile && !$is404) { ?>
        <!-- Search Bar -->
        <div class="search-container">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 44"><g stroke="#757575" stroke-width="1.1" fill="none" stroke-linecap="butt"><circle cx="6" cy="20" r="5"/><line x1="10.039" y1="23.721" x2="13.909" y2="27.591"/></g></svg>
            <input type="text" id="search" class="search-bar" oninput="search(this)" placeholder="Loading..." disabled aria-label="Search website">
            <div id="clear-icon" class="clear-icon" onclick="clearSearch()">&#10005;</div>
        </div>
        <!-- Categories -->
        <nav class="categories" aria-label="Categories">
            <a href="/" onclick="filterCategory(event, 'All', 'All', this)">All</a>
            <?php 
                $directories = glob($mdFolder . '/*', GLOB_ONLYDIR);
                $folderName = '';
                if (isset($_GET['category'])) {
                    $folderName = $categoryMap[sanitizeFileName((string)$_GET['category'])] ?? null;
                }
                foreach ($directories as $dir) {
                     $category = basename($dir);
                     $sanitizedCategory = sanitizeFileName($category);
                     $selectedClass = (isset($folderName) && strtolower($category) === strtolower($folderName)) ? 'chosen-category' : '';
                     echo '<a href="/' . $sanitizedCategory . '/" class="' . $selectedClass . '" onclick="return filterCategory(event, \'' . $category . '\', \'' . $sanitizedCategory . '\', this)">' . $category . '</a>';
                }
            ?>
        </nav>
        <main>
        <div class="grid">
        <?php

        $lowerFolderName = strtolower($folderName);        

        usort($articles, function ($a, $b) use ($prioritizeCategories, $pinnedArticles) {
            $catA = explode('/', $a['category']);
            $catB = explode('/', $b['category']);
    
            $mainCatA = $catA[0];
            $mainCatB = $catB[0];
    
            // Check main category priority
            $priorityA = array_search($mainCatA, $prioritizeCategories);
            $priorityB = array_search($mainCatB, $prioritizeCategories);
            $priorityA = $priorityA === false ? PHP_INT_MAX : $priorityA;
            $priorityB = $priorityB === false ? PHP_INT_MAX : $priorityB;
    
            if ($priorityA != $priorityB) {
                return $priorityA - $priorityB;
            }
    
            // If main categories are different but have the same priority, sort alphabetically
            if ($mainCatA != $mainCatB) {
                return strcmp($mainCatA, $mainCatB);
            }
    
            // If main categories are the same
            if ($mainCatA == $mainCatB) {
                // Special handling for "QNA" category
                if ($mainCatA == 'QNA') {
                    $pattern = '/\b(?:(January|February|March|April|May|June|July|August|September|October|November|December)(?:(?:\s+(\d{1,2})(?:,\s*|\s+))|(?:,\s*))?)?(\d{4})\b/';
    
                    preg_match($pattern, $a['filename'], $ma);
                    $monthA = !empty($ma[1]) ? $ma[1] : 'January';
                    $dayA   = !empty($ma[2]) ? $ma[2] : '1';
                    $yearA  = isset($ma[3]) ? $ma[3] : '1970';
                    $timestampA = strtotime("$monthA $dayA, $yearA");
    
                    preg_match($pattern, $b['filename'], $mb);
                    $monthB = !empty($mb[1]) ? $mb[1] : 'January';
                    $dayB   = !empty($mb[2]) ? $mb[2] : '1';
                    $yearB  = isset($mb[3]) ? $mb[3] : '1970';
                    $timestampB = strtotime("$monthB $dayB, $yearB");

                    return $timestampB - $timestampA;  // Newest first
                }
                $fullCatA = $a['category'];
                $fullCatB = $b['category'];
        
                $subPriorityA = array_search($fullCatA, $prioritizeCategories);
                $subPriorityB = array_search($fullCatB, $prioritizeCategories);

                $pinA = in_array(sanitizeFileName($a['filename']), $pinnedArticles, true);
                $pinB = in_array(sanitizeFileName($b['filename']), $pinnedArticles, true);
                if ($pinA !== $pinB) return $pinA ? -1 : 1;
        
                if ($subPriorityA !== false || $subPriorityB !== false) {
                    $subPriorityA = $subPriorityA === false ? PHP_INT_MAX : $subPriorityA;
                    $subPriorityB = $subPriorityB === false ? PHP_INT_MAX : $subPriorityB;
                    if ($subPriorityA != $subPriorityB) {
                        return $subPriorityA - $subPriorityB;
                    }
                }
        
                // Sort subcategories
                $subCatA = isset($catA[1]) ? $catA[1] : '';
                $subCatB = isset($catB[1]) ? $catB[1] : '';
        
                if ($subCatA != $subCatB) {
                    // If one is a subcategory and the other isn't, put the main category first
                    if ($subCatA === '' && $subCatB !== '') return -1;
                    if ($subCatA !== '' && $subCatB === '') return 1;
                    // Otherwise, sort subcategories alphabetically
                    return strcmp($subCatA, $subCatB);
                }
            }
            // If categories are the same, sort by article name
            return strcmp($a['filename'], $b['filename']);
        });
        foreach ($articles as $article) {
            $filePath = $article['filePath'];
            $filename = $article['filename'];
            $category = $article['category'];
            $topCategory = explode('/', $category)[0];
            $sanitizedCategory = sanitizeFileName($topCategory);
            $lowerCategory = strtolower($category);
            $sanitizedName = sanitizeFileName($filename);
        ?>
        
        <div class="card-md" data-id="<?= htmlspecialchars($filePath, ENT_QUOTES, 'UTF-8'); ?>"
        <?php if ($lowerFolderName !== '' && strpos($lowerCategory, $lowerFolderName) !== 0) 
                echo ' style="display: none;"'; 
                $fullUrl = $categoryInLinks ? $sanitizedCategory . '/' . $sanitizedName : $sanitizedName; ?>>
                <span class="category"><?= $category ?></span>
                <h2><a class="read-more" href="/<?= $fullUrl ?>"><?= $filename ?></a></h2>
            </div>
        <?php } ?>
        </div>
    <div class="results"></div>
    </main>
    <?php } else { ?>
        <div class="content"><?php
        $fileMd = $mdFolder.'/'.$originalFile.'.md';
        $fileTxt = $mdFolder.'/'.$originalFile.'.txt';
        $file = file_exists($fileMd) ?$fileMd:(file_exists($fileTxt) ?$fileTxt : null);

        if (!$file) {
            echo '<p id="not-found">Page not found. Go to the <a href="/">homepage</a>.</p>';
            echo '</div></body></html>';
            exit;
        }
        require_once 'code/Parsedown.php';
        require_once 'code/ParsedownExtra.php';
        $Parsedown = new ParsedownExtra();  
        $content = trim(file_get_contents($file));

        $scrollToThisPlaceholder = "\u{F8FF}";

        if (isset($_GET['search'])) {
            $pattern = '';
            $searchValue = preg_replace('/\s/', '', html_entity_decode(strip_tags($_GET['search'])));
    
            for ($i = 0; $i < iconv_strlen($searchValue, 'UTF-8'); $i++) {
                $pattern .= preg_quote(iconv_substr($searchValue, $i, 1, 'UTF-8'), '/') . '(?:\\s*|)';
            }

            if (preg_match('#' . $pattern . '#miu', $content, $matches, PREG_OFFSET_CAPTURE)) {
                $position = $matches[0][1];
                $currentURL = $_SERVER['REQUEST_URI'];
                $newURL = preg_replace('/&search=[^&]*/', '', $currentURL) . "&pos={$position}";
                echo "<script>history.replaceState({}, null, '{$newURL}');</script>";
                $content = substr_replace($content, $scrollToThisPlaceholder, $matches[0][1], 0);
            }
        }

        if (isset($_GET['pos'])) {
            $position = intval($_GET['pos']);
            if ($position > 0 && $position < strlen($content)) {
                $content = substr_replace($content, $scrollToThisPlaceholder, $position, 0);
            }
        }
        if (isset($_GET['s'])) {
            $s = $_GET['s'];
            $s = strip_tags($s);
            $s = html_entity_decode($s);
            $words = explode('+', $s); // Split the words

            $words = array_filter($words, function($word) {
                if ($word === '') return false;			
                if (iconv_strlen($word, 'UTF-8') > 1) return true;
                return !preg_match('/^[a-z]$/i', $word);
            });
								
            $pattern = implode('|', array_map(function ($word) {
                 return preg_quote($word, '/');
            }, $words)); // Create a pattern that matches any of the words
								
            // Replace each match with the highlighted version
            if ($pattern !== '') {
                $content = preg_replace_callback('/' . $pattern . '/miu', function ($match) {
                    return '<span class="highlight">' . $match[0] . '</span>';
                }, $content);
            }
        }

        $content = str_replace($scrollToThisPlaceholder, '<span id="scrollToThis"></span>', $content);

        $content = preg_replace('/!\[\[(.*?) \| (\d+)\]\]/', '<img src="imgs/$1" alt="$1" width="$2">', $content);
        $content = preg_replace('/!\[(.*?)\]\((.*?)\)/', '![$1](imgs/$2)', $content);
        $content = preg_replace('/!\[\[(.*?)\]\]/', '![$1](imgs/$1 "Title")', $content);
        $htmlContent = $Parsedown->text($content);
            
        // Fix footnote links (because of base href ='/')
        $htmlContent = preg_replace('/href=(["\'])#([^"\']+)\1/i', 'href=$1' . $uri . '#$2$1', $htmlContent);

        echo $htmlContent;
        if (isset($_GET['s'])) {
            echo '<button id="removeHighlights"><span class="x">×</span>Highlights</button>';
        }
        ?>
        </div>
        <script defer src="/code/findonpage.js?v=2"></script>
    <?php } ?>
    <script src="/code/<?= $script ?>?v=371"></script>
</body>
</html>