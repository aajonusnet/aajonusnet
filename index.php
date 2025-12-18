<?php
$title = "Aajonus.net";
$description = "Raw Primal Diet: Aajonus Online Database by Aajonus Vonderplanitz. Aajonus Transcriptions.";
$url = "https://aajonus.net/";
$sitename = "Aajonus Net";
$categoryInLinks = false;
$prioritizeCategories = ['QNA', 'Newsletters', 'Books', 'Books/Old'];
?>
<?php
function sanitizeFileName($string) {
    $string = preg_replace('/[^a-zA-Z0-9\s]/', '', $string);
    $string = preg_replace('/\s+/', '-', $string);
    $string = strtolower($string);
    return $string;
}
$articleMap = [];
$categoryMap = [];
function populateArticleMap() {
    global $articleMap, $categoryMap;
    $mdFolder = 'md';
    $mdFolderLength = strlen($mdFolder) + 1;
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder,  FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
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

$dynamicTitle = (!$originalFile) ? $title : basename($originalFile, '.md');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?php echo $dynamicTitle; ?></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="canonical" href="<?php echo $url; ?>">
    <base href="/">
    <link rel="stylesheet" href="style.css?v=6">
    <link rel="icon" href="favicon.ico" type="image/x-icon" sizes="any">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
    <meta name="title" content="<?php echo $dynamicTitle; ?>">
    <meta name="description" content="<?php echo $description; ?>">
    <meta property="og:title" content="<?php echo $dynamicTitle; ?>">
    <meta property="og:description" content="<?php echo $description; ?>">
    <meta property="og:url" content="<?php echo $url; ?>">
    <meta property="og:site_name" content="<?php echo $sitename; ?>">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="apple-touch-icon.png">
    <meta name="format-detection" content="telephone=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <link rel="manifest" href="manifest.json">
</head>
<body>
    <div class="header">
        <div class="title-container">
            <?php if ($originalFile) { ?>
                <button class="back-button" onclick="goBack()">←</button>
            <?php } ?>
            <a class="title" href="/"><h1><?php echo $dynamicTitle; ?></h1></a>
        <?php if ($originalFile) { ?>
<div id="share-button" onclick="shareArticle()" style="display: none;" role="button" tabindex="0">
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" fill="white"></path></svg>
</div>
        <?php } ?>
        </div>
    </div>
    <?php 
if (!$originalFile) { ?>
        <!-- Search Bar -->
        <div class="search-container">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 44"> <path fill="#757575" d="M14.298,27.202l-3.87-3.87c0.701-0.929,1.122-2.081,1.122-3.332c0-3.06-2.489-5.55-5.55-5.55c-3.06,0-5.55,2.49-5.55,5.55 c0,3.061,2.49,5.55,5.55,5.55c1.251,0,2.403-0.421,3.332-1.122l3.87,3.87c0.151,0.151,0.35,0.228,0.548,0.228 s0.396-0.076,0.548-0.228C14.601,27.995,14.601,27.505,14.298,27.202z M1.55,20c0-2.454,1.997-4.45,4.45-4.45 c2.454,0,4.45,1.997,4.45,4.45S8.454,24.45,6,24.45C3.546,24.45,1.55,22.454,1.55,20z"></path> </svg>
            <input type="text" id="search" class="search-bar" oninput="search(this)" placeholder="Loading..." disabled>
            <div id="clear-icon" class="clear-icon" onclick="clearSearch()">&#10005;</div>
        </div>
        <!-- Links -->
	    <div class="links">
    		    <a href="#" onclick="filterCategory('All', 'All', this)">All</a>
    		    <?php 
   		    $mdFolder = 'md';
    		    $directories = glob($mdFolder . '/*', GLOB_ONLYDIR);
            $folderName = '';
            if (isset($_GET['category'])) {
                $folderName = str_replace("/index.php", "", $_GET['category']);
                $folderName = $categoryMap[$folderName] ?? null;
            }
    		    foreach ($directories as $dir) {
       		    $category = str_replace('md', '', basename($dir));
                 $sanitizedCategory = sanitizeFileName($category);
                  $selectedClass = '';

                  if (isset($folderName) && strtolower($category) === strtolower($folderName)) {
                     $selectedClass = 'chosen-link';
                  }
        		    echo '<a href="#" class="' . $selectedClass . '" onclick="event.preventDefault(); filterCategory(\'' . $category . '\', \'' . $sanitizedCategory . '\', this)">' . $category . '</a><br>';
   		    }
   		    ?>
	    </div>
        <main>
        <div class="grid">
        <?php
		   if (!empty($folderName)) {
                $fullFolderPath = "md/" . $folderName;

                $lowerFullFolderPath = strtolower($fullFolderPath);
                $folderExists = false;
                
                 foreach (glob("md/*", GLOB_ONLYDIR) as $dir) {
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

            $mdFolder = 'md';
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

    $articles[] = ['filePath' => $filePath, 'filename' => $filename, 'category' => $category]; // Add this line
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
    
    // If main categories are the same
    if ($mainCatA == $mainCatB) {
        // Special handling for "QNA" category
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
        
        // If no priority difference for full categories, sort subcategories alphabetically
        $subCatA = isset($catA[1]) ? $catA[1] : '';
        $subCatB = isset($catB[1]) ? $catB[1] : '';
        
        $subCatCompare = strcmp($subCatA, $subCatB);
        if ($subCatCompare !== 0) {
            return $subCatCompare;
        }
    }
    
    // If categories are the same or have same priority, sort by article name
    return strcmp($a['filename'], $b['filename']);
});
            foreach ($articles as $article) {
                $filePath = $article['filePath'];
                $filename = $article['filename'];
                $category = $article['category'];

                if ($category == $mdFolder){
                    $category = 'other';
                }else{
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
    <?php } else { ?>
        <div class="content"><?php
                $file = 'md/' . $originalFile . '.md';

                if (file_exists($file)) {
                    require 'libs/Parsedown.php';
                    $Parsedown = new Parsedown();  
                    $content = file_get_contents($file);
                    $content = trim($content);

$scrollToThisPlaceholder = "\u{F8FF}";

if (isset($_GET['search'])) {
    $pattern = '';
    $searchValue = preg_replace('/\s/', '', html_entity_decode(strip_tags($_GET['search'])));
    
    for ($i = 0; $i < mb_strlen($searchValue); $i++) {
        $pattern .= preg_quote(mb_substr($searchValue, $i, 1), '/') . '(?:\\s*|)';
    }

    if (preg_match('#' . $pattern . '#miu', $content, $matches, PREG_OFFSET_CAPTURE)) {
        $position = $matches[0][1];
        $currentURL = $_SERVER['REQUEST_URI'];
        $newURL = preg_replace('/&search=[^&]*/', '', $currentURL) . "&pos={$position}";
        echo "<script>
            history.replaceState({}, null, '{$newURL}');
        </script>";
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
           return mb_strlen($word) >= 2;
        });

        $pattern = implode('|', array_map(function ($word) {
            return preg_quote($word, '/');
        }, $words)); // Create a pattern that matches any of the words

        // Replace each match with the highlighted version
        $content = preg_replace_callback('/' . $pattern . '/miu', function ($match) {
            return '<span class="highlight">' . $match[0] . '</span>';
        }, $content);
    }

$content = str_replace($scrollToThisPlaceholder, '<span id="scrollToThis"></span>', $content);
     //$category = basename(dirname($file));

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
            echo '<button id="removeHighlights">&#10005; Highlights</button>';
        }
                } else {
                    echo '<p>File not found.</p>';
                }
            ?>
    </main>
</div>  
    <?php } ?>
    <div class="results"></div>
    <script src="index.js?v=196"></script>
</body>
</html>