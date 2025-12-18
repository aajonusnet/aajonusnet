<!DOCTYPE html>
<html>
<head>
    <title>Aajonus.net</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="style.css?v=63">
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
    <meta name="title" content="News">
    <meta name="description" content="Raw Primal Aajonus Database">
    <meta name="format-detection" content="telephone=no">
    <meta property="og:title" content="News">
    <meta property="og:description" content="Raw Primal Aajonus Database">
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
        <input type="text" id="search" class="search-bar"  oninput="search(this)" placeholder="Search">
        <!-- Links -->
        <div class="links">
            <a href="/">All</a>
            <?php 
            $mdFolder = 'md';
            $directories = glob($mdFolder . '/*', GLOB_ONLYDIR);
            $folderName = "";
            if (isset($_GET['category'])) {
                $folderName = str_replace("/index.php", "", $_GET['category']);
            }
            $folderName = str_replace("/", "\\", $folderName);

            foreach ($directories as $dir) {
                $category = basename($dir);
                $category = str_replace('md', '', $category);
                if ($category == $folderName) {
                    echo '<a class="chosen-link" href="' . urlencode($category) . '">' . $category . '</a><br>';
                }else{
                    echo '<a href="' . urlencode($category) . '">' . $category . '</a><br>';
                }
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
		   }

            $folderName = str_replace("/", "\\", $folderName);

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
                <?php if (strpos(strtolower($filePath), strtolower($folderName)) === false) 
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
                    // if start and end exist in GET request
                    if ( isset($_GET['s']) && isset($_GET['len']) ) {
                        error_reporting(E_ALL);
                        ini_set('display_errors', 1);


                        $s = $_GET['s'];
                        $s = strip_tags($s);
                        $s = html_entity_decode($s);
                        $s = preg_replace('/\s/', '', $s);
                        // $s = preg_quote($s, '/');
                        // $s = preg_replace('/(.)/u', '$1(?:\\s*|)', $s);

                        $pattern = '';
                        for ($i = 0; $i < mb_strlen($s); $i++) {
                            $char = preg_quote(mb_substr($s, $i, 1), '/');
                            // if ($char == '&') {
                            //     $char = '\&';
                            // }
                            $pattern .= $char . '(?:\\s*|)';
                        }
                        
                        $s = $pattern;
                        // echo $s;
                        
                        // regex to find $s
                        $regex = '#' . $s . '#miu';
                
                        $matches = [];
                        $pos = preg_match($regex, $content, $matches, PREG_OFFSET_CAPTURE, 0);
                        // echo $s;
 					if ($pos) {
   					 	// get the position of the first match
    						$pos = $matches[0][1];
    						// cut the content from start
    						$length = $_GET['len'];
                        
    						// save the original markdown as a substring
    						$substring = substr($content, $pos, $length);
    
    						// highlight the substring by wrapping it with the highlight span tags
    						$replacement = '</span><br><span class="highlight" id="scrollToThis">';
    						$replace = str_replace("\n", $replacement, $substring); 
    
    						// strip out markdown bold identifiers ** and __
    						$replace = str_replace('**', '', $replace);
    						$replace = str_replace('__', '', $replace);
    
    						// wrap the substring in highlight span tags
    						$replace = '<span class="highlight" id="scrollToThis">' . $replace . '</span>';

    						// replace the original substring in content with the highlighted version
    						$content = substr_replace($content, $replace, $pos, $length);
					}

                    }
                    
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

// TODO: Footnotes not working in "Bacteria and Other Microbes" for example
// Also in "How much Bacteria are we today"
// Also in "Multiple Lacerations Healed Without Medical Help"
// Replace footnote references with links to footnotes
                    echo $htmlContent;
                    // echo $content;
                } else {
                    echo '<p>File not found.</p>';
                }
            ?></div>  
    <?php } ?>
    <div class="results"></div>
    <script src="index.js?v=86">
       
    </script>
</body>
</html>
