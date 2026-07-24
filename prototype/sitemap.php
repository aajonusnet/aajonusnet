<?php

declare(strict_types=1);

header('Content-Type: application/xml; charset=UTF-8');

function xmlValue(string $value): string
{
    return htmlspecialchars(
        $value,
        ENT_XML1 | ENT_QUOTES,
        'UTF-8'
    );
}

function archiveSlug(string $filename): string
{
    $value = preg_replace(
        '/\.(md|txt)$/i',
        '',
        $filename
    ) ?? $filename;

    $ascii = iconv(
        'UTF-8',
        'ASCII//TRANSLIT//IGNORE',
        $value
    );

    if (
        is_string($ascii) &&
        $ascii !== ''
    ) {
        $value = $ascii;
    }

    $value = preg_replace(
        '/[^a-zA-Z0-9\s]/',
        '',
        $value
    ) ?? $value;

    $value = preg_replace(
        '/\s+/',
        '-',
        trim($value)
    ) ?? $value;

    return strtolower(
        trim($value, '-')
    );
}

$isHttps =
    isset($_SERVER['HTTPS']) &&
    $_SERVER['HTTPS'] !== '' &&
    strtolower((string) $_SERVER['HTTPS']) !== 'off';

$scheme = $isHttps ? 'https' : 'http';

$host =
    isset($_SERVER['HTTP_HOST'])
        ? preg_replace(
            '/[^A-Za-z0-9.\-:\[\]]/',
            '',
            (string) $_SERVER['HTTP_HOST']
        )
        : '';

$origin =
    is_string($host) &&
    $host !== ''
        ? $scheme . '://' . $host
        : '';

$urls = [
    [
        'location' => $origin . '/prototype/',
        'modified' => null,
    ],
];

$textsRoot = realpath(
    __DIR__ . '/../texts'
);

if (
    $textsRoot !== false &&
    is_dir($textsRoot)
) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(
            $textsRoot,
            FilesystemIterator::SKIP_DOTS
        )
    );

    $seen = [];

    foreach ($iterator as $file) {
        if (!$file->isFile()) {
            continue;
        }

        $extension = strtolower(
            $file->getExtension()
        );

        if (
            $extension !== 'md' &&
            $extension !== 'txt'
        ) {
            continue;
        }

        $slug = archiveSlug(
            $file->getFilename()
        );

        if (
            $slug === '' ||
            isset($seen[$slug])
        ) {
            continue;
        }

        $seen[$slug] = true;

        $urls[] = [
            'location' =>
                $origin . '/' . $slug,
            'modified' =>
                date(
                    DATE_W3C,
                    $file->getMTime()
                ),
        ];
    }
}

echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
echo "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";

foreach ($urls as $url) {
    echo "  <url>\n";
    echo '    <loc>' .
        xmlValue($url['location']) .
        "</loc>\n";

    if (
        is_string($url['modified']) &&
        $url['modified'] !== ''
    ) {
        echo '    <lastmod>' .
            xmlValue($url['modified']) .
            "</lastmod>\n";
    }

    echo "  </url>\n";
}

echo "</urlset>\n";
