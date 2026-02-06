<?php
// Loads: $logoTitle, $siteTitle, $siteDescription, $siteKeywords, $siteName, $twitterAccount, $categoryInLinks
// $mdFolder, $baseUrl, $prioritizeCategories, $sortArticlesByDate, $pinnedArticles, $cacheHours
require_once __DIR__ . '/config.php';

$articleMap = [];
$categoryMap = [];

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
        $rel = substr($path, $rootLen);
        if ($f->isDir()) {
            if ($rel !== '') $categoryMap[sanitizeFileName($rel)] = $rel;
            continue;
        }

        $ext = strtolower($f->getExtension());
        if ($ext !== 'md' && $ext !== 'txt') continue;

        $filename = $f->getBasename('.'.$ext);

        $cat = str_replace('\\', '/', dirname($rel));
        $cat = $cat === '.' ? 'other' : ltrim($cat, '/');

        [$main, $sub] = array_pad(explode('/', $cat, 2), 2, '');
        $slug = sanitizeFileName($filename);
        $dateTs = titleDateTs($filename);
        $articleMap[$slug] = substr($rel, 0, -strlen($ext) - 1);
        $articles[] = [
            'filePath' => $path,
            'filename' => $filename,
            'category' => $cat,
            'main'     => $main,
            'sub'      => $sub,
            'slug'     => $slug,
            'dateTs'   => $dateTs
        ];
    }
    return $articles;
}

$articles = buildIndex();

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$slug = basename(trim($uri, '/'));
$originalFile = $slug !== '' ? ($articleMap[strtolower($slug)] ?? null) : null;

$dynamicTitle = $originalFile ? basename($originalFile) : $siteTitle;

$canonicalUrl = $baseUrl;
if ($originalFile) $canonicalUrl = $baseUrl . $slug;

$isHome = ($slug === '');
$is404 = !$isHome && !$originalFile && !isset($categoryMap[sanitizeFileName($slug)]);
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
    <?php if (!$is404): ?><link rel="canonical" href="<?= $canonicalUrl ?>"><?php endif; ?>
    <link rel="stylesheet" href="/style.css?v=1">
    <link rel="icon" href="/logos/favicon.ico" type="image/x-icon" sizes="any">
    <link rel="apple-touch-icon" href="/logos/apple-touch-icon.png">

    <meta name="title" content="<?= $dynamicTitle ?>">
    <meta name="description" content="<?= $siteDescription ?>">
    <meta name="keywords" content="<?= $siteKeywords ?>">

    <meta property="og:title" content="<?= $dynamicTitle ?>">
    <meta property="og:description" content="<?= $siteDescription ?>">
    <meta property="og:url" content="<?= $canonicalUrl ?>">
    <meta property="og:site_name" content="<?= $siteName ?>">
    <meta property="og:type" content="website">
    <meta property="og:image" content="<?= $baseUrl ?>logos/large-logo.jpg">

    <meta name="twitter:card" content="summary">
    <meta name="twitter:image" content="<?= $baseUrl ?>logos/large-logo.jpg">
    <meta name="twitter:site" content="<?= $twitterAccount ?>">
    <meta name="format-detection" content="telephone=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">

    <link rel="manifest" href="/manifest.json">
