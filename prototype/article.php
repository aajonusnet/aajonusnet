<?php

declare(strict_types=1);

$textsRoot = realpath(
    __DIR__ . '/../texts'
);

$articlePath =
    $prototypeArticlePath ?? null;

$resolvedArticle =
    is_string($articlePath)
        ? realpath($articlePath)
        : false;

if (
    $textsRoot === false ||
    $resolvedArticle === false ||
    !str_starts_with(
        $resolvedArticle,
        $textsRoot .
            DIRECTORY_SEPARATOR
    ) ||
    !is_file($resolvedArticle)
) {
    http_response_code(404);

    exit('Article not found.');
}

$extension = strtolower(
    pathinfo(
        $resolvedArticle,
        PATHINFO_EXTENSION
    )
);

if (
    !in_array(
        $extension,
        ['md', 'txt'],
        true
    )
) {
    http_response_code(404);

    exit('Unsupported article type.');
}

function e(string $value): string
{
    return htmlspecialchars(
        $value,
        ENT_QUOTES |
        ENT_SUBSTITUTE,
        'UTF-8'
    );
}


if (!function_exists('mb_substr')) {
    function mb_substr(
        string $value,
        int $start,
        ?int $length = null,
        ?string $encoding = null
    ): string {
        return $length === null
            ? substr($value, $start)
            : substr($value, $start, $length);
    }
}

if (!function_exists('mb_strlen')) {
    function mb_strlen(
        string $value,
        ?string $encoding = null
    ): int {
        return strlen($value);
    }
}

function titleFromPath(
    string $path
): string {
    $title = pathinfo(
        $path,
        PATHINFO_FILENAME
    );

    $title = preg_replace(
        '/[_-]+/',
        ' ',
        $title
    ) ?? $title;

    return trim(
        preg_replace(
            '/\s+/',
            ' ',
            $title
        ) ?? $title
    );
}

function formatLabel(
    string $folder
): string {
    return match (
        strtolower($folder)
    ) {
        'books' => 'Book',
        'interviews' => 'Interview',
        'newsletters' => 'Newsletter',
        'q&a', 'qa' => 'Q&A',
        'videos' => 'Video',
        'misc' => 'Article',

        default =>
            $folder !== ''
                ? $folder
                : 'Archive record',
    };
}

