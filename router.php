<?php

declare(strict_types=1);

$requestPath = parse_url(
    $_SERVER['REQUEST_URI'] ?? '/',
    PHP_URL_PATH
);

if (!is_string($requestPath)) {
    $requestPath = '/';
}

$requestPath = rawurldecode($requestPath);
$documentRoot = __DIR__;
$candidatePath = $documentRoot . $requestPath;
$resolvedCandidate = realpath($candidatePath);

if (
    $requestPath !== '/' &&
    $resolvedCandidate !== false &&
    str_starts_with($resolvedCandidate, $documentRoot) &&
    (
        is_file($resolvedCandidate) ||
        is_dir($resolvedCandidate)
    )
) {
    return false;
}

function prototypeSlugify(string $value): string
{
    $value = preg_replace(
        '/\.(md|txt)$/i',
        '',
        $value
    ) ?? $value;

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

function findPrototypeArticle(
    string $textsRoot,
    string $slug
): ?string {
    if (
        $slug === '' ||
        !is_dir($textsRoot)
    ) {
        return null;
    }

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

        if (
            prototypeSlugify(
                $fileInfo->getFilename()
            ) === $slug
        ) {
            return $fileInfo->getPathname();
        }
    }

    return null;
}

$segments = array_values(
    array_filter(
        explode(
            '/',
            trim($requestPath, '/')
        ),
        static fn(string $segment): bool =>
            $segment !== ''
    )
);

$requestedSlug = $segments === []
    ? ''
    : (string) end($segments);

$textsRoot = realpath(
    __DIR__ . '/texts'
);

if (
    $textsRoot !== false &&
    $requestedSlug !== ''
) {
    $matchedArticle =
        findPrototypeArticle(
            $textsRoot,
            $requestedSlug
        );

    if ($matchedArticle !== null) {
        $prototypeArticlePath =
            $matchedArticle;

        require __DIR__ .
            '/prototype/article.php';

        return true;
    }
}

require __DIR__ . '/index.php';