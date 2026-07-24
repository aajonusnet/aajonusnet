<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$root = realpath(__DIR__ . '/../texts');

if ($root === false) {
    http_response_code(500);

    echo json_encode([
        'error' => 'The texts folder was not found.'
    ]);

    exit;
}

function cleanArchiveText(string $text): string
{
    $text = preg_replace(
        '/```.*?```/s',
        ' ',
        $text
    ) ?? $text;

    $text = preg_replace(
        '/!\[[^\]]*\]\([^)]+\)/',
        ' ',
        $text
    ) ?? $text;

    $text = preg_replace(
        '/\[([^\]]+)\]\([^)]+\)/',
        '$1',
        $text
    ) ?? $text;

    $text = preg_replace(
        '/[#>*_`~]+/',
        ' ',
        $text
    ) ?? $text;

    $text = preg_replace(
        '/\s+/u',
        ' ',
        $text
    ) ?? $text;

    return trim($text);
}

function findTopics(string $text): array
{
    $topicNames = [
        'raw milk',
        'meat',
        'eggs',
        'digestion',
        'detoxification',
        'fasting',
        'disease',
        'farming',
        'workshop',
        'nutrition'
    ];

    $lowerText = mb_strtolower($text);
    $matches = [];

    foreach ($topicNames as $topic) {
        if (mb_strpos($lowerText, $topic) !== false) {
            $matches[] = $topic;
        }
    }

    return array_slice($matches, 0, 6);
}

$records = [];

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(
        $root,
        FilesystemIterator::SKIP_DOTS
    )
);

foreach ($iterator as $fileInfo) {
    if (!$fileInfo->isFile()) {
        continue;
    }

    $extension = strtolower(
        $fileInfo->getExtension()
    );

    if (
        $extension !== 'md' &&
        $extension !== 'txt'
    ) {
        continue;
    }

    $absolutePath = $fileInfo->getPathname();

    $relativePath = str_replace(
        '\\',
        '/',
        substr(
            $absolutePath,
            strlen($root) + 1
        )
    );

    $title = pathinfo(
        $relativePath,
        PATHINFO_FILENAME
    );

    $directory = str_replace(
        '\\',
        '/',
        dirname($relativePath)
    );

    $folders = $directory === '.'
        ? []
        : explode('/', $directory);

    $format = $folders[0] ?? 'Other';

    $source = count($folders) > 1
        ? implode(' / ', array_slice($folders, 1))
        : $format;

    $rawText = file_get_contents(
        $absolutePath
    );

    if ($rawText === false) {
        $rawText = '';
    }

    $plainText = cleanArchiveText($rawText);

    $snippet = mb_substr(
        $plainText,
        0,
        260
    );

    if (mb_strlen($plainText) > 260) {
        $snippet .= '…';
    }

    $year = 'Unknown';

    if (
        preg_match(
            '/\b(?:19|20)\d{2}\b/',
            $title . ' ' . mb_substr($plainText, 0, 500),
            $yearMatch
        )
    ) {
        $year = $yearMatch[0];
    }

    $topics = findTopics(
        $title . ' ' . $plainText
    );

    $records[] = [
        'id' => sha1($relativePath),
        'title' => $title,
        'date' => $year,
        'year' => $year,
        'format' => $format,
        'source' => $source,
        'status' => 'Not catalogued',
        'topics' => $topics,
        'note' => $snippet,
        'path' => $relativePath,
        'searchText' => mb_strtolower(
            $title . ' ' . $plainText
        )
    ];
}

usort(
    $records,
    function (array $first, array $second): int {
        $firstYear = ctype_digit($first['year'])
            ? (int) $first['year']
            : 0;

        $secondYear = ctype_digit($second['year'])
            ? (int) $second['year']
            : 0;

        if ($firstYear !== $secondYear) {
            return $secondYear <=> $firstYear;
        }

        return strcasecmp(
            $first['title'],
            $second['title']
        );
    }
);

echo json_encode(
    $records,
    JSON_UNESCAPED_UNICODE |
    JSON_UNESCAPED_SLASHES |
    JSON_INVALID_UTF8_SUBSTITUTE
);