function slugFromFilename(
    string $filename
): string {
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

    $value =
        is_string($ascii) &&
        $ascii !== ''
            ? $ascii
            : $value;

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

function encodedFileUrl(
    string $relativePath
): string {
    return '/' . implode(
        '/',
        array_map(
            'rawurlencode',
            explode(
                '/',
                $relativePath
            )
        )
    );
}


function safeMediaValue(
    string $value
): string {
    return trim(
        str_replace(
            ["\r", "\n", '"', "'"],
            '',
            $value
        )
    );
}

function archiveImagePath(
    string $value
): string {
    $value = trim($value);

    if (
        preg_match(
            '~^(?:https?:)?//|^/|^data:~i',
            $value
        )
    ) {
        return $value;
    }

    return '/imgs/' .
        ltrim(
            preg_replace(
                '~^\./~',
                '',
                $value
            ) ?? $value,
            '/'
        );
}

function preprocessArchiveMarkdown(
    string $content
): string {
    $content = preg_replace_callback(
        '~^\s*\[audio\]:\s*\(([^)]+)\)\s*$~mi',
        static function (array $match): string {
            $source = safeMediaValue(
                $match[1]
            );

            return '<audio controls preload="none" src="' .
                e($source) .
                '"></audio>';
        },
        $content
    ) ?? $content;

    $content = preg_replace_callback(
        '~^\s*\[video\]:\s*\(([^)]+)\)\s*$~mi',
        static function (array $match): string {
            $source = safeMediaValue(
                $match[1]
            );

            return '<video controls playsinline preload="none" src="' .
                e($source) .
                '"></video>';
        },
        $content
    ) ?? $content;

    $content = preg_replace_callback(
        '~!\[\[(.*?)\s*\|\s*(\d+)\]\]~',
        static function (array $match): string {
            $name = trim($match[1]);
            $width = max(
                1,
                min(
                    2400,
                    (int) $match[2]
                )
            );

            return '<img src="' .
                e(archiveImagePath($name)) .
                '" alt="' .
                e($name) .
                '" width="' .
                $width .
                '">';
        },
        $content
    ) ?? $content;

    $content = preg_replace_callback(
        '~!\[\[(.*?)\]\]~',
        static function (array $match): string {
            $name = trim($match[1]);

            return '![' .
                $name .
                '](' .
                archiveImagePath($name) .
                ' "' .
                str_replace('"', '', $name) .
                '")';
        },
        $content
    ) ?? $content;

    $content = preg_replace_callback(
        '~!\[([^\]]*)\]\(([^)\s]+)(?:\s+["\'][^"\']*["\'])?\)~',
        static function (array $match): string {
            return '![' .
                $match[1] .
                '](' .
                archiveImagePath($match[2]) .
                ')';
        },
        $content
    ) ?? $content;

    return $content;
}

function archiveMetaDescription(
    string $content,
    int $limit = 170
): string {
    $plain = preg_replace(
        [
            '~```[\s\S]*?```~',
            '~^\s*\[(?:audio|video)\]:\s*\([^)]+\)\s*$~mi',
            '~!\[\[[^\]]+\]\]~',
            '~!\[[^\]]*\]\([^)]+\)~',
            '~\[([^\]]+)\]\([^)]+\)~',
            '~[#>*_`\~|]+~',
        ],
        [' ', ' ', ' ', ' ', '$1', ' '],
        $content
    ) ?? $content;

    $plain = trim(
        preg_replace(
            '~\s+~',
            ' ',
            strip_tags($plain)
        ) ?? ''
    );

    if ($plain === '') {
        return 'A record from the Aajonus Vonderplanitz Archive.';
    }

    if (mb_strlen($plain) <= $limit) {
        return $plain;
    }

    return rtrim(
        mb_substr(
            $plain,
            0,
            $limit - 1
        )
    ) . '…';
}

function secureExternalLinks(
    string $html
): string {
    return preg_replace(
        '~<a\b(?![^>]*\btarget=)(?=[^>]*\bhref=["\']https?://)~i',
        '<a target="_blank" rel="noopener noreferrer"',
        $html
    ) ?? $html;
}

$rawText = file_get_contents(
    $resolvedArticle
);

if (!is_string($rawText)) {
    http_response_code(500);

    exit(
        'Article could not be read.'
    );
}

$relativePath = str_replace(
    '\\',
    '/',
    substr(
        $resolvedArticle,
        strlen($textsRoot) + 1
    )
);

$parts = explode(
    '/',
    $relativePath
);

$formatFolder =
    $parts[0] ?? '';

$sourceFolders =
    array_slice(
        $parts,
        1,
        -1
    );

$title =
    titleFromPath(
        $resolvedArticle
    );

$format =
    formatLabel(
        $formatFolder
    );

$source =
    $sourceFolders !== []
        ? implode(
            ' / ',
            $sourceFolders
        )
        : $formatFolder;

$date = 'Date unknown';

if (
    preg_match(
        '/\b(?:19|20)\d{2}\b/',
        $title . ' ' .
        mb_substr(
            $rawText,
            0,
            1200
        ),
        $dateMatch
    )
) {
    $date = $dateMatch[0];
}

$words = [];

preg_match_all(
    '/[\p{L}\p{N}\'’_-]+/u',
    strip_tags($rawText),
    $words
);

$wordCount =
    count(
        $words[0] ?? []
    );

$readingMinutes =
    max(
        1,
        (int) ceil(
            $wordCount / 220
        )
    );

$searchQuery =
    isset($_GET['search']) &&
    is_string($_GET['search'])
        ? trim($_GET['search'])
        : '';

$parsedownBase =
    __DIR__ .
    '/../code/Parsedown.php';

$parsedownExtra =
    __DIR__ .
    '/../code/ParsedownExtra.php';

if (!is_file($parsedownBase)) {
    http_response_code(500);

    exit(
        'Markdown renderer not found.'
    );
}

require_once $parsedownBase;

if (is_file($parsedownExtra)) {
    require_once $parsedownExtra;
}

$parserClass =
    class_exists(
        'ParsedownExtra'
    )
        ? 'ParsedownExtra'
        : 'Parsedown';

$parser = new $parserClass();

$preparedText =
    preprocessArchiveMarkdown(
        $rawText
    );

$renderedContent =
    $extension === 'txt'
        ? '<p>' .
            nl2br(
                e($rawText)
            ) .
            '</p>'
        : $parser->text(
            $preparedText
        );

$renderedContent =
    secureExternalLinks(
        $renderedContent
    );

$rawFileUrl =
    encodedFileUrl(
        'texts/' .
        $relativePath
    );

$sourceLink = null;

if (
    preg_match(
        '/\[(?:@?Source|Source)\]\((https?:\/\/[^)]+)\)/i',
        $rawText,
        $sourceMatch
    )
) {
    $sourceLink =
        $sourceMatch[1];
}

function articleKeywords(
    string $text
): array {
    $tokens = preg_split(
        '/[^a-z0-9]+/',
        strtolower($text),
        -1,
        PREG_SPLIT_NO_EMPTY
    ) ?: [];

    $stopWords = array_fill_keys(
        [
            'aajonus',
            'vonderplanitz',
            'about',
            'after',
            'again',
            'also',
            'archive',
            'because',
            'being',
            'between',
            'could',
            'does',
            'from',
            'have',
            'into',
            'more',
            'only',
            'other',
            'over',
            'record',
            'should',
            'some',
            'than',
            'that',
            'their',
            'there',
            'these',
            'they',
            'this',
            'through',
            'very',
            'what',
            'when',
            'where',
            'which',
            'while',
            'with',
            'would',
            'your'
        ],
        true
    );

    $keywords = [];

    foreach ($tokens as $token) {
        if (
            strlen($token) < 3 ||
            isset($stopWords[$token])
        ) {
            continue;
        }

        $keywords[] = $token;
    }

    return array_values(
        array_unique($keywords)
    );
}

function articleTopics(
    string $text
): array {
    $lowerText = strtolower($text);

    $topicTerms = [
        'raw milk' => [
            'raw milk',
            'dairy',
            'milk'
        ],

        'meat' => [
            'raw meat',
            'meat',
            'beef'
        ],

        'eggs' => [
            'egg',
            'eggs'
        ],

        'digestion' => [
            'digestion',
            'digestive',
            'stomach'
        ],

        'detoxification' => [
            'detoxification',
            'detox',
            'toxins'
        ],

        'fasting' => [
            'fasting',
            'fasted'
        ],

        'disease' => [
            'disease',
            'illness'
        ],

        'farming' => [
            'farming',
            'farmer',
            'farm'
        ],

        'nutrition' => [
            'nutrition',
            'nutrient'
        ],

        'workshops' => [
            'workshop',
            'seminar'
        ]
    ];

    $matches = [];

    foreach (
        $topicTerms as
        $topic => $terms
    ) {
        foreach ($terms as $term) {
            if (
                str_contains(
                    $lowerText,
                    $term
                )
            ) {
                $matches[] = $topic;
                break;
            }
        }
    }

    return array_values(
        array_unique($matches)
    );
}

function readArticlePreview(
    string $path,
    int $maximumBytes = 7000
): string {
    $handle = @fopen(
        $path,
        'rb'
    );

    if ($handle === false) {
        return '';
    }

    $preview = fread(
        $handle,
        $maximumBytes
    );

    fclose($handle);

    return is_string($preview)
        ? $preview
        : '';
}

$currentSearchSample =
    $title . ' ' .
    mb_substr(
        $rawText,
        0,
        8000
    );

$currentKeywords =
    articleKeywords(
        $currentSearchSample
    );

$currentTitleKeywords =
    articleKeywords($title);

$currentTopics =
    articleTopics(
        $currentSearchSample
    );

$currentYearNumber =
    preg_match(
        '/^\d{4}$/',
        $date
    )
        ? (int) $date
        : null;

$relatedCandidates = [];

$allFiles =
    new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(
            $textsRoot,
            FilesystemIterator::SKIP_DOTS
        )
    );

