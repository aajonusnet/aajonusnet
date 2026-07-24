<?php

declare(strict_types=1);

header(
    'Content-Type: application/json; charset=utf-8'
);

$textsRoot = realpath(
    __DIR__ . '/../texts'
);

if (
    $textsRoot === false ||
    !is_dir($textsRoot)
) {
    http_response_code(500);

    echo json_encode([
        'error' =>
            'The archive text directory was not found.',
    ]);

    exit;
}

$files = [];

$iterator =
    new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(
            $textsRoot,
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

    $relativePath = substr(
        $fileInfo->getPathname(),
        strlen($textsRoot) + 1
    );

    $relativePath = str_replace(
        '\\',
        '/',
        $relativePath
    );

    $files[] = [
        'path' =>
            'texts/' . $relativePath,

        'size' =>
            $fileInfo->getSize(),

        'modified' =>
            $fileInfo->getMTime(),
    ];
}

usort(
    $files,
    static fn(
        array $first,
        array $second
    ): int =>
        strcmp(
            $first['path'],
            $second['path']
        )
);

$signatureLines = [];

foreach ($files as $file) {
    $signatureLines[] =
        $file['path'] .
        ':' .
        $file['size'] .
        ':' .
        $file['modified'];
}

$signature = hash(
    'sha256',
    implode(
        "\n",
        $signatureLines
    )
);

$etag =
    '"' . $signature . '"';

header(
    'ETag: ' . $etag
);

header(
    'Cache-Control: public, max-age=300, stale-while-revalidate=86400'
);

header(
    'X-Archive-Record-Count: ' .
    count($files)
);

$ifNoneMatch = trim(
    $_SERVER[
        'HTTP_IF_NONE_MATCH'
    ] ?? ''
);

if ($ifNoneMatch === $etag) {
    http_response_code(304);
    exit;
}

$cacheDirectory =
    __DIR__ . '/.cache';

$cacheFile =
    $cacheDirectory .
    '/archive-metadata.json';

$signatureFile =
    $cacheDirectory .
    '/archive-metadata-signature.txt';

$json = null;
$cacheStatus = 'MISS';

if (
    is_file($cacheFile) &&
    is_file($signatureFile)
) {
    $cachedSignature =
        trim(
            (string) file_get_contents(
                $signatureFile
            )
        );

    if (
        hash_equals(
            $signature,
            $cachedSignature
        )
    ) {
        $cachedJson =
            file_get_contents(
                $cacheFile
            );

        if (is_string($cachedJson)) {
            $json =
                $cachedJson;

            $cacheStatus =
                'HIT';
        }
    }
}

if (!is_string($json)) {
    $metadata = [];

    foreach ($files as $file) {
        $metadata[
            $file['path']
        ] = '';
    }

    $json = json_encode(
        $metadata,
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

    if (!is_string($json)) {
        http_response_code(500);

        echo json_encode([
            'error' =>
                'Archive metadata generation failed.',
        ]);

        exit;
    }

    if (
        is_dir($cacheDirectory) ||
        @mkdir(
            $cacheDirectory,
            0775,
            true
        )
    ) {
        file_put_contents(
            $cacheFile,
            $json,
            LOCK_EX
        );

        file_put_contents(
            $signatureFile,
            $signature,
            LOCK_EX
        );
    }
}

header(
    'X-Archive-Cache: ' .
    $cacheStatus
);

header(
    'Content-Length: ' .
    strlen($json)
);

echo $json;