</head>
<body>
    <header>
        <?php if ($originalFile) {
            $catPath = str_replace('\\', '/', dirname($originalFile));
            if ($catPath !== '.') {
                $catDisplay = str_replace('/', ' <span class="sep">/</span> ', $catPath);
                echo '<nav aria-label="Breadcrumb" id="header-category">' . $catDisplay . '</nav>';
            }
        }
        ?>
        <div id="title-container">
            <a id="title" href="/"><h1><?= $originalFile ? $dynamicTitle : $logoTitle ?></h1></a>
            <?php if ($originalFile) { ?>
            <a href="/" id="back-button" onclick="goBack(event)" aria-label="Go back" tabindex="0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polyline points="13.42,5.41 4,12 13.41,18.59" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
            <div id="share-button" onclick="shareArticle()" role="button" aria-label="Share" tabindex="0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 4l-1.42 1.42-1.59-1.59V15h-1.98V3.83L9.42 5.42 8 4l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V9c0-1.11.89-2 2-2h3v2H6v11h12V9h-3V7h3c1.1 0 2 .89 2 2z" fill="currentColor"/></svg>
            </div>
            <?php } ?>
        </div>
    </header>
    <?php if (!$originalFile && !$is404) { ?>
        <!-- Search Bar -->
        <div id="search-container">
            <svg id="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 44"><g stroke="#757575" stroke-width="1.1" fill="none" stroke-linecap="butt"><circle cx="6" cy="20" r="5"/><line x1="10.039" y1="23.721" x2="13.909" y2="27.591"/></g></svg>
            <input type="text" id="search" oninput="search(this)" placeholder="Loading..." disabled aria-label="Search website" spellcheck="false" enterkeyhint="search">
            <div id="clear-icon" onclick="clearSearch()" role="button" aria-label="Clear search" hidden>&times;</div>
        </div>
        <!-- Categories -->
        <nav id="categories" aria-label="Categories">
            <a href="/" onclick="filterCategory(event, 'All', 'All', this)">All</a>
            <?php 
            $topLevelCategories = array_filter($categoryMap, fn($p) => strpos($p, '/') === false);
            asort($topLevelCategories);
            $folderName = '';
            if (isset($_GET['category'])) {
                $folderName = $categoryMap[sanitizeFileName((string)$_GET['category'])] ?? '';
            }
            foreach ($topLevelCategories as $category => $cat) {
              $chosen = (isset($folderName) && strtolower($cat) === strtolower($folderName)) ? 'chosen-category' : '';
              $classAttr = $chosen ? ' class="' . $chosen . '"' : '';
              echo '<a href="/' . $category . '/"' . $classAttr . ' onclick="filterCategory(event, \'' . $cat . '\', \'' . $category . '\', this)">' . $cat . '</a>';
            }
            ?>
        </nav>
        <main>
        <div id="grid">
        <?php
        $prioIdx = array_flip($prioritizeCategories);
        $pinSet = array_flip($pinnedArticles);
        $sortDateSet = array_flip($sortArticlesByDate);

        $lowerFolderName = strtolower($folderName);        

        usort($articles, function ($a, $b) use ($prioIdx, $pinSet, $sortDateSet) {
            // main category priority
            $pmA = $prioIdx[$a['main']] ?? PHP_INT_MAX;
            $pmB = $prioIdx[$b['main']] ?? PHP_INT_MAX;
            if ($pmA !== $pmB) return $pmA <=> $pmB;

            // different mains but same priority -> alpha
            if ($a['main'] !== $b['main']) return $a['main'] <=> $b['main'];

            // same main: special date-sorted categories
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
        foreach ($articles as $article) {
            $filePath = $article['filePath'];
            $dataId = htmlspecialchars($filePath, ENT_QUOTES, 'UTF-8');
            $filename = $article['filename'];
            $category = $article['category'];
            $sanitizedCategory = sanitizeFileName($article['main']);
            $lowerCategory = strtolower($category);
            $sanitizedName = $article['slug'];
            $fullUrl = $categoryInLinks ? $sanitizedCategory . '/' . $sanitizedName : $sanitizedName;
            $hidden = ($lowerFolderName !== '' && strpos($lowerCategory, $lowerFolderName) !== 0) ? ' hidden' : '';
        ?>
        <div class="card-md" data-id="<?= $dataId ?>"<?= $hidden ?>>
            <span class="category"><?= $category ?></span>
            <h2><a class="read-more" href="/<?= $fullUrl ?>"><?= $filename ?></a></h2>
        </div>
        <?php } ?>
        <p id="footer">Download this entire website & the text files on the <a href="https://archive.org/details/aajonusnet"><b>Internet Archive</b></a> or <a href="https://github.com/aajonusnet/aajonusnet"><b>GitHub</b></a>.</p>
        </div>
    <div id="results"></div>
    </main>
    <?php } else { ?>
        <div id="content"><?php
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
        $position = null;

        if (isset($_GET['search'])) {
            $searchValue = preg_replace('/\s/', '', html_entity_decode(strip_tags($_GET['search'])));
            $pattern = '';
            for ($i = 0, $n = iconv_strlen($searchValue, 'UTF-8'); $i < $n; $i++) {
                $pattern .= preg_quote(iconv_substr($searchValue, $i, 1, 'UTF-8'), '/') . '\\s*';
            }
            if ($pattern && preg_match('#' . $pattern . '#miu', $content, $matches, PREG_OFFSET_CAPTURE)) {
                $position = $matches[0][1];
                $currentURL = $_SERVER['REQUEST_URI'];
                $newURL = preg_replace('/&search=[^&]*/', '', $currentURL) . "&pos={$position}";
                echo "<script>history.replaceState({}, null, " .  json_encode($newURL) . ");</script>";
            }
        } else if (isset($_GET['pos'])) {
            $position = max(0, (int)$_GET['pos']);
            $position = min($position, strlen($content));
        }
        $content = preg_replace(['~^\[audio\]:\s*\(([^)]+)\)\s*$~m', '~^\[video\]:\s*\(([^)]+)\)\s*$~m'],
        ['<audio controls preload="none" src="$1"></audio>', '<video controls playsinline preload="none" src="$1"></video>'], $content);

        $content = preg_replace('/!\[\[(.*?) \| (\d+)\]\]/', '<img src="/imgs/$1" alt="$1" width="$2">', $content);
        $content = preg_replace('/!\[(.*?)\]\((.*?)\)/', '![$1](/imgs/$2)', $content);
        $content = preg_replace('/!\[\[(.*?)\]\]/', '![$1](/imgs/$1 "$1")', $content);

        if ($position !== null) {
          $prefixHtml = $Parsedown->text(substr($content, 0, $position));
          $plain = html_entity_decode(strip_tags($prefixHtml), ENT_QUOTES|ENT_HTML5, 'UTF-8');
          $scrollToPos = (int) (strlen(iconv('UTF-8','UTF-16LE', $plain)) / 2);
          echo "<script>scrollToPos={$scrollToPos};</script>";
        }

        $htmlContent = $Parsedown->text($content);
        if ($openLinksInNewTab) {
            $htmlContent = preg_replace('/(<a href="http)/i', '<a target="_blank" rel="noopener noreferrer" href="http', $htmlContent);
        }
        echo $htmlContent;
        ?>
        </div>
        <?= isset($_GET['s']) ? '<button id="remove-highlights"><span class="x">×</span>Highlights</button>' : '' ?>
        <script defer src="/code/findonpage.js"></script>
    <?php } ?>
    <script defer src="/code/index.js?v=1" id="main-js" data-cache="<?= $cacheHours ?>"></script>
</body>
</html>