foreach ($allFiles as $fileInfo) {
    if (
        !$fileInfo->isFile() ||
        $fileInfo->getPathname() ===
            $resolvedArticle
    ) {
        continue;
    }

    $candidateExtension =
        strtolower(
            $fileInfo->getExtension()
        );

    if (
        !in_array(
            $candidateExtension,
            ['md', 'txt'],
            true
        )
    ) {
        continue;
    }

    $candidatePath =
        $fileInfo->getPathname();

    $candidatePreview =
        readArticlePreview(
            $candidatePath
        );

    $candidateTitle =
        titleFromPath(
            $candidatePath
        );

    $candidateRelativePath =
        str_replace(
            '\\',
            '/',
            substr(
                $candidatePath,
                strlen($textsRoot) + 1
            )
        );

    $candidateParts =
        explode(
            '/',
            $candidateRelativePath
        );

    $candidateFormatFolder =
        $candidateParts[0] ?? '';

    $candidateSourceFolders =
        array_slice(
            $candidateParts,
            1,
            -1
        );

    $candidateSource =
        $candidateSourceFolders !== []
            ? implode(
                ' / ',
                $candidateSourceFolders
            )
            : $candidateFormatFolder;

    $candidateFormat =
        formatLabel(
            $candidateFormatFolder
        );

    $candidateSearchSample =
        $candidateTitle . ' ' .
        $candidatePreview;

    $candidateKeywords =
        articleKeywords(
            $candidateSearchSample
        );

    $candidateTitleKeywords =
        articleKeywords(
            $candidateTitle
        );

    $candidateTopics =
        articleTopics(
            $candidateSearchSample
        );

    $sharedKeywords =
        array_values(
            array_intersect(
                $currentKeywords,
                $candidateKeywords
            )
        );

    $sharedTitleKeywords =
        array_values(
            array_intersect(
                $currentTitleKeywords,
                $candidateTitleKeywords
            )
        );

    $sharedTopics =
        array_values(
            array_intersect(
                $currentTopics,
                $candidateTopics
            )
        );

    $candidateYear =
        'Date unknown';

    if (
        preg_match(
            '/\b(?:19|20)\d{2}\b/',
            $candidateSearchSample,
            $candidateYearMatch
        )
    ) {
        $candidateYear =
            $candidateYearMatch[0];
    }

    $candidateYearNumber =
        preg_match(
            '/^\d{4}$/',
            $candidateYear
        )
            ? (int) $candidateYear
            : null;

    $score = 0;
    $reasons = [];

    if (
        $candidateFormatFolder ===
        $formatFolder
    ) {
        $score += 30;
        $reasons[] =
            'Same collection';
    }

    if (
        $candidateSource ===
        $source
    ) {
        $score += 22;
        $reasons[] =
            'Same source';
    }

    if ($sharedTopics !== []) {
        $score +=
            count($sharedTopics) *
            34;

        $reasons[] =
            'Shared topics: ' .
            implode(
                ', ',
                array_slice(
                    $sharedTopics,
                    0,
                    2
                )
            );
    }

    if (
        $sharedTitleKeywords !== []
    ) {
        $score +=
            min(
                count(
                    $sharedTitleKeywords
                ),
                4
            ) * 18;
    }

    if ($sharedKeywords !== []) {
        $score +=
            min(
                count(
                    $sharedKeywords
                ),
                8
            ) * 5;
    }

    if (
        $currentYearNumber !== null &&
        $candidateYearNumber !== null
    ) {
        $yearDistance = abs(
            $currentYearNumber -
            $candidateYearNumber
        );

        if ($yearDistance === 0) {
            $score += 14;
            $reasons[] =
                'Same year';
        } elseif ($yearDistance <= 2) {
            $score += 8;
        } elseif ($yearDistance <= 5) {
            $score += 3;
        }
    }

    if ($score <= 0) {
        continue;
    }

    $relatedCandidates[] = [
        'title' =>
            $candidateTitle,

        'url' =>
            '/' .
            slugFromFilename(
                $fileInfo->getFilename()
            ),

        'format' =>
            $candidateFormat,

        'year' =>
            $candidateYear,

        'score' =>
            $score,

        'reason' =>
            $reasons !== []
                ? implode(
                    ' · ',
                    array_slice(
                        array_unique(
                            $reasons
                        ),
                        0,
                        2
                    )
                )
                : 'Related archive record',
    ];
}

usort(
    $relatedCandidates,
    static function (
        array $first,
        array $second
    ): int {
        if (
            $first['score'] !==
            $second['score']
        ) {
            return
                $second['score'] <=>
                $first['score'];
        }

        return strcasecmp(
            $first['title'],
            $second['title']
        );
    }
);

$related =
    array_slice(
        $relatedCandidates,
        0,
        6
    );

$metaDescription =
    archiveMetaDescription(
        $rawText
    );

$requestPath =
    parse_url(
        $_SERVER['REQUEST_URI'] ?? '',
        PHP_URL_PATH
    );

if (
    !is_string($requestPath) ||
    $requestPath === ''
) {
    $requestPath =
        '/' . slugFromFilename(
            basename($relativePath)
        );
}

$isHttps =
    isset($_SERVER['HTTPS']) &&
    $_SERVER['HTTPS'] !== '' &&
    strtolower((string) $_SERVER['HTTPS']) !== 'off';

$scheme =
    $isHttps
        ? 'https'
        : 'http';

$host =
    isset($_SERVER['HTTP_HOST'])
        ? preg_replace(
            '/[^A-Za-z0-9.\-:\[\]]/',
            '',
            (string) $_SERVER['HTTP_HOST']
        )
        : '';

$canonicalUrl =
    is_string($host) &&
    $host !== ''
        ? $scheme . '://' .
            $host .
            $requestPath
        : $requestPath;

$socialImageUrl =
    is_string($host) &&
    $host !== ''
        ? $scheme . '://' .
            $host .
            '/logos/large-logo.jpg'
        : '/logos/large-logo.jpg';

$citation = sprintf(
    '%s. “%s.” ' .
    'The Aajonus Vonderplanitz Archive, ' .
    '%s. %s',

    $format,
    $title,
    $date,
    $rawFileUrl
);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1"
>

<title>
    <?= e($title) ?>
    |
    The Aajonus Vonderplanitz Archive
</title>

