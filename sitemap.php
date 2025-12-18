<?php
declare(strict_types=1);

header('Content-Type: application/xml; charset=utf-8');

$mdFolder = 'md';
$url = "https://aajonus.net/";

function sanitizeFileName($string) {
    $string = iconv('UTF-8', 'ASCII//TRANSLIT', $string);
    $string = preg_replace('/[^a-zA-Z0-9\s]/', '', $string);
    $string = preg_replace('/\s+/', '-', $string);
    $string = strtolower(trim($string, '-'));
    return $string;
}

$xml = '<?xml version="1.0" encoding="UTF-8"?>';
$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

// Home Page
$xml .= '<url>';
$xml .= '<loc>' . $url . '</loc>';
$xml .= '<changefreq>daily</changefreq>';
$xml .= '<priority>1.0</priority>';
$xml .= '</url>';

// Categories
$directories = glob($mdFolder . '/*', GLOB_ONLYDIR);
foreach ($directories as $dir) {
    $category = str_replace($mdFolder . '/', '', $dir);
    $category = sanitizeFileName($category);
    $xml .= '<url>';
    $xml .= '<loc>' . $url . $category . '</loc>';
    $xml .= '<changefreq>daily</changefreq>';
    $xml .= '<priority>0.8</priority>';
    $xml .= '</url>';
}

// Articles
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS | FilesystemIterator::UNIX_PATHS));

foreach ($files as $file) {
    if ($file->isDir()) {
        continue;
    }
    $ext = strtolower($file->getExtension());
    if ($ext !== 'md' && $ext !== 'txt') continue;

    $filename = $file->getBasename('.' . $ext);
    $sanitizedFileName = sanitizeFileName($filename);

    $xml .= '<url>';
    $xml .= '<loc>' . $url . $sanitizedFileName . '</loc>';
    $xml .= '<changefreq>weekly</changefreq>';
    $xml .= '<priority>0.7</priority>';
    $xml .= '</url>';
}

$xml .= '</urlset>';

echo $xml;
?>