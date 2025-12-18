<!DOCTYPE html>
<html>
<head>
    <title>Aajonus.net</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="canonical" href="https://aajonus.net/">
    <link rel="stylesheet" href="style.css?v=71">
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <link rel="manifest" href="manifest.json">
    <meta name="title" content="News">
    <meta name="description" content="Raw Primal Diet: Aajonus Online Database by Aajonus Vonderplanitz">
    <meta name="format-detection" content="telephone=no">
    <meta property="og:title" content="News">
    <meta property="og:description" content="Raw Primal Diet: Aajonus Online Database by Aajonus Vonderplanitz">
    <meta property="og:url" content="https://aajonus.net/">
    <meta property="og:site_name" content="Aajonus Net">
    <meta property="og:type" content="website">
</head>
<body>
    <div class="header">
        <div class="title-container">
            <?php if (isset($_GET['file'])) { ?>
                <button class="back-button" onclick="goBack()">←</button>
            <?php } ?>
            <a class="title" href="/"><h1><?php echo (!isset($_GET['file'])) ? 'Aajonus.net' : basename($_GET['file'], '.md'); ?></h1></a>
        </div>
    </div>

    <?php if (!isset($_GET['file'])) { ?>
        <!-- Search Bar -->
        <div class="search-container">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 44"> <path fill="#757575" d="M14.298,27.202l-3.87-3.87c0.701-0.929,1.122-2.081,1.122-3.332c0-3.06-2.489-5.55-5.55-5.55c-3.06,0-5.55,2.49-5.55,5.55 c0,3.061,2.49,5.55,5.55,5.55c1.251,0,2.403-0.421,3.332-1.122l3.87,3.87c0.151,0.151,0.35,0.228,0.548,0.228 s0.396-0.076,0.548-0.228C14.601,27.995,14.601,27.505,14.298,27.202z M1.55,20c0-2.454,1.997-4.45,4.45-4.45 c2.454,0,4.45,1.997,4.45,4.45S8.454,24.45,6,24.45C3.546,24.45,1.55,22.454,1.55,20z"></path> </svg>
            <input type="text" id="search" class="search-bar" oninput="search(this)" placeholder="Search">
        </div>
        <!-- Links -->
	    <div class="links">
    		    <a href="#" onclick="filterCategory('All', this)">All</a>
    		    <?php 
   		    $mdFolder = 'md';
    		    $directories = glob($mdFolder . '/*', GLOB_ONLYDIR);
    		    foreach ($directories as $dir) {
       		    $category = str_replace('md', '', basename($dir));
        		    echo '<a href="#" onclick="event.preventDefault(); filterCategory(\'' . $category . '\', this)">' . $category . '</a><br>';
   		    }
   		    ?>
	    </div>

        <div class="grid">
        <?php
            function escapeRegex($string) {
                return preg_replace('/[.*+?^${}()|[\]\\]/u', '\\\\$0', $string);
            }

            $folderName = "";
		   if (isset($_GET['category'])) {
    		        $folderName = str_replace("/index.php", "", $_GET['category']);
                $fullFolderPath = "md/" . $folderName;

                if (is_dir($fullFolderPath) == false) {
                    echo '<p>Page not found.</p>';
                }
		   }

            $folderName = str_replace("/", "\\", $folderName);
            $lowerFolderName = strtolower($folderName);

            $mdFolder = 'md';
            $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder));
            foreach ($files as $file) {
                if ($file->isDir()) {
                    continue;
                }

                $filePath = $file->getPathname();

                $category = dirname($filePath);   
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

                $filename = $file->getBasename('.md');
                $content = file_get_contents($filePath);
                
                // formating is a waste of resources
                // there is no need for it in the preview or hidden content
                $content = str_replace('\n', ' ', $content);

                $htmlContent = $content;
                
                ?>
                
                <div class="card-md" 
                <?php if (strpos(strtolower($filePath), $lowerFolderName) === false) 
                echo ' style="display: none;"'; ?>>
                    <span class="category"><?php echo $category;?></span>
                    <h2><u><a class="read-more" href="<?php echo isset($_GET['category']) ? '../?file=' : '?file='; ?><?php echo urlencode($filePath); ?>">
                    <?php echo $filename; ?> </a></u></h2>
                    <a class="read-more" href="?file=<?php echo urlencode($filePath); ?>"></a>
                    <div class="data" style="display:none;"><?php echo $htmlContent ?></div>
                </div>
            <?php } ?>

        </div>
    <?php } else { ?>
        <div class="content"><?php
                $file = $_GET['file'];

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
        $content = substr_replace($content, $scrollToThisPlaceholder, $matches[0][1], 0);
    }
}
    if (isset($_GET['s'])) {
        $s = $_GET['s'];
        $s = strip_tags($s);
        $s = html_entity_decode($s);
        $words = explode('+', $s); // Split the words

        $pattern = implode('|', array_map(function ($word) {
            return preg_quote($word, '/');
        }, $words)); // Create a pattern that matches any of the words

        // Replace each match with the highlighted version
        $content = preg_replace_callback('/' . $pattern . '/miu', function ($match) {
            return '<span class="highlight">' . $match[0] . '</span>';
        }, $content);
    }

$content = str_replace($scrollToThisPlaceholder, '<span id="scrollToThis"></span>', $content);
     
     $category = basename(dirname($file));

if ($category == 'Books' || $category == 'Workshops') {
    $content = str_replace("\n", "\n\n", $content);
}

         $content = preg_replace('/!\[(.*?)\]\((.*?)\)/', '![$1](imgs/$2)', $content);
         $content = preg_replace('/!\[\[(.*?)\]\]/', '![$1](imgs/$1 "Title")', $content);
         $htmlContent = $Parsedown->text($content);

// Identify footnote references and footnotes
preg_match_all('/\[\^(\d+)\]/', $htmlContent, $refs);
preg_match_all('/\[\^(\d+)\]: (.*)/', $htmlContent, $notes);

$footnoteRefs = $refs[1];
$footnoteNotes = array_combine($notes[1], $notes[2]);
foreach ($footnoteRefs as $ref) {
    $occurrences = substr_count($htmlContent, "[^$ref]");
    $counter = 0;
    $htmlContent = preg_replace_callback("/\[\^{$ref}\]/", function ($matches) use (&$counter, $occurrences, $ref) {
        $counter += 1;
        if ($counter < $occurrences) {
            return "<a href=\"#fn{$ref}\">[{$ref}]</a>";
        } else {
            return "<a id=\"fn{$ref}\">[{$ref}]</a>";
        }
    }, $htmlContent);
}
                    echo $htmlContent;
if (isset($_GET['s'])) {
            echo '<button id="removeHighlights">&#10005; Highlights</button>';
        }
                    // echo $content;
                } else {
                    echo '<p>File not found.</p>';
                }
            ?>
</div>  
    <?php } ?>
    <div class="results"></div>
    <script src="index.js?v=172"></script>
</body>
</html>