<meta name="description" content="<?= e($metaDescription) ?>">
<meta name="theme-color" content="#f5f0e5">
<script>
(() => {
    try {
        const saved = localStorage.getItem("aajonusDisplayModeV1");
        document.documentElement.dataset.displayMode =
            saved === "earthlight" ? "earthlight" : "archive";
    } catch {
        document.documentElement.dataset.displayMode = "archive";
    }
})();
</script>
<link rel="canonical" href="<?= e($canonicalUrl) ?>">
<link rel="icon" href="/logos/favicon.ico" type="image/x-icon" sizes="any">
<link rel="apple-touch-icon" href="/logos/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<link rel="sitemap" type="application/xml" href="/prototype/sitemap.php">
<meta property="og:type" content="article">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($metaDescription) ?>">
<meta property="og:url" content="<?= e($canonicalUrl) ?>">
<meta property="og:site_name" content="The Aajonus Vonderplanitz Archive">
<meta property="og:image" content="<?= e($socialImageUrl) ?>">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="<?= e($title) ?>">
<meta name="twitter:description" content="<?= e($metaDescription) ?>">
<meta name="twitter:image" content="<?= e($socialImageUrl) ?>">
<meta name="format-detection" content="telephone=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">

<style>
:root {
    --ink: #27231f;
    --muted: #70685e;
    --paper: #f5f0e5;
    --sheet: #fffdf7;
    --line: #cfc5b4;
    --line2: #9d9384;
    --rust: #9f3d2e;
    --mark: #f1d97a;
}

* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    margin: 0;

    background:
        repeating-linear-gradient(
            0deg,
            transparent 0 3px,
            rgba(66, 51, 33, 0.018)
                3px 4px
        ),
        var(--paper);

    color: var(--ink);

    font-family:
        Arial,
        Helvetica,
        sans-serif;
}

a {
    color: inherit;
}

.site-header {
    position: sticky;
    top: 0;
    z-index: 20;

    border-bottom:
        1px solid var(--line);

    background:
        rgba(
            245,
            240,
            229,
            0.95
        );

    backdrop-filter: blur(12px);
}

.header-inner {
    display: flex;
    max-width: 1260px;

    align-items: center;
    justify-content: space-between;

    gap: 20px;
    margin: auto;
    padding: 15px 28px;
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;

    text-decoration: none;
}

.brand-seal {
    display: grid;

    width: 40px;
    height: 40px;

    place-items: center;

    border:
        1px solid var(--ink);

    border-radius: 50%;

    font:
        700 16px Georgia,
        serif;
}

.brand strong {
    display: block;

    font:
        700 16px Georgia,
        serif;
}

