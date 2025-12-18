<?php
error_reporting(E_ERROR | E_PARSE);

if (ob_get_level()) {
    ob_end_clean();
}

$mdFolder = 'md';

$whiteSpaceList = ["\x09" => ' ', "\x0A" => ' ', "\x0B" => ' ', "\x0C" => ' ', "\x0D" => ' ', "\xC2\xA0" => ' '];
$contents = [];

$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS));

foreach ($files as $fileInfo) {
    if (!$fileInfo->isFile()) continue;
    $rel = $fileInfo->getPathname();
    $text = file_get_contents($rel);
    $text = strtr($text, $whiteSpaceList);
    $text = preg_replace('/ {2,}/', ' ', $text); // Avoid /u (slow)

    $contents[$rel] = trim($text);
}

$json = json_encode($contents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

header('Content-Type: application/json');
header('X-Total-Uncompressed-Length: ' . strlen($json));

echo $json;