<?php

//error_reporting(E_ALL);
//ini_set('display_errors', 1);

$title = "Aajonus Vonderplanitz";
$description = "Raw Primal Diet: Aajonus Online Archive by Aajonus Vonderplanitz. Complete Aajonus Transcriptions.";
$keywords = "aajonus, aajonus vonderplanitz, primal diet, raw primal diet, raw meat, raw milk, raw dairy, raw meat diet, raw honey";
$url = "https://aajonus.net/";
$sitename = "Aajonus Vonderplanitz";
$twitterAccount = "@Aajonus";

$categoryInLinks = false;
$prioritizeCategories = ['QNA', 'Newsletters', 'Books', 'Books/Old'];

$mdFolder = 'md';
$articleMap = [];
$categoryMap = [];

function sanitizeFileName($string) {
    $string = iconv('UTF-8', 'ASCII//TRANSLIT', $string);
    $string = preg_replace('/[^a-zA-Z0-9\s]/', '', $string);
    $string = preg_replace('/\s+/', '-', $string);
    return strtolower(trim($string, '-'));
}

function populateArticleMap() {
    global $articleMap, $categoryMap, $mdFolder;
    $mdFolderLength = strlen($mdFolder) + 1;
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($files as $file) {
        $filePath = $file->getPathname();
        if ($file->isDir()) {
            $category = str_replace($mdFolder . '/', '', $filePath);
             if ($category === '..' || $category === '.') {
                continue; // skip parent and current directory markers
            }
            $sanitizedCategory = sanitizeFileName($category);
            $categoryMap[$sanitizedCategory] = $category;
            continue;
        }
        $filename = $file->getBasename('.md');
        $sanitizedName = sanitizeFileName($filename);
        $relativePath = substr($filePath, $mdFolderLength, -3);  // Remove 'md/' and '.md' from the path
        $articleMap[$sanitizedName] = $relativePath;
    }
}
populateArticleMap();
function findOriginalFileName($sanitizedName) {
    global $articleMap;
    $sanitizedName = strtolower($sanitizedName);
    return $articleMap[$sanitizedName] ?? null;
}
$uri = parse_url(strtok($_SERVER['REQUEST_URI'], '&'), PHP_URL_PATH);
$uriSegments = explode("/", $uri);
$sanitizedFile = array_pop($uriSegments);
$originalFile = findOriginalFileName($sanitizedFile);

$dynamicTitle = $originalFile ? basename($originalFile, '.md') : $title;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?php echo $dynamicTitle; ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="canonical" href="<?php echo $url; ?>">
    <base href="/">
    <link rel="stylesheet" href="style.css?v=54">
    <link rel="icon" href="logos/favicon.ico" type="image/x-icon" sizes="any">
    <link rel="apple-touch-icon" href="logos/apple-touch-icon.png">

    <meta name="title" content="<?php echo $dynamicTitle; ?>">
    <meta name="description" content="<?php echo $description; ?>">
    <meta name="keywords" content= "<?php echo $keywords; ?>">

    <meta property="og:title" content="<?php echo $dynamicTitle; ?>">
    <meta property="og:description" content="<?php echo $description; ?>">
    <meta property="og:url" content="<?php echo $url; ?>">
    <meta property="og:site_name" content="<?php echo $sitename; ?>">
    <meta property="og:type" content="website">
    <meta property="og:image" content="<?php echo $url; ?>logos/large-logo.jpg">

    <meta name="twitter:card" content="summary">
    <meta property="twitter:image" content="<?php echo $url; ?>logos/large-logo.jpg">
    <meta name="twitter:site" content="<?php echo $twitterAccount; ?>">
    <meta name="format-detection" content="telephone=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">

    <link rel="manifest" href="manifest.json">