.brand small {
    display: block;

    margin-top: 3px;

    color: var(--muted);

    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.back-link,
.button {
    padding: 10px 12px;

    border:
        1px solid var(--ink);

    background: transparent;
    color: var(--ink);

    cursor: pointer;

    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;

    text-decoration: none;
    text-transform: uppercase;
}

.back-link:hover,
.button:hover {
    background: var(--ink);
    color: var(--sheet);
}

.page {
    max-width: 1260px;

    margin: auto;
    padding: 48px 28px 70px;
}

.article-header {
    max-width: 980px;

    padding-bottom: 32px;

    border-bottom:
        1px solid var(--ink);
}

.kicker {
    margin: 0 0 12px;

    color: var(--rust);

    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.15em;

    text-transform: uppercase;
}

h1,
h2,
h3 {
    font-family:
        Georgia,
        "Times New Roman",
        serif;
}

h1 {
    max-width: 940px;

    margin: 0;

    font-size:
        clamp(
            42px,
            6vw,
            78px
        );

    font-weight: 500;
    line-height: 0.98;
    letter-spacing: -0.045em;
}

.deck {
    max-width: 760px;

    margin: 20px 0 0;

    color: var(--muted);

    font:
        18px/1.55 Georgia,
        serif;
}

.metadata {
    display: flex;
    flex-wrap: wrap;

    gap: 8px 18px;

    margin: 24px 0 0;
    padding: 0;

    list-style: none;

    color: var(--muted);

    font-size: 10px;
    letter-spacing: 0.08em;

    text-transform: uppercase;
}

.metadata strong {
    color: var(--ink);
}

.tools {
    display: grid;

    grid-template-columns:
        minmax(0, 1fr)
        auto
        auto;

    gap: 8px;

    margin-top: 24px;
}

.tools input {
    min-width: 0;

    padding: 12px;

    border:
        1px solid var(--line2);

    border-radius: 0;

    background: var(--sheet);

    outline: none;
}

.search-count {
    margin: 8px 0 0;

    color: var(--muted);

    font-size: 11px;
}

.layout {
    display: grid;

    grid-template-columns:
        210px
        minmax(0, 740px)
        230px;

    align-items: start;
    justify-content: space-between;

    gap: 40px;

    margin-top: 38px;
}

.rail {
    position: sticky;
    top: 90px;
}

.rail-title {
    margin: 0 0 12px;

    color: var(--muted);

    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.13em;

    text-transform: uppercase;
}

.toc {
    margin: 0;
    padding: 0;

    border-top:
        1px solid var(--ink);

    list-style: none;
}

.toc a {
    display: block;

    padding: 10px 2px;

    border-bottom:
        1px solid var(--line);

    color: var(--muted);

    font-size: 12px;
    line-height: 1.35;

    text-decoration: none;
}

.toc a:hover {
    color: var(--rust);
}

.toc .level-3 {
    padding-left: 14px;

    font-size: 11px;
}

.body {
    min-width: 0;

    font:
        18px/1.72 Georgia,
        "Times New Roman",
        serif;
}

.body > :first-child {
    margin-top: 0;
}

.body p {
    margin:
        0 0 1.25em;
}

.body h2 {
    margin:
        2.2em 0 0.7em;

    font-size: 34px;
    font-weight: 500;
    line-height: 1.08;
}

.body h3 {
    margin:
        1.8em 0 0.6em;

    font-size: 25px;
    font-weight: 500;
}

.body a {
    color: var(--rust);

    text-underline-offset: 3px;
}

.body blockquote {
    margin: 1.7em 0;
    padding-left: 20px;

    border-left:
        3px solid var(--rust);

    color: #514a42;
}

.body img,
.body video {
    max-width: 100%;
    height: auto;
}

.body audio {
    width: 100%;
}

.speaker {
    display: inline-block;

    margin-right: 7px;

    color: var(--rust);

    font-family:
        Arial,
        sans-serif;

    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;

    text-transform: uppercase;
}

mark.hit {
    padding: 0 2px;

    background: var(--mark);
}

mark.hit.current {
    outline:
        2px solid var(--rust);
}

.record {
    padding: 17px;

    border:
        1px solid var(--line2);

    background:
        rgba(
            255,
            253,
            247,
            0.6
        );
}

.record dl {
    margin: 0;
}

.row {
    padding: 9px 0;

    border-bottom:
        1px dotted var(--line);
}

.row:last-child {
    border: 0;
}

.row dt {
    color: var(--muted);

    font-size: 9px;
    letter-spacing: 0.1em;

    text-transform: uppercase;
}

.row dd {
    margin: 5px 0 0;

    font:
        14px/1.4 Georgia,
        serif;

    overflow-wrap: anywhere;
}

.actions {
    display: grid;

    gap: 8px;

    margin-top: 12px;
}

.actions a,
.actions button {
    display: block;

    width: 100%;

    text-align: center;
}

.related {
    max-width: 980px;

    margin-top: 65px;
    padding-top: 26px;

    border-top:
        1px solid var(--ink);
}

.related h2 {
    margin: 0 0 17px;

    font-size: 32px;
    font-weight: 500;
}

.related-grid {
    display: grid;

    grid-template-columns:
        repeat(
            2,
            minmax(0, 1fr)
        );

    border-top:
        1px solid var(--ink);

    border-left:
        1px solid var(--ink);
}

.related-item {
    min-height: 120px;

    padding: 18px;

    border-right:
        1px solid var(--ink);

    border-bottom:
        1px solid var(--ink);

    background:
        rgba(
            255,
            253,
            247,
            0.55
        );

    text-decoration: none;
}

.related-item small {
    color: var(--rust);

    font-size: 9px;
    letter-spacing: 0.1em;

    text-transform: uppercase;
}

.related-item strong {
    display: block;

    margin-top: 18px;

    font:
        20px/1.15 Georgia,
        serif;
}

.related-item:hover {
    background: var(--sheet);
}


.related-reason {
    display: block;
    margin-top: 12px;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.45;
}

@media (max-width: 1080px) {
    .layout {
        grid-template-columns:
            minmax(0, 740px)
            230px;
    }

    .toc-rail {
        display: none;
    }
}

@media (max-width: 780px) {
    .header-inner,
    .page {
        padding-left: 16px;
        padding-right: 16px;
    }

    .brand small {
        display: none;
    }

    .layout {
        grid-template-columns: 1fr;
    }

    .record-rail {
        position: static;
        order: -1;
    }

    .tools {
        grid-template-columns:
            1fr 1fr;
    }

    .tools input {
        grid-column:
            1 / -1;
    }

    .related-grid {
        grid-template-columns: 1fr;
    }
}
/* Full-width reading layout override */

.page {
    width: min(100%, 1500px);
    max-width: none;
    padding: 42px 42px 80px;
}

.article-header {
    width: min(100%, 1180px);
    max-width: none;
    margin: 0 auto;
}

.article-header h1 {
    max-width: 1120px;
    font-size: clamp(48px, 6vw, 88px);
    line-height: 0.98;
}

.deck {
    max-width: 900px;
    font-size: 21px;
    line-height: 1.6;
}

.metadata {
    font-size: 11px;
}

.tools {
    width: min(100%, 900px);
}

.layout {
    display: flex;
    width: min(100%, 1180px);
    max-width: none;
    flex-direction: column;
    gap: 36px;
    margin: 46px auto 0;
}

.toc-rail {
    display: none;
}

.body {
    width: 100%;
    max-width: none;
    min-width: 0;
    font-size: 22px;
    line-height: 1.78;
}

.body p {
    max-width: none;
    margin-bottom: 1.45em;
}

.body h2 {
    margin-top: 2.1em;
    font-size: 42px;
    line-height: 1.08;
}

.body h3 {
    margin-top: 1.8em;
    font-size: 31px;
    line-height: 1.15;
}

.body blockquote {
    margin: 2em 0;
    padding: 18px 26px;
    border-left: 4px solid var(--rust);
    background: rgba(255, 253, 247, 0.62);
    font-size: 21px;
}

.record-rail {
    position: static;
    width: 100%;
    order: 2;
}

.record {
    padding: 22px;
}

.record dl {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0 24px;
}

.row {
    min-width: 0;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.actions a,
.actions button {
    width: auto;
    min-width: 160px;
}

.related {
    width: min(100%, 1180px);
    max-width: none;
    margin-right: auto;
    margin-left: auto;
}

@media (max-width: 900px) {
    .page {
        padding: 30px 22px 60px;
    }

    .article-header h1 {
        font-size: clamp(42px, 10vw, 66px);
    }

    .body {
        font-size: 20px;
        line-height: 1.72;
    }

    .body h2 {
        font-size: 35px;
    }

    .body h3 {
        font-size: 27px;
    }

    .record dl {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 560px) {
    .page {
        padding: 24px 15px 50px;
    }

    .article-header h1 {
        font-size: 40px;
    }

    .deck {
        font-size: 18px;
    }

    .body {
        font-size: 19px;
        line-height: 1.7;
    }

    .tools {
        grid-template-columns: 1fr;
    }

    .tools input {
        grid-column: auto;
    }

    .record dl {
        grid-template-columns: 1fr;
    }

    .actions {
        display: grid;
    }

    .actions a,
    .actions button {
        width: 100%;
    }
}

/* SHAREABLE PASSAGE LINKS */

.linkable-block {
    position: relative;
    scroll-margin-top: 110px;
}

.passage-anchor {
    position: relative;
    top: auto;
    left: auto;

    display: inline-grid;
    width: 28px;
    height: 28px;
    place-items: center;

    margin-left: 9px;
    padding: 0;

    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);

    cursor: pointer;
    opacity: 0.45;
    vertical-align: middle;

    font:
        700 17px Georgia,
        serif;

    line-height: 1;
}

.linkable-block:hover
.passage-anchor,
.passage-anchor:focus {
    opacity: 1;
}

.passage-anchor:hover,
.passage-anchor:focus {
    border-color: var(--line2);
    background: var(--sheet);
    color: var(--rust);
    outline: none;
}

.linked-target {
    border-radius: 2px;

    outline:
        3px solid
        rgba(159, 61, 46, 0.30);

    outline-offset: 7px;

    background:
        rgba(241, 217, 122, 0.18);
}

@media (max-width: 700px) {
    .passage-anchor {
        position: relative;
        top: auto;
        left: auto;

        display: inline-grid;
        place-items: center;

        margin-left: 8px;

        opacity: 0.55;
        vertical-align: middle;
    }
}


/* RESULT SET NAVIGATION V2 */

.result-set-navigation {
    display: grid;

    width: min(100%, 1180px);

    grid-template-columns:
        minmax(0, 1fr)
        auto
        minmax(0, 1fr);

    gap: 12px;

    margin:
        26px auto 12px;
}

.result-set-link,
.result-set-position {
    min-width: 0;

    border:
        1px solid var(--line2);

    background:
        rgba(
            255,
            253,
            247,
            0.68
        );
}

.result-set-link {
    display: flex;

    min-height: 82px;

    flex-direction: column;
    justify-content: center;

    padding: 14px 17px;

    text-decoration: none;
}

.result-set-link.next {
    align-items: flex-end;
    text-align: right;
}

.result-set-link:hover {
    border-color: var(--ink);
    background: var(--sheet);
}

.result-set-direction {
    color: var(--rust);

    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;

    text-transform: uppercase;
}

.result-set-title {
    display: block;

    max-width: 100%;

    margin-top: 8px;

    overflow: hidden;

    font:
        18px/1.25 Georgia,
        "Times New Roman",
        serif;

    text-overflow: ellipsis;
    white-space: nowrap;
}

.result-set-position {
    display: grid;

    min-width: 145px;

    place-items: center;

    padding: 12px 18px;

    color: var(--muted);

    font-size: 11px;
    line-height: 1.4;

    text-align: center;
}

.result-set-position strong {
    display: block;

    margin-bottom: 5px;

    color: var(--ink);

    font:
        22px/1 Georgia,
        "Times New Roman",
        serif;
}

.result-set-placeholder {
    min-height: 82px;
}

@media (max-width: 760px) {
    .result-set-navigation {
        grid-template-columns:
            1fr 1fr;
    }

    .result-set-position {
        grid-column:
            1 / -1;

        grid-row: 1;
    }

    .result-set-title {
        font-size: 16px;
        white-space: normal;
    }
}

</style>
<link rel="stylesheet" href="/prototype/reading-progress.css">
<link rel="stylesheet" href="/prototype/saved-records.css">
<link rel="stylesheet" href="/prototype/article-notes.css">
<link rel="stylesheet" href="/prototype/archive-enhancements.css">
<link rel="stylesheet" href="/prototype/earthlight-mode.css">
</head>

<body>

<header class="site-header">
<div class="header-inner">

<a
    class="brand"
    href="/prototype/"
>
    <span class="brand-seal">
        AV
    </span>

    <span>
        <strong>
            The Aajonus Vonderplanitz Archive
        </strong>

        <small>
            Transcripts, recordings,
            books, and source material
        </small>
    </span>
</a>

<div class="article-header-actions">
    <div
        class="display-mode-switcher"
        role="group"
        aria-label="Display mode"
    >
        <button
            type="button"
            data-display-mode-choice="archive"
            aria-pressed="true"
        >Archive</button>
        <button
            type="button"
            data-display-mode-choice="earthlight"
            aria-pressed="false"
        >Earthlight</button>
    </div>

    <a
        id="backLink"
        class="back-link"
        href="/prototype/"
    >
        Back to archive
    </a>
</div>

</div>
</header>

<main class="page">

<header class="article-header">

<p class="kicker">
    <?= e($format) ?>
    ·
    <?= e($source) ?>
</p>

<h1>
    <?= e($title) ?>
</h1>

<p class="deck">
    An archived record presented in a
    research-focused reading view with
    source details, navigation, and
    local text search.
</p>

<ul class="metadata">

<li>
    <strong>Date:</strong>
    <?= e($date) ?>
</li>

<li>
    <strong>Format:</strong>
    <?= e($format) ?>
</li>

<li>
    <strong>Words:</strong>
    <?= number_format($wordCount) ?>
</li>

<li>
    <strong>Reading time:</strong>
    <?= $readingMinutes ?> min
</li>

<li>
    <strong>Status:</strong>
    Uncatalogued
</li>

</ul>

<div class="tools">

<input
    id="articleSearch"
    type="search"
    value="<?= e($searchQuery) ?>"
    placeholder="Search within this record"
>

<button
    id="previousMatch"
    class="button"
    type="button"
>
    Previous
</button>

<button
    id="nextMatch"
    class="button"
    type="button"
>
    Next
</button>

</div>

<p
    id="searchCount"
    class="search-count"
>
    Search within this record.
</p>

</header>

<div class="layout">

<aside class="rail toc-rail">

<p class="rail-title">
    On this page
</p>

<ol
    id="toc"
    class="toc"
></ol>

</aside>

<article
    id="articleBody"
    class="body"
>
    <?= $renderedContent ?>
</article>

<aside class="rail record-rail">

<p class="rail-title">
    Archive record
</p>

<div class="record">

<dl>

<div class="row">
    <dt>Collection</dt>
    <dd><?= e($format) ?></dd>
</div>

<div class="row">
    <dt>Source folder</dt>
    <dd><?= e($source) ?></dd>
</div>

<div class="row">
    <dt>File</dt>
    <dd>
        <?= e(
            basename(
                $resolvedArticle
            )
        ) ?>
    </dd>
</div>

<div class="row">
    <dt>Transcript status</dt>
    <dd>Uncatalogued</dd>
</div>

</dl>

</div>

<div class="actions">

<?php if (is_string($sourceLink)): ?>

<a
    class="button"
    href="<?= e($sourceLink) ?>"
    target="_blank"
    rel="noopener"
>
    Original source
</a>

<?php endif; ?>

<a
    class="button"
    href="<?= e($rawFileUrl) ?>"
    target="_blank"
    rel="noopener"
>
    Open source file
</a>

<button
    id="copyCitation"
    class="button"
    type="button"
>
    Copy citation
</button>

</div>

</aside>

</div>

<?php if ($related !== []): ?>

<section class="related">

<p class="kicker">
    Connected records
</p>

<h2>
    More from this collection
</h2>

<div class="related-grid">

<?php foreach ($related as $item): ?>

<a
    class="related-item"
    href="<?= e($item['url']) ?>"
>
    <small>
        <?= e($item['format']) ?>

        <?php if ($item['year'] !== 'Date unknown'): ?>
            ·
            <?= e($item['year']) ?>
        <?php endif; ?>
    </small>

    <strong>
        <?= e($item['title']) ?>
    </strong>

    <span class="related-reason">
        <?= e($item['reason']) ?>
    </span>
</a>

<?php endforeach; ?>

</div>

</section>

<?php endif; ?>

</main>

<script>
window.ARTICLE_DATA = {
    search:
        <?= json_encode($searchQuery) ?>,

    citation:
        <?= json_encode($citation) ?>
};
</script>

<script>
(() => {
    const data =
        window.ARTICLE_DATA || {};

    const body =
        document.getElementById(
            "articleBody"
        );

    const toc =
        document.getElementById(
            "toc"
        );

    const input =
        document.getElementById(
            "articleSearch"
        );

    const count =
        document.getElementById(
            "searchCount"
        );

    let marks = [];
    let active = -1;

    const slug = value =>
        value
            .toLowerCase()
            .normalize("NFKD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            );

    [
        ...body.querySelectorAll(
            "h2, h3"
        )
    ].forEach(
        (heading, index) => {
            heading.id =
                heading.id ||
                `${
                    slug(
                        heading.textContent
                    ) ||
                    "section"
                }-${index + 1}`;

            const item =
                document.createElement(
                    "li"
                );

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                `#${heading.id}`;

            link.textContent =
                heading.textContent.trim();

            if (
                heading.tagName ===
                "H3"
            ) {
                link.className =
                    "level-3";
            }

            item.append(link);
            toc.append(item);
        }
    );

    if (!toc.children.length) {
        toc.closest(
            "aside"
        ).hidden = true;
    }

    const speakerPattern =
        /^(Aajonus|Question|Q|Interviewer|Host|Caller|Audience|Participant)(\s*[:\-])\s*/i;

    body.querySelectorAll(
        "p"
    ).forEach(paragraph => {
        const firstNode =
            paragraph.firstChild;

        if (
            !firstNode ||
            firstNode.nodeType !==
                Node.TEXT_NODE
        ) {
            return;
        }

        const match =
            firstNode.nodeValue.match(
                speakerPattern
            );

        if (!match) {
            return;
        }

        const label =
            document.createElement(
                "span"
            );

        label.className =
            "speaker";

        label.textContent =
            match[1];

        firstNode.nodeValue =
            firstNode.nodeValue.slice(
                match[0].length
            );

        paragraph.insertBefore(
            label,
            firstNode
        );
    });

    function clearMarks() {
        body.querySelectorAll(
            "mark.hit"
        ).forEach(mark => {
            mark.replaceWith(
                document.createTextNode(
                    mark.textContent
                )
            );
        });

        body.normalize();

        marks = [];
        active = -1;
    }

    function textNodes() {
        const walker =
            document.createTreeWalker(
                body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode(node) {
                        const parent =
                            node.parentElement;

                        if (
                            !parent ||
                            !node.nodeValue.trim()
                        ) {
                            return NodeFilter
                                .FILTER_REJECT;
                        }

                        if (
                            parent.closest(
                                "script, style, mark"
                            )
                        ) {
                            return NodeFilter
                                .FILTER_REJECT;
                        }

                        return NodeFilter
                            .FILTER_ACCEPT;
                    }
                }
            );

        const nodes = [];
        let node;

        while (
            (
                node =
                    walker.nextNode()
            )
        ) {
            nodes.push(node);
        }

        return nodes;
    }

    function showMatch(index) {
        if (!marks.length) {
            return;
        }

        marks.forEach(mark =>
            mark.classList.remove(
                "current"
            )
        );

        active =
            (
                index +
                marks.length
            ) %
            marks.length;

        marks[active]
            .classList
            .add("current");

        marks[active]
            .scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

        count.textContent =
            `Match ${
                active + 1
            } of ${
                marks.length
            }.`;
    }

    function markQuery(term) {
        clearMarks();

        term = term.trim();

        if (!term) {
            count.textContent =
                "Search within this record.";

            return;
        }

        const escaped =
            term.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const expression =
            new RegExp(
                escaped,
                "gi"
            );

        textNodes().forEach(
            textNode => {
                const text =
                    textNode.nodeValue;

                const matches = [
                    ...text.matchAll(
                        expression
                    )
                ];

                if (!matches.length) {
                    return;
                }

                const fragment =
                    document
                        .createDocumentFragment();

                let position = 0;

                matches.forEach(
                    match => {
                        fragment.append(
                            text.slice(
                                position,
                                match.index
                            )
                        );

                        const mark =
                            document
                                .createElement(
                                    "mark"
                                );

                        mark.className =
                            "hit";

                        mark.textContent =
                            match[0];

                        fragment.append(
                            mark
                        );

                        position =
                            match.index +
                            match[0].length;
                    }
                );

                fragment.append(
                    text.slice(
                        position
                    )
                );

                textNode.replaceWith(
                    fragment
                );
            }
        );

        marks = [
            ...body.querySelectorAll(
                "mark.hit"
            )
        ];

        count.textContent =
            `${marks.length} ${
                marks.length === 1
                    ? "match"
                    : "matches"
            } in this record.`;

        if (marks.length) {
            showMatch(0);
        }
    }

    let timer;

    input.addEventListener(
        "input",
        () => {
            clearTimeout(timer);

            timer = setTimeout(
                () =>
                    markQuery(
                        input.value
                    ),
                180
            );
        }
    );

    input.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();

                markQuery(
                    input.value
                );
            }
        }
    );

    document
        .getElementById(
            "previousMatch"
        )
        .onclick =
            () =>
                showMatch(
                    active - 1
                );

    document
        .getElementById(
            "nextMatch"
        )
        .onclick =
            () =>
                showMatch(
                    active + 1
                );

    document
        .getElementById(
            "copyCitation"
        )
        .onclick =
            async event => {
                try {
                    await navigator
                        .clipboard
                        .writeText(
                            data.citation ||
                            ""
                        );

                    event.target
                        .textContent =
                            "Citation copied";
                } catch {
                    event.target
                        .textContent =
                            "Copy failed";
                }

                setTimeout(
                    () =>
                        event.target
                            .textContent =
                                "Copy citation",
                    1600
                );
            };

    document
        .getElementById(
            "backLink"
        )
        .onclick =
            event => {
                if (
                    history.length > 1
                ) {
                    event.preventDefault();

                    history.back();
                }
            };

    if (
        (
            data.search ||
            ""
        ).trim()
    ) {
        setTimeout(
            () =>
                markQuery(
                    data.search
                ),
            120
        );
    }
})();
</script>


