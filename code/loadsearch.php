<?php

error_reporting(E_ERROR | E_PARSE);

if (ob_get_level()) {
    ob_end_clean();
}

require_once dirname(__DIR__) . '/config.php';

$mdPath = dirname(__DIR__) . '/' . $mdFolder;

$whiteSpaceList = ["\x09" => ' ', "\x0A" => ' ', "\x0B" => ' ', "\x0C" => ' ', "\x0D" => ' ', "\xC2\xA0" => ' '];
$contents = [];

$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdPath, FilesystemIterator::SKIP_DOTS));

foreach ($files as $fileInfo) {
    if (!$fileInfo->isFile()) continue;
    $ext = strtolower($fileInfo->getExtension());
    if ($ext !== 'md' && $ext !== 'txt') continue;
    $abs = $fileInfo->getPathname();
    $rel = $mdFolder . '/' . substr($abs, strlen($mdPath) + 1);
    $text = file_get_contents($abs);
    $text = strtr($text, $whiteSpaceList);
    $text = preg_replace('/ {2,}/', ' ', $text); // Avoid /u (slow)

    $contents[$rel] = trim($text);
}

$json = json_encode($contents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);

header('Content-Type: application/json');
header('X-Total-Uncompressed-Length: ' . strlen($json));

echo $json;