</head>
<body>
    <div class="header">
        <div class="title-container">
            <?php if ($originalFile) { ?>
                <div class="back-arrow" onclick="goBack()">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><polyline points="13.42,5.41 4,12 13.41,18.59" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
            <?php } ?>
            <a class="title" href="/"><h1><?php echo $dynamicTitle === "Aajonus Vonderplanitz" ? "Aajonus.net" : $dynamicTitle; ?></h1></a>
            <?php if ($originalFile) { ?>
                <div id="share-button" onclick="shareArticle()" role="button" tabindex="0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" fill="white"/></svg>
</div>
            <?php } ?>
        </div>
    </div>
    <?php if (!$originalFile) { ?>
        <!-- Search Bar -->
        <div class="search-container">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 44"><g stroke="#757575" stroke-width="1.1" fill="none" stroke-linecap="butt"><circle cx="6" cy="20" r="5"/><line x1="10.039" y1="23.721" x2="13.909" y2="27.591"/></g></svg>
            <input type="text" id="search" class="search-bar" oninput="search(this)" placeholder="Loading..." disabled>
            <div id="clear-icon" class="clear-icon" onclick="clearSearch()">&#10005;</div>
        </div>
        <!-- Categories -->
        <div class="categories">
            <a href="#" onclick="filterCategory('All', 'All', this)">All</a>
            <?php 
                $directories = glob($mdFolder . '/*', GLOB_ONLYDIR);
                $folderName = '';
                if (isset($_GET['category'])) {
                    $folderName = str_replace("/index.php", "", $_GET['category']);
                    $folderName = $categoryMap[$folderName] ?? null;
                }
                foreach ($directories as $dir) {
                     $category = str_replace('md', '', basename($dir));
                     $sanitizedCategory = sanitizeFileName($category);
                     $selectedClass = (isset($folderName) && strtolower($category) === strtolower($folderName)) ? 'chosen-category' : '';
                     echo '<a href="#" class="' . $selectedClass . '" onclick="event.preventDefault(); filterCategory(\'' . $category . '\', \'' . $sanitizedCategory . '\', this)">' . $category . '</a><br>';
                }
            ?>
        </div>
        <main>
        <div class="grid">
        <?php
        if (!empty($folderName)) {
            $fullFolderPath = $mdFolder . "/" . $folderName;
            $lowerFullFolderPath = strtolower($fullFolderPath);
            $folderExists = false;

            foreach (glob($mdFolder . "/*", GLOB_ONLYDIR) as $dir) {
                if (strtolower($dir) == $lowerFullFolderPath) {
                    $folderExists = true;
                    $folderName = basename($dir);
                    break;
                }
            }

            if (!$folderExists && !$originalFile) {
                echo '<p id="not-found">Page not found.</p>';
            }
        }

        $folderName = str_replace("/", "\\", $folderName);
        $lowerFolderName = strtolower($folderName);
            
        $articles = [];
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder));

        foreach ($files as $file) {
           if ($file->isDir()) {
                    continue;
            }

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

            $articles[] = ['filePath' => $filePath, 'filename' => $filename, 'category' => $category];
        }
        usort($articles, function ($a, $b) use ($prioritizeCategories) {
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

            if ($category == $mdFolder) {
                $category = 'other';
            } else {
                $category = str_replace($mdFolder, '', $category);
                $subCategory = strpos($category, '\\', strpos($category, '/') + 1);
    
                if ($subCategory !== false) {
                    $category = substr($category, 0, $subCategory);
                }
                $category = ltrim($category, '/');
            }
                
            $sanitizedCategory = sanitizeFileName($category);
            $sanitizedName = sanitizeFileName($filename);
            $articleMap[$sanitizedName] = $filename;
            ?>
                
            <div class="card-md" 
            <?php if (strpos(strtolower($category), $lowerFolderName) === false) 
                echo ' style="display: none;"'; 
                $fullUrl = $categoryInLinks ? $sanitizedCategory . '/' . $sanitizedName : $sanitizedName; ?>>
                <span class="category"><?php echo $category;?></span>
                <h2><a class="read-more" href="/<?php echo $fullUrl; ?>"><?php echo $filename; ?></a></h2>
                <?php 
                    $originalName = $file->getBasename('.md');
                    $sanitizedName = sanitizeFileName($originalName);
                ?>
                <div class="data" id="<?php echo $filePath; ?>" style="display:none;"></div>
            </div>
        <?php } ?>
        </div>
    <div class="results"></div>
    </main>
    <?php } else { ?>
        <div class="content"><?php
        $file = $mdFolder . '/' . $originalFile . '.md';

        if (file_exists($file)) {
            require 'libs/Parsedown.php';
            $Parsedown = new Parsedown();  
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

            // Identify footnote references and footnotes
            preg_match_all('/\[\^(\d+)\]/', $htmlContent, $refs);
            preg_match_all('/\[\^(\d+)\]: (.*)/', $htmlContent, $notes);

            $footnoteRefs = $refs[1];
            $footnoteNotes = array_combine($notes[1], $notes[2]);
            $currentURL = $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
            foreach ($footnoteRefs as $ref) {
                $occurrences = substr_count($htmlContent, "[^$ref]");
                $counter = 0;
                $htmlContent = preg_replace_callback("/\[\^{$ref}\]/", function ($matches) use (&$counter, $occurrences, $ref, $currentURL) {
                    $counter += 1;
                    if ($counter < $occurrences) {
                        return "<a href=\"{$currentURL}#fn{$ref}\">[{$ref}]</a>";
                    } else {
                        return "<a id=\"fn{$ref}\">[{$ref}]</a>";
                    }
                }, $htmlContent);
            }
            echo $htmlContent;
            if (isset($_GET['s'])) {
                echo '<button id="removeHighlights"><span class="x">×</span>Highlights</button>';
            }
        } else {
            echo '<p>File not found.</p>';
        }
        ?>
        </div>
        <button id="activate-find-on-page" class="activate-find-on-page">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        </button>
        <div id="find-on-page" class="find-on-page">
            <div class="find-on-page-content">
                <button id="find-on-page-close">✕</button>
                <input type="text" id="find-on-page-input" placeholder="Find on Page">
                <div id="find-on-page-count"></div>
                <div class="find-on-page-buttons">
                    <button id="find-on-page-up">▲</button>
                    <button id="find-on-page-down">▼</button>
                </div>
            </div>
        </div>
    <?php } ?>
    <script src="index.js?v=370"></script>
</body>
</html>