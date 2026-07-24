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

    $fullPath =
        $fileInfo->getPathname();

    $relativePath =
        substr(
            $fullPath,
            strlen($textsRoot) + 1
        );

    $relativePath =
        str_replace(
            '\\',
            '/',
            $relativePath
        );

    $files[] = [
        'fullPath' =>
            $fullPath,

        'relativePath' =>
            $relativePath,

        'modified' =>
            $fileInfo->getMTime(),

        'size' =>
            $fileInfo->getSize(),
    ];
}

usort(
    $files,
    static fn(
        array $first,
        array $second
    ): int =>
        strcmp(
            $first['relativePath'],
            $second['relativePath']
        )
);

$signatureParts = [];

foreach ($files as $file) {
    $signatureParts[] =
        $file['relativePath'] .
        ':' .
        $file['size'] .
        ':' .
        $file['modified'];
}

$signature = hash(
    'sha256',
    implode(
        "\n",
        $signatureParts
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
    'Vary: Accept-Encoding'
);

header(
    'X-Archive-Record-Count: ' .
    count($files)
);

$ifNoneMatch =
    trim(
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
    '/archive-search.json';

$metadataFile =
    $cacheDirectory .
    '/archive-search-meta.json';

$json = null;
$cacheStatus = 'MISS';

if (
    is_file($cacheFile) &&
    is_file($metadataFile)
) {
    $metadataText =
        file_get_contents(
            $metadataFile
        );

    $metadata =
        is_string($metadataText)
            ? json_decode(
                $metadataText,
                true
            )
            : null;

    if (
        is_array($metadata) &&
        ($metadata['signature'] ?? null) ===
            $signature
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
    $archive = [];

    foreach ($files as $file) {
        $content =
            file_get_contents(
                $file['fullPath']
            );

        if (!is_string($content)) {
            continue;
        }

        $archive[
            'texts/' .
            $file['relativePath']
        ] = $content;
    }

    $json =
        json_encode(
            $archive,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES |
            JSON_INVALID_UTF8_SUBSTITUTE
        );

    if (!is_string($json)) {
        http_response_code(500);

        echo json_encode([
            'error' =>
                'The archive search index could not be generated.',
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
        $temporaryCacheFile =
            $cacheFile .
            '.tmp-' .
            bin2hex(
                random_bytes(4)
            );

        if (
            file_put_contents(
                $temporaryCacheFile,
                $json,
                LOCK_EX
            ) !== false
        ) {
            @rename(
                $temporaryCacheFile,
                $cacheFile
            );
        }

        $metadataJson =
            json_encode([
                'signature' =>
                    $signature,

                'recordCount' =>
                    count($files),

                'generatedAt' =>
                    gmdate('c'),
            ]);

        if (
            is_string(
                $metadataJson
            )
        ) {
            file_put_contents(
                $metadataFile,
                $metadataJson,
                LOCK_EX
            );
        }
    }
}

header(
    'X-Archive-Cache: ' .
    $cacheStatus
);

header(
    'X-Total-Uncompressed-Length: ' .
    strlen($json)
);

$acceptEncoding =
    $_SERVER[
        'HTTP_ACCEPT_ENCODING'
    ] ?? '';

if (
    str_contains(
        $acceptEncoding,
        'gzip'
    ) &&
    function_exists(
        'gzencode'
    )
) {
    $compressed =
        gzencode(
            $json,
            6
        );

    if (is_string($compressed)) {
        header(
            'Content-Encoding: gzip'
        );

        header(
            'Content-Length: ' .
            strlen($compressed)
        );

        echo $compressed;
        exit;
    }
}

header(
    'Content-Length: ' .
    strlen($json)
);

echo $json;