<script>
/* SHAREABLE_PASSAGE_LINKS */

(() => {
    const article =
        document.getElementById(
            "articleBody"
        );

    if (!article) {
        return;
    }

    const blocks = [
        ...article.querySelectorAll(
            "p, li, h2, h3"
        )
    ].filter(block => {
        return (
            block.textContent
                .trim()
                .length > 2
        );
    });

    blocks.forEach(
        (block, index) => {
            const number =
                index + 1;

            const hasSpeaker =
                Boolean(
                    block.querySelector(
                        ".speaker"
                    )
                );

            if (!block.id) {
                block.id =
                    hasSpeaker
                        ? `question-${number}`
                        : `passage-${number}`;
            }

            block.classList.add(
                "linkable-block"
            );

            if (
                block.querySelector(
                    ".passage-anchor"
                )
            ) {
                return;
            }

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "passage-anchor";

            button.textContent =
                "¶";

            button.title =
                "Copy a link to this passage";

            button.setAttribute(
                "aria-label",
                "Copy a link to this passage"
            );

            button.addEventListener(
                "click",
                async event => {
                    event.preventDefault();

                    const newUrl =
                        new URL(
                            window.location.href
                        );

                    newUrl.hash =
                        block.id;

                    history.replaceState(
                        null,
                        "",
                        newUrl
                    );

                    document
                        .querySelectorAll(
                            ".linked-target"
                        )
                        .forEach(item => {
                            item.classList.remove(
                                "linked-target"
                            );
                        });

                    block.classList.add(
                        "linked-target"
                    );

                    try {
                        await navigator
                            .clipboard
                            .writeText(
                                newUrl.toString()
                            );

                        button.textContent =
                            "✓";

                        button.title =
                            "Link copied";
                    } catch {
                        button.textContent =
                            "!";
                    }

                    setTimeout(
                        () => {
                            button.textContent =
                                "¶";

                            button.title =
                                "Copy a link to this passage";
                        },
                        1400
                    );
                }
            );

            block.appendChild(
                button
            );
        }
    );

    function openLinkedPassage() {
        document
            .querySelectorAll(
                ".linked-target"
            )
            .forEach(item => {
                item.classList.remove(
                    "linked-target"
                );
            });

        const rawHash =
            window.location.hash
                .slice(1);

        if (!rawHash) {
            return;
        }

        let identifier;

        try {
            identifier =
                decodeURIComponent(
                    rawHash
                );
        } catch {
            identifier =
                rawHash;
        }

        const target =
            document.getElementById(
                identifier
            );

        if (!target) {
            return;
        }

        target.classList.add(
            "linked-target"
        );

        setTimeout(
            () => {
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            },
            160
        );
    }

    window.addEventListener(
        "hashchange",
        openLinkedPassage
    );

    openLinkedPassage();
})();
</script>


