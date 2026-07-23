<?php

declare(strict_types=1);

const ARTICLE_ROUTE_CACHE_SECONDS = 300;

$requestPath = parse_url(
    $_SERVER['REQUEST_URI'] ?? '/',
    PHP_URL_PATH
);

if (!is_string($requestPath)) {
    $requestPath = '/';
}

$requestPath = rawurldecode(
    $requestPath
);

$documentRoot = __DIR__;
$candidatePath =
    $documentRoot . $requestPath;

$resolvedCandidate =
    realpath($candidatePath);

if (
    $requestPath !== '/' &&
    $resolvedCandidate !== false &&
    str_starts_with(
        $resolvedCandidate,
        $documentRoot
    ) &&
    (
        is_file($resolvedCandidate) ||
        is_dir($resolvedCandidate)
    )
) {
    return false;
}

function prototypeSlugify(
    string $value
): string {
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

function routeCacheIsFresh(
    string $cacheFile
): bool {
    if (!is_file($cacheFile)) {
        return false;
    }

    $modifiedTime =
        filemtime($cacheFile);

    if (!is_int($modifiedTime)) {
        return false;
    }

    return (
        time() - $modifiedTime
    ) < ARTICLE_ROUTE_CACHE_SECONDS;
}

function readRouteCache(
    string $cacheFile
): ?array {
    if (!is_file($cacheFile)) {
        return null;
    }

    $json =
        file_get_contents(
            $cacheFile
        );

    if (!is_string($json)) {
        return null;
    }

    $decoded =
        json_decode(
            $json,
            true
        );

    if (
        !is_array($decoded) ||
        !isset($decoded['routes']) ||
        !is_array($decoded['routes'])
    ) {
        return null;
    }

    return $decoded['routes'];
}

function buildArticleRouteIndex(
    string $textsRoot,
    string $cacheFile
): array {
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

        $extension =
            strtolower(
                $fileInfo->getExtension()
            );

        if (
            $extension !== 'md' &&
            $extension !== 'txt'
        ) {
            continue;
        }

        $files[] =
            $fileInfo->getPathname();
    }

    sort(
        $files,
        SORT_STRING
    );

    $routes = [];
    $duplicates = [];

    foreach ($files as $fullPath) {
        $filename =
            basename($fullPath);

        $slug =
            prototypeSlugify(
                $filename
            );

        if ($slug === '') {
            continue;
        }

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

        if (isset($routes[$slug])) {
            $duplicates[$slug][] =
                $relativePath;

            continue;
        }

        $routes[$slug] =
            $relativePath;
    }

    $cacheDirectory =
        dirname($cacheFile);

    if (
        is_dir($cacheDirectory) ||
        @mkdir(
            $cacheDirectory,
            0775,
            true
        )
    ) {
        $payload =
            json_encode(
                [
                    'generatedAt' =>
                        gmdate('c'),

                    'recordCount' =>
                        count($routes),

                    'routes' =>
                        $routes,

                    'duplicates' =>
                        $duplicates,
                ],
                JSON_UNESCAPED_UNICODE |
                JSON_UNESCAPED_SLASHES |
                JSON_PRETTY_PRINT
            );

        if (is_string($payload)) {
            $temporaryFile =
                $cacheFile .
                '.tmp-' .
                bin2hex(
                    random_bytes(4)
                );

            if (
                file_put_contents(
                    $temporaryFile,
                    $payload,
                    LOCK_EX
                ) !== false
            ) {
                @rename(
                    $temporaryFile,
                    $cacheFile
                );
            }
        }
    }

    return $routes;
}

function getArticleRouteIndex(
    string $textsRoot,
    string $cacheFile,
    bool $forceRebuild = false
): array {
    if (
        !$forceRebuild &&
        routeCacheIsFresh(
            $cacheFile
        )
    ) {
        $cachedRoutes =
            readRouteCache(
                $cacheFile
            );

        if (is_array($cachedRoutes)) {
            return $cachedRoutes;
        }
    }

    return buildArticleRouteIndex(
        $textsRoot,
        $cacheFile
    );
}

function resolveArticleFromSlug(
    string $textsRoot,
    string $cacheFile,
    string $slug
): ?string {
    if ($slug === '') {
        return null;
    }

    $routes =
        getArticleRouteIndex(
            $textsRoot,
            $cacheFile
        );

    $relativePath =
        $routes[$slug] ?? null;

    if (is_string($relativePath)) {
        $fullPath =
            realpath(
                $textsRoot .
                DIRECTORY_SEPARATOR .
                $relativePath
            );

        if (
            is_string($fullPath) &&
            is_file($fullPath) &&
            str_starts_with(
                $fullPath,
                $textsRoot .
                    DIRECTORY_SEPARATOR
            )
        ) {
            return $fullPath;
        }
    }

    /*
     * The cached map might be stale after
     * adding or renaming an archive file.
     * Rebuild once before returning no match.
     */
    $routes =
        getArticleRouteIndex(
            $textsRoot,
            $cacheFile,
            true
        );

    $relativePath =
        $routes[$slug] ?? null;

    if (!is_string($relativePath)) {
        return null;
    }

    $fullPath =
        realpath(
            $textsRoot .
            DIRECTORY_SEPARATOR .
            $relativePath
        );

    if (
        !is_string($fullPath) ||
        !is_file($fullPath) ||
        !str_starts_with(
            $fullPath,
            $textsRoot .
                DIRECTORY_SEPARATOR
        )
    ) {
        return null;
    }

    return $fullPath;
}

$segments =
    array_values(
        array_filter(
            explode(
                '/',
                trim(
                    $requestPath,
                    '/'
                )
            ),
            static fn(
                string $segment
            ): bool =>
                $segment !== ''
        )
    );

$requestedSlug =
    $segments === []
        ? ''
        : (string) end($segments);

$textsRoot =
    realpath(
        __DIR__ . '/texts'
    );

$routeCacheFile =
    __DIR__ .
    '/code/.cache/article-routes.json';

if (
    $textsRoot !== false &&
    $requestedSlug !== ''
) {
    $matchedArticle =
        resolveArticleFromSlug(
            $textsRoot,
            $routeCacheFile,
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