<script>
/* RESULT_SET_NAVIGATION_V2 */

(() => {
    const storageKey =
        "aajonusArticleContextV1";

    const articleHeader =
        document.querySelector(
            ".article-header"
        );

    if (!articleHeader) {
        return;
    }

    let context = null;

    try {
        context =
            JSON.parse(
                sessionStorage.getItem(
                    storageKey
                ) || "null"
            );
    } catch {
        context = null;
    }

    if (
        !context ||
        !Array.isArray(
            context.items
        ) ||
        context.items.length < 2
    ) {
        return;
    }

    const normalizePath =
        value =>
            value
                .replace(
                    /\/+$/,
                    ""
                )
                .toLowerCase();

    const currentPath =
        normalizePath(
            window.location.pathname
        );

    const currentIndex =
        context.items.findIndex(
            item => {
                if (
                    !item ||
                    typeof item.url !==
                        "string"
                ) {
                    return false;
                }

                try {
                    const url =
                        new URL(
                            item.url,
                            window.location.href
                        );

                    return (
                        normalizePath(
                            url.pathname
                        ) ===
                        currentPath
                    );
                } catch {
                    return false;
                }
            }
        );

    if (currentIndex < 0) {
        return;
    }

    context.currentIndex =
        currentIndex;

    sessionStorage.setItem(
        storageKey,
        JSON.stringify(
            context
        )
    );

    const navigation =
        document.createElement(
            "nav"
        );

    navigation.className =
        "result-set-navigation";

    navigation.setAttribute(
        "aria-label",
        "Search result navigation"
    );

    function makeResultLink(
        item,
        direction,
        extraClass
    ) {
        if (!item) {
            const placeholder =
                document.createElement(
                    "div"
                );

            placeholder.className =
                "result-set-placeholder";

            return placeholder;
        }

        const link =
            document.createElement(
                "a"
            );

        link.className =
            `result-set-link ${extraClass}`;

        link.href =
            item.url;

        const directionLabel =
            document.createElement(
                "span"
            );

        directionLabel.className =
            "result-set-direction";

        directionLabel.textContent =
            direction;

        const title =
            document.createElement(
                "span"
            );

        title.className =
            "result-set-title";

        title.textContent =
            item.title;

        link.append(
            directionLabel,
            title
        );

        return link;
    }

    const previous =
        makeResultLink(
            context.items[
                currentIndex - 1
            ],
            "← Previous result",
            "previous"
        );

    const next =
        makeResultLink(
            context.items[
                currentIndex + 1
            ],
            "Next result →",
            "next"
        );

    const position =
        document.createElement(
            "div"
        );

    position.className =
        "result-set-position";

    const number =
        document.createElement(
            "strong"
        );

    number.textContent =
        `${currentIndex + 1} of ${context.items.length}`;

    const label =
        document.createElement(
            "span"
        );

    label.textContent =
        "search results";

    position.append(
        number,
        label
    );

    navigation.append(
        previous,
        position,
        next
    );

    articleHeader.insertAdjacentElement(
        "afterend",
        navigation
    );
})();
</script>

<script src="/prototype/display-mode.js"></script>
<script src="/prototype/reading-progress.js" defer></script>
<script src="/prototype/article-save.js" defer></script>
<script src="/prototype/article-notes.js" defer></script>
</body>
</html>