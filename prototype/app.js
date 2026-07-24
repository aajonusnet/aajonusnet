const CACHE_DB_NAME = "myDatabase";
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = "myData";
const CACHE_KEY = "allData";
const CACHE_REFRESH_HOURS = 24;
let archiveCacheLastCheckedAt = 0;

const state = {
    query: "",
    topic: "",
    format: "All",
    year: "All",
    source: "All",
    status: "All",
    exactPhraseOnly: false,
    page: 1,
    pageSize: 20
};

let records = [];
let searchTimer = null;
let searchDatabase = null;

const byId = id => document.getElementById(id);

const elements = {
    search: byId("searchInput"),
    submitSearch: byId("submitSearch"),
    clearSearch: byId("clearSearch"),
    feedback: byId("searchFeedback"),
    list: byId("recordList"),
    count: byId("resultsCount"),
    title: byId("resultsTitle"),
    empty: byId("emptyState"),
    load: byId("loadMore"),
    year: byId("yearFilter"),
    source: byId("sourceFilter"),
    status: byId("statusFilter"),
    archive: byId("archive"),
    filters: byId("filters"),
    clearFilters: byId("clearFilters"),
    mobileFilterButton: byId("mobileFilterButton"),
    exactPhraseToggle: null,
    pagination: null,
    paginationSummary: null,
    pageButtons: null,
    previousPage: null,
    nextPage: null
};

const FILTER_VISIBILITY_KEY =
    "aajonusFilterVisibilityV1";

function defaultFiltersOpen() {
    return window.matchMedia(
        "(min-width: 981px)"
    ).matches;
}

function readFiltersOpen() {
    try {
        const stored =
            localStorage.getItem(
                FILTER_VISIBILITY_KEY
            );

        if (stored === "open") {
            return true;
        }

        if (stored === "closed") {
            return false;
        }
    } catch (error) {
        console.warn(
            "Filter visibility preference could not be read.",
            error
        );
    }

    return defaultFiltersOpen();
}

function setFiltersOpen(
    isOpen,
    { persist = true } = {}
) {
    if (
        !elements.filters ||
        !elements.mobileFilterButton
    ) {
        return;
    }

    elements.filters.classList.toggle(
        "open",
        isOpen
    );

    elements.filters.setAttribute(
        "aria-hidden",
        String(!isOpen)
    );

    elements.mobileFilterButton.setAttribute(
        "aria-expanded",
        String(isOpen)
    );

    elements.mobileFilterButton.setAttribute(
        "aria-controls",
        "filters"
    );

    elements.mobileFilterButton.textContent =
        isOpen
            ? "Hide filters"
            : "Show filters";

    elements.archive?.classList.toggle(
        "filters-collapsed",
        !isOpen
    );

    document.documentElement.classList.toggle(
        "filters-collapsed",
        !isOpen
    );

    if (!persist) {
        return;
    }

    try {
        localStorage.setItem(
            FILTER_VISIBILITY_KEY,
            isOpen
                ? "open"
                : "closed"
        );
    } catch (error) {
        console.warn(
            "Filter visibility preference could not be saved.",
            error
        );
    }
}

function escapeHtml(value) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return String(value).replace(
        /[&<>"']/g,
        character => map[character]
    );
}

function injectPaginationStyles() {
    if (byId("archivePaginationStyles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "archivePaginationStyles";

    style.textContent = `
        #paginationControls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid var(--line);
        }

        .pagination-summary {
            color: var(--muted);
            font-size: 11px;
        }

        .pagination-buttons {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 6px;
        }

        .pagination-button {
            min-width: 38px;
            height: 36px;
            padding: 0 10px;
            border: 1px solid var(--line-dark);
            background: transparent;
            color: var(--ink);
            cursor: pointer;
            font-size: 11px;
        }

        .pagination-button:hover:not(:disabled),
        .pagination-button.active {
            border-color: var(--ink);
            background: var(--ink);
            color: var(--sheet);
        }

        .pagination-button:disabled {
            cursor: not-allowed;
            opacity: 0.38;
        }

        .pagination-ellipsis {
            min-width: 24px;
            color: var(--muted);
            text-align: center;
        }

        @media (max-width: 680px) {
            #paginationControls {
                align-items: flex-start;
                flex-direction: column;
            }

            .pagination-buttons {
                justify-content: flex-start;
            }
        }
    `;

    document.head.appendChild(style);
}

function ensurePaginationControls() {
    if (elements.pagination) {
        return;
    }

    injectPaginationStyles();

    const navigation =
        document.createElement("nav");

    navigation.id =
        "paginationControls";

    navigation.setAttribute(
        "aria-label",
        "Archive result pages"
    );

    const summary =
        document.createElement("span");

    summary.className =
        "pagination-summary";

    const buttons =
        document.createElement("div");

    buttons.className =
        "pagination-buttons";

    const previous =
        document.createElement("button");

    previous.className =
        "pagination-button";

    previous.type = "button";
    previous.textContent = "Previous";

    const pageButtons =
        document.createElement("span");

    pageButtons.className =
        "pagination-buttons";

    const next =
        document.createElement("button");

    next.className =
        "pagination-button";

    next.type = "button";
    next.textContent = "Next";

    buttons.append(
        previous,
        pageButtons,
        next
    );

    navigation.append(
        summary,
        buttons
    );

    if (elements.load) {
        elements.load.style.display =
            "none";

        elements.load
            .insertAdjacentElement(
                "afterend",
                navigation
            );
    } else if (elements.list) {
        elements.list
            .insertAdjacentElement(
                "afterend",
                navigation
            );
    }

    previous.addEventListener(
        "click",
        () => {
            goToPage(
                state.page - 1
            );
        }
    );

    next.addEventListener(
        "click",
        () => {
            goToPage(
                state.page + 1
            );
        }
    );

    elements.pagination =
        navigation;

    elements.paginationSummary =
        summary;

    elements.pageButtons =
        pageButtons;

    elements.previousPage =
        previous;

    elements.nextPage =
        next;
}

function ensureSearchModeControl() {
    if (elements.exactPhraseToggle) {
        return;
    }

    const statusRow =
        document.querySelector(
            ".search-status-row"
        );

    if (
        !statusRow ||
        !elements.clearSearch
    ) {
        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "exactPhraseToggle";

    button.className =
        "search-clear";

    button.type =
        "button";

    button.hidden =
        true;

    button.textContent =
        "Exact phrase only";

    statusRow.insertBefore(
        button,
        elements.clearSearch
    );

    button.addEventListener(
        "click",
        () => {
            state.exactPhraseOnly =
                !state.exactPhraseOnly;

            state.page = 1;

            render();
        }
    );

    elements.exactPhraseToggle =
        button;
}

function countOccurrences(
    text,
    term
) {
    if (!term) {
        return 0;
    }

    let count = 0;
    let position = 0;

    while (true) {
        position =
            text.indexOf(
                term,
                position
            );

        if (position === -1) {
            break;
        }

        count += 1;
        position += term.length;
    }

    return count;
}

function setLoading(message) {
    elements.search.disabled =
        true;

    elements.submitSearch.disabled =
        true;

    elements.search.placeholder =
        message;

    elements.feedback.textContent =
        message;

    elements.count.textContent =
        "Loading…";
}

function setReady() {
    elements.search.disabled =
        false;

    elements.submitSearch.disabled =
        false;

    elements.submitSearch.textContent =
        "Search";

    elements.search.placeholder =
        "Search transcripts, books, topics, and dates";
}

function setLoadError(error) {
    console.error(error);

    elements.search.disabled =
        false;

    elements.submitSearch.disabled =
        false;

    elements.submitSearch.textContent =
        "Retry";

    elements.feedback.textContent =
        "The archive failed to load. Click Retry.";

    elements.count.textContent =
        "Archive unavailable";
}

function openSearchDatabase() {
    return new Promise(
        (resolve, reject) => {
            const request =
                indexedDB.open(
                    CACHE_DB_NAME,
                    CACHE_DB_VERSION
                );

            request.onupgradeneeded =
                event => {
                    const database =
                        event.target.result;

                    if (
                        !database
                            .objectStoreNames
                            .contains(
                                CACHE_STORE_NAME
                            )
                    ) {
                        database
                            .createObjectStore(
                                CACHE_STORE_NAME,
                                {
                                    keyPath: "id"
                                }
                            );
                    }
                };

            request.onsuccess =
                event => {
                    resolve(
                        event.target.result
                    );
                };

            request.onerror =
                () => {
                    reject(
                        request.error ||
                        new Error(
                            "IndexedDB failed to open."
                        )
                    );
                };
        }
    );
}

async function requestPersistentArchiveStorage() {
    if (
        !navigator.storage ||
        typeof navigator.storage.persist !==
            "function"
    ) {
        return false;
    }

    try {
        return await navigator.storage.persist();
    } catch (error) {
        console.warn(
            "Persistent browser storage was not granted; the archive cache will still work normally.",
            error
        );

        return false;
    }
}

function readCachedArchive() {
    return new Promise(
        (resolve, reject) => {
            const transaction =
                searchDatabase
                    .transaction(
                        [
                            CACHE_STORE_NAME
                        ],
                        "readonly"
                    );

            const store =
                transaction
                    .objectStore(
                        CACHE_STORE_NAME
                    );

            const request =
                store.get(
                    CACHE_KEY
                );

            request.onsuccess =
                () => {
                    const cached =
                        request.result;

                    if (
                        cached &&
                        cached.content
                    ) {
                        archiveCacheLastCheckedAt =
                            Number(
                                cached.lastCheckedAt ||
                                cached.savedAt ||
                                0
                            );

                        resolve(
                            cached.content
                        );

                        return;
                    }

                    resolve(null);
                };

            request.onerror =
                () => {
                    reject(
                        request.error ||
                        new Error(
                            "Cached archive could not be read."
                        )
                    );
                };
        }
    );
}

function saveArchiveToCache(
    archiveObject
) {
    return new Promise(
        (resolve, reject) => {
            const transaction =
                searchDatabase
                    .transaction(
                        [
                            CACHE_STORE_NAME
                        ],
                        "readwrite"
                    );

            const store =
                transaction
                    .objectStore(
                        CACHE_STORE_NAME
                    );

            const savedAt =
                Date.now();

            archiveCacheLastCheckedAt =
                savedAt;

            store.put({
                id: CACHE_KEY,
                content:
                    archiveObject,
                savedAt,
                lastCheckedAt:
                    savedAt
            });

            transaction.oncomplete =
                () => resolve();

            transaction.onerror =
                () => {
                    reject(
                        transaction.error ||
                        new Error(
                            "Archive cache could not be saved."
                        )
                    );
                };
        }
    );
}

async function fetchArchiveWithProgress() {
    const response =
        await fetch(
            "../code/loadsearch-fast.php",
            {
                cache: "default"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Archive request failed with status ${response.status}.`
        );
    }

    const totalLength =
        Number(
            response.headers.get(
                "X-Total-Uncompressed-Length"
            )
        );

    if (
        !response.body ||
        !response.body.getReader
    ) {
        return response.json();
    }

    const reader =
        response.body.getReader();

    const decoder =
        new TextDecoder(
            "utf-8"
        );

    let rawJson = "";
    let loadedLength = 0;

    while (true) {
        const result =
            await reader.read();

        if (result.done) {
            break;
        }

        rawJson +=
            decoder.decode(
                result.value,
                {
                    stream: true
                }
            );

        loadedLength +=
            result.value.byteLength;

        if (
            Number.isFinite(
                totalLength
            ) &&
            totalLength > 0
        ) {
            const percent =
                Math.min(
                    100,
                    Math.round(
                        loadedLength /
                        totalLength *
                        100
                    )
                );

            setLoading(
                `Loading archive, ${percent}%`
            );
        }
    }

    rawJson +=
        decoder.decode();

    return JSON.parse(
        rawJson
    );
}

function stripExtension(filename) {
    return filename.replace(
        /\.(md|txt)$/i,
        ""
    );
}

function cleanTitle(filename) {
    return stripExtension(
        filename
    )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

function cleanDisplayText(rawText) {
    return String(rawText)
        .replace(
            /```[\s\S]*?```/g,
            " "
        )
        .replace(
            /^\s*\[(?:audio|video)]:\s*\([^)]+\)\s*$/gim,
            " "
        )
        .replace(
            /!\[\[[^\]]+]]/g,
            " "
        )
        .replace(
            /!\[[^\]]*]\([^)]+\)/g,
            " "
        )
        .replace(
            /\[([^\]]+)]\([^)]+\)/g,
            "$1"
        )
        .replace(
            /^\s*\[[^\]]+]:\s*\S+.*$/gm,
            " "
        )
        .replace(
            /<[^>]+>/g,
            " "
        )
        .replace(
            /[#>*_`~|]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

function cleanPreview(rawText) {
    return cleanDisplayText(
        String(rawText).slice(0, 2200)
    );
}

function escapeRegExp(value) {
    return String(value).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function highlightSnippetText(
    text,
    terms
) {
    const uniqueTerms = [
        ...new Set(
            terms
                .map(term => term.trim())
                .filter(Boolean)
        )
    ].sort(
        (first, second) =>
            second.length - first.length
    );

    if (uniqueTerms.length === 0) {
        return escapeHtml(text);
    }

    const pattern = new RegExp(
        uniqueTerms
            .map(escapeRegExp)
            .join("|"),
        "gi"
    );

    let html = "";
    let cursor = 0;

    text.replace(
        pattern,
        (match, offset) => {
            html += escapeHtml(
                text.slice(cursor, offset)
            );
            html +=
                `<mark class="search-hit">${escapeHtml(match)}</mark>`;
            cursor = offset + match.length;
            return match;
        }
    );

    html += escapeHtml(
        text.slice(cursor)
    );

    return html;
}

function buildMatchSnippets(
    record,
    rawQuery,
    maximumSnippets = 3
) {
    const text =
        record.displayText ||
        record.note ||
        "";

    const query =
        String(rawQuery)
            .trim()
            .toLowerCase();

    if (!query || !text) {
        return [];
    }

    const lowerText =
        text.toLowerCase();

    const tokens =
        query
            .split(/\s+/)
            .filter(Boolean);

    const preferredTerms =
        lowerText.includes(query)
            ? [query]
            : tokens;

    const positions = [];

    preferredTerms.forEach(
        term => {
            let start = 0;

            while (
                positions.length <
                maximumSnippets * 4
            ) {
                const position =
                    lowerText.indexOf(
                        term,
                        start
                    );

                if (position === -1) {
                    break;
                }

                positions.push(position);
                start = position +
                    Math.max(1, term.length);
            }
        }
    );

    positions.sort(
        (first, second) =>
            first - second
    );

    const selected = [];

    positions.forEach(
        position => {
            if (
                selected.length >=
                maximumSnippets
            ) {
                return;
            }

            if (
                selected.some(
                    existing =>
                        Math.abs(
                            existing - position
                        ) < 110
                )
            ) {
                return;
            }

            selected.push(position);
        }
    );

    const highlightTerms =
        lowerText.includes(query)
            ? [query, ...tokens]
            : tokens;

    return selected.map(
        position => {
            const radius = 105;
            let start = Math.max(
                0,
                position - radius
            );
            let end = Math.min(
                text.length,
                position + radius
            );

            if (start > 0) {
                const nextSpace =
                    text.indexOf(" ", start);

                if (
                    nextSpace !== -1 &&
                    nextSpace < position
                ) {
                    start = nextSpace + 1;
                }
            }

            if (end < text.length) {
                const previousSpace =
                    text.lastIndexOf(" ", end);

                if (
                    previousSpace > position
                ) {
                    end = previousSpace;
                }
            }

            const snippet =
                text.slice(start, end);

            return (
                (start > 0 ? "…" : "") +
                highlightSnippetText(
                    snippet,
                    highlightTerms
                ) +
                (end < text.length ? "…" : "")
            );
        }
    );
}

function normalizeFormat(folder) {
    const normalized =
        String(folder)
            .toLowerCase();

    if (
        normalized ===
        "books"
    ) {
        return "Book";
    }

    if (
        normalized ===
        "interviews"
    ) {
        return "Interview";
    }

    if (
        normalized ===
        "newsletters"
    ) {
        return "Newsletter";
    }

    if (
        normalized ===
            "q&a" ||
        normalized ===
            "qa"
    ) {
        return "Q&A";
    }

    if (
        normalized ===
        "videos"
    ) {
        return "Video";
    }

    if (
        normalized ===
        "misc"
    ) {
        return "Article";
    }

    if (
        normalized ===
        "community"
    ) {
        return "Community";
    }

    return folder || "Other";
}

function extractYear(
    title,
    previewText
) {
    const match =
        `${title} ${previewText}`
            .match(
                /\b(?:19|20)\d{2}\b/
            );

    return match
        ? match[0]
        : "Unknown";
}

function extractTopics(text) {
    const topics = [
        "raw milk",
        "meat",
        "eggs",
        "digestion",
        "detoxification",
        "fasting",
        "disease",
        "farming",
        "workshop",
        "nutrition"
    ];

    const lowerText =
        text.toLowerCase();

    return topics
        .filter(
            topic =>
                lowerText.includes(
                    topic
                )
        )
        .slice(
            0,
            6
        );
}

function createArticleSlug(path) {
    const filename =
        path
            .split("/")
            .at(-1)
            .replace(
                /\.(md|txt)$/i,
                ""
            );

    return filename
        .normalize(
            "NFKD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-zA-Z0-9\s]/g,
            ""
        )
        .replace(
            /\s+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        )
        .toLowerCase();
}

function buildArticleUrl(record) {
    const slug =
        createArticleSlug(
            record.path
        );

    const parameters =
        new URLSearchParams();

    if (state.query) {
        parameters.set(
            "search",
            state.query
        );
    }

    const queryString =
        parameters.toString();

    return (
        `../${slug}` +
        (
            queryString
                ? `?${queryString}`
                : ""
        )
    );
}

function transformArchiveEntry(
    path,
    rawText
) {
    const pathParts =
        path.split("/");

    const relativeParts =
        pathParts[0] ===
            "texts"
            ? pathParts.slice(1)
            : pathParts;

    const filename =
        relativeParts.at(-1) ||
        path;

    const folders =
        relativeParts.slice(
            0,
            -1
        );

    const topFolder =
        folders[0] ||
        "Other";

    const title =
        cleanTitle(filename);

    const displayText =
        cleanDisplayText(rawText);

    const previewText =
        displayText.slice(0, 2200);

    const year =
        extractYear(
            title,
            previewText
        );

    const source =
        folders.length > 1
            ? folders
                .slice(1)
                .join(" / ")
            : topFolder;

    const note =
        previewText.length >
            260
            ? `${previewText
                .slice(
                    0,
                    260
                )
                .trim()}…`
            : previewText;

    const fullSearchText =
        `${title} ${path} ${rawText}`
            .toLowerCase();

    return {
        title,
        date:
            year === "Unknown"
                ? "Date unknown"
                : year,
        year,
        format:
            normalizeFormat(
                topFolder
            ),
        source,
        status:
            "Uncatalogued",
        topics:
            extractTopics(
                fullSearchText
            ),
        note:
            note ||
            "No preview text is available for this record.",
        path,
        displayText,
        searchText:
            fullSearchText
    };
}

function transformArchive(
    archiveObject
) {
    return Object.entries(
        archiveObject
    )
        .map(
            (
                [
                    path,
                    rawText
                ]
            ) =>
                transformArchiveEntry(
                    path,
                    rawText
                )
        )
        .sort(
            (
                first,
                second
            ) => {
                const firstYear =
                    /^\d{4}$/.test(
                        first.year
                    )
                        ? Number(
                            first.year
                        )
                        : 0;

                const secondYear =
                    /^\d{4}$/.test(
                        second.year
                    )
                        ? Number(
                            second.year
                        )
                        : 0;

                if (
                    firstYear !==
                    secondYear
                ) {
                    return (
                        secondYear -
                        firstYear
                    );
                }

                return first
                    .title
                    .localeCompare(
                        second.title
                    );
            }
        );
}

function recordMatchesFilters(
    record
) {
    const matchesTopic =
        !state.topic ||
        record.topics.includes(
            state.topic
        );

    const matchesFormat =
        state.format ===
            "All" ||
        record.format ===
            state.format;

    const matchesYear =
        state.year ===
            "All" ||
        record.year ===
            state.year;

    const matchesSource =
        state.source ===
            "All" ||
        record.source ===
            state.source;

    const matchesStatus =
        state.status ===
            "All" ||
        record.status ===
            state.status;

    return (
        matchesTopic &&
        matchesFormat &&
        matchesYear &&
        matchesSource &&
        matchesStatus
    );
}

function calculateSearchScore(
    record,
    query,
    tokens,
    exactPhrase
) {
    const title =
        record.title
            .toLowerCase();

    const path =
        record.path
            .toLowerCase();

    const source =
        record.source
            .toLowerCase();

    let score = 0;

    if (
        title ===
        query
    ) {
        score += 20000;
    } else if (
        title.includes(
            query
        )
    ) {
        score += 10000;
    }

    if (
        tokens.every(
            token =>
                title.includes(
                    token
                )
        )
    ) {
        score += 5000;
    }

    if (
        path.includes(
            query
        )
    ) {
        score += 2200;
    }

    if (
        source.includes(
            query
        )
    ) {
        score += 1400;
    }

    if (exactPhrase) {
        score += 1000;
    }

    tokens.forEach(
        token => {
            score +=
                Math.min(
                    countOccurrences(
                        title,
                        token
                    ),
                    4
                ) * 450;

            score +=
                Math.min(
                    countOccurrences(
                        path,
                        token
                    ),
                    4
                ) * 160;

            score +=
                Math.min(
                    countOccurrences(
                        record.searchText,
                        token
                    ),
                    12
                ) * 18;
        }
    );

    if (
        /^\d{4}$/.test(
            record.year
        )
    ) {
        score +=
            Number(
                record.year
            ) / 100;
    }

    return score;
}

function searchAnalysis() {
    const query =
        state.query
            .trim()
            .toLowerCase();

    const tokens =
        query
            .split(
                /\s+/
            )
            .filter(
                Boolean
            );

    const candidates =
        records.filter(
            recordMatchesFilters
        );

    if (!query) {
        return {
            matches:
                candidates,
            allWordsCount:
                candidates.length,
            exactPhraseCount:
                candidates.length
        };
    }

    const matches = [];

    let allWordsCount = 0;
    let exactPhraseCount = 0;

    candidates.forEach(
        record => {
            const exactPhrase =
                record.searchText
                    .includes(
                        query
                    );

            const allTokens =
                tokens.every(
                    token =>
                        record
                            .searchText
                            .includes(
                                token
                            )
                );

            if (!allTokens) {
                return;
            }

            allWordsCount += 1;

            if (exactPhrase) {
                exactPhraseCount +=
                    1;
            }

            if (
                state.exactPhraseOnly &&
                !exactPhrase
            ) {
                return;
            }

            const displayTextLower =
                record.displayText
                    .toLowerCase();

            const matchCount =
                exactPhrase
                    ? countOccurrences(
                        displayTextLower,
                        query
                    )
                    : tokens.reduce(
                        (total, token) =>
                            total +
                            countOccurrences(
                                displayTextLower,
                                token
                            ),
                        0
                    );

            matches.push({
                ...record,
                _exactPhrase:
                    exactPhrase,
                _matchCount:
                    Math.max(1, matchCount),
                _score:
                    calculateSearchScore(
                        record,
                        query,
                        tokens,
                        exactPhrase
                    )
            });
        }
    );

    matches.sort(
        (
            first,
            second
        ) => {
            if (
                first._score !==
                second._score
            ) {
                return (
                    second._score -
                    first._score
                );
            }

            const firstYear =
                /^\d{4}$/.test(
                    first.year
                )
                    ? Number(
                        first.year
                    )
                    : 0;

            const secondYear =
                /^\d{4}$/.test(
                    second.year
                )
                    ? Number(
                        second.year
                    )
                    : 0;

            if (
                firstYear !==
                secondYear
            ) {
                return (
                    secondYear -
                    firstYear
                );
            }

            return first
                .title
                .localeCompare(
                    second.title
                );
        }
    );

    return {
        matches,
        allWordsCount,
        exactPhraseCount
    };
}

function buildPageItems(
    totalPages,
    currentPage
) {
    if (
        totalPages <= 7
    ) {
        return Array.from(
            {
                length:
                    totalPages
            },
            (
                _,
                index
            ) =>
                index + 1
        );
    }

    const pages = [1];

    const start =
        Math.max(
            2,
            currentPage - 1
        );

    const end =
        Math.min(
            totalPages - 1,
            currentPage + 1
        );

    if (start > 2) {
        pages.push(
            "ellipsis-left"
        );
    }

    for (
        let page = start;
        page <= end;
        page += 1
    ) {
        pages.push(page);
    }

    if (
        end <
        totalPages - 1
    ) {
        pages.push(
            "ellipsis-right"
        );
    }

    pages.push(
        totalPages
    );

    return pages;
}

function scrollResultsIntoView() {
    byId("archive")
        .scrollIntoView({
            behavior:
                "smooth",
            block:
                "start"
        });
}

function goToPage(
    page,
    shouldScroll = true
) {
    const analysis =
        searchAnalysis();

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                analysis
                    .matches
                    .length /
                state.pageSize
            )
        );

    const safePage =
        Math.min(
            totalPages,
            Math.max(
                1,
                page
            )
        );

    if (
        safePage ===
        state.page
    ) {
        return;
    }

    state.page =
        safePage;

    render();

    if (shouldScroll) {
        scrollResultsIntoView();
    }
}

function renderPagination(
    totalResults
) {
    ensurePaginationControls();

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalResults /
                state.pageSize
            )
        );

    if (
        state.page >
        totalPages
    ) {
        state.page =
            totalPages;
    }

    const startIndex =
        totalResults === 0
            ? 0
            : (
                state.page - 1
            ) *
            state.pageSize +
            1;

    const endIndex =
        Math.min(
            state.page *
            state.pageSize,
            totalResults
        );

    elements
        .paginationSummary
        .textContent =
            totalResults === 0
                ? "No records to display"
                : `Showing ${startIndex}–${endIndex} of ${totalResults} records, page ${state.page} of ${totalPages}`;

    elements
        .previousPage
        .disabled =
            state.page <= 1;

    elements
        .nextPage
        .disabled =
            state.page >=
            totalPages;

    const pageItems =
        buildPageItems(
            totalPages,
            state.page
        );

    elements.pageButtons
        .innerHTML = "";

    pageItems.forEach(
        item => {
            if (
                typeof item ===
                "string"
            ) {
                const ellipsis =
                    document
                        .createElement(
                            "span"
                        );

                ellipsis.className =
                    "pagination-ellipsis";

                ellipsis.textContent =
                    "…";

                elements
                    .pageButtons
                    .appendChild(
                        ellipsis
                    );

                return;
            }

            const button =
                document
                    .createElement(
                        "button"
                    );

            button.className =
                "pagination-button";

            button.type =
                "button";

            button.textContent =
                String(item);

            button.setAttribute(
                "aria-label",
                `Go to page ${item}`
            );

            button.classList
                .toggle(
                    "active",
                    item ===
                        state.page
                );

            if (
                item ===
                state.page
            ) {
                button.setAttribute(
                    "aria-current",
                    "page"
                );
            }

            button.addEventListener(
                "click",
                () => {
                    goToPage(item);
                }
            );

            elements
                .pageButtons
                .appendChild(
                    button
                );
        }
    );

    elements.pagination.hidden =
        totalResults === 0;
}

function render() {
    const analysis =
        searchAnalysis();

    const matches =
        analysis.matches;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                matches.length /
                state.pageSize
            )
        );

    if (
        state.page >
        totalPages
    ) {
        state.page =
            totalPages;
    }

    const startIndex =
        (
            state.page - 1
        ) *
        state.pageSize;

    const visible =
        matches.slice(
            startIndex,
            startIndex +
            state.pageSize
        );

    elements.list.innerHTML =
        visible
            .map(
                record => {
                    const snippets =
                        state.query
                            ? buildMatchSnippets(
                                record,
                                state.query
                            )
                            : [];

                    const previewHtml =
                        snippets.length > 0
                            ? `
                                <div class="record-snippets">
                                    ${snippets
                                        .map(
                                            snippet => `
                                                <p class="record-snippet">
                                                    ${snippet}
                                                </p>
                                            `
                                        )
                                        .join("")}
                                </div>
                            `
                            : `
                                <p class="record-summary">
                                    ${escapeHtml(record.note)}
                                </p>
                            `;

                    const yearLabel =
                        record.year === "Unknown"
                            ? "Undated"
                            : record.year;

                    return `
                        <li
                            class="record"
                            data-format="${escapeHtml(record.format)}"
                        >
                            <div class="record-stamp" aria-hidden="true">
                                <span class="record-stamp-mark"></span>
                                <span class="record-stamp-year">
                                    ${escapeHtml(yearLabel)}
                                </span>
                            </div>

                            <div class="record-main">
                                <div class="record-overline">
                                    <span class="record-date">
                                        ${escapeHtml(record.date)}
                                    </span>

                                    <span class="record-format-label">
                                        ${escapeHtml(record.format)}
                                    </span>
                                </div>

                                <h3>
                                    <a href="${buildArticleUrl(record)}">
                                        ${escapeHtml(record.title)}
                                    </a>
                                </h3>

                                ${previewHtml}

                                <div class="record-meta">
                                    ${
                                        record._exactPhrase &&
                                        state.query
                                            ? `
                                                <span class="tag">
                                                    Exact phrase
                                                </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        state.query &&
                                        record._matchCount
                                            ? `
                                                <span class="tag match-count">
                                                    ${record._matchCount}
                                                    ${record._matchCount === 1 ? "match" : "matches"}
                                                </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        record
                                            .topics
                                            .map(
                                                topic => `
                                                    <span class="tag">
                                                        ${escapeHtml(topic)}
                                                    </span>
                                                `
                                            )
                                            .join("")
                                    }
                                </div>
                            </div>

                            <div class="record-type">
                                <strong>
                                    ${escapeHtml(record.format)}
                                </strong>

                                <small class="record-source">
                                    ${escapeHtml(record.source)}
                                </small>

                                <small class="record-status">
                                    ${escapeHtml(record.status)}
                                </small>

                                <span class="record-open" aria-hidden="true">
                                    Open record&nbsp;→
                                </span>
                            </div>
                        </li>
                    `;
                }
            )
            .join("");

    const firstShown =
        matches.length === 0
            ? 0
            : startIndex + 1;

    const lastShown =
        Math.min(
            startIndex +
            state.pageSize,
            matches.length
        );

    elements.count.textContent =
        matches.length === 0
            ? "0 records"
            : `Showing ${firstShown}–${lastShown} of ${matches.length}`;

    if (state.query) {
        elements.title.textContent =
            `Results for “${state.query}”`;

        if (
            state.exactPhraseOnly
        ) {
            elements.feedback
                .textContent =
                    `${analysis.exactPhraseCount} exact phrase ${
                        analysis.exactPhraseCount === 1
                            ? "match"
                            : "matches"
                    } for “${state.query}”.`;
        } else if (
            state.query
                .trim()
                .includes(" ")
        ) {
            elements.feedback
                .textContent =
                    `${analysis.allWordsCount} documents contain every word. ` +
                    `${analysis.exactPhraseCount} contain the exact phrase. ` +
                    "Results are ranked by relevance.";
        } else {
            elements.feedback
                .textContent =
                    `${analysis.allWordsCount} ${
                        analysis.allWordsCount === 1
                            ? "match"
                            : "matches"
                    } for “${state.query}”, ranked by relevance.`;
        }
    } else if (
        state.format !==
        "All"
    ) {
        elements.title.textContent =
            state.format;

        elements.feedback.textContent =
            `Browsing ${matches.length} ${
                matches.length === 1
                    ? "record"
                    : "records"
            }.`;
    } else {
        elements.title.textContent =
            "All records";

        elements.feedback.textContent =
            `Search across ${records.length} archive records.`;
    }

    ensureSearchModeControl();

    if (
        elements.exactPhraseToggle
    ) {
        const hasMultipleWords =
            state.query
                .trim()
                .includes(" ");

        elements
            .exactPhraseToggle
            .hidden =
                !hasMultipleWords;

        elements
            .exactPhraseToggle
            .textContent =
                state.exactPhraseOnly
                    ? "Show all-word matches"
                    : "Exact phrase only";
    }

    elements.clearSearch.hidden =
        state.query.length === 0;

    elements.empty.style.display =
        matches.length
            ? "none"
            : "block";

    renderPagination(
        matches.length
    );
}

function updateFormatControls() {
    const counts = {};

    records.forEach(
        record => {
            counts[record.format] =
                (
                    counts[
                        record.format
                    ] || 0
                ) + 1;
        }
    );

    const formats =
        Object.keys(
            counts
        )
            .sort(
                (
                    first,
                    second
                ) =>
                    first
                        .localeCompare(
                            second
                        )
            );

    const container =
        document.querySelector(
            ".format-options"
        );

    if (container) {
        container.innerHTML = [
            `
                <button
                    class="format-option active"
                    data-format="All"
                >
                    <span>
                        All records
                    </span>

                    <span>
                        ${records.length}
                    </span>
                </button>
            `,
            ...formats.map(
                format => `
                    <button
                        class="format-option"
                        data-format="${escapeHtml(format)}"
                    >
                        <span>
                            ${escapeHtml(format)}
                        </span>

                        <span>
                            ${counts[format]}
                        </span>
                    </button>
                `
            )
        ].join("");

        container
            .querySelectorAll(
                ".format-option"
            )
            .forEach(
                button => {
                    button.addEventListener(
                        "click",
                        () => {
                            state.format =
                                button
                                    .dataset
                                    .format;

                            state.page = 1;

                            container
                                .querySelectorAll(
                                    ".format-option"
                                )
                                .forEach(
                                    item => {
                                        item.classList.toggle(
                                            "active",
                                            item ===
                                                button
                                        );
                                    }
                                );

                            render();
                        }
                    );
                }
            );
    }

    document
        .querySelectorAll(
            ".collection"
        )
        .forEach(
            button => {
                const count =
                    counts[
                        button
                            .dataset
                            .format
                    ] || 0;

                const small =
                    button
                        .querySelector(
                            "small"
                        );

                if (small) {
                    small.textContent =
                        `${count} ${
                            count === 1
                                ? "archive record"
                                : "archive records"
                        }`;
                }
            }
        );
}

function updateSelectControls() {
    const years = [
        ...new Set(
            records
                .map(
                    record =>
                        record.year
                )
                .filter(
                    year =>
                        /^\d{4}$/.test(
                            year
                        )
                )
        )
    ].sort(
        (
            first,
            second
        ) =>
            Number(second) -
            Number(first)
    );

    elements.year.innerHTML =
        '<option value="All">All years</option>' +
        years
            .map(
                year =>
                    `<option value="${year}">${year}</option>`
            )
            .join("");

    const sources = [
        ...new Set(
            records
                .map(
                    record =>
                        record.source
                )
                .filter(
                    Boolean
                )
        )
    ].sort(
        (
            first,
            second
        ) =>
            first.localeCompare(
                second
            )
    );

    elements.source.innerHTML =
        '<option value="All">All sources</option>' +
        sources
            .map(
                source =>
                    `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`
            )
            .join("");

    elements.status.innerHTML = `
        <option value="All">
            All statuses
        </option>

        <option value="Uncatalogued">
            Uncatalogued
        </option>
    `;
}

function chooseFormat(format) {
    state.format =
        format;

    state.page = 1;

    document
        .querySelectorAll(
            ".format-option"
        )
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.format ===
                        format
                );
            }
        );

    render();

    scrollResultsIntoView();
}

function showSearchResults() {
    state.query =
        elements.search
            .value
            .trim();

    state.exactPhraseOnly =
        false;

    state.page = 1;

    render();

    scrollResultsIntoView();
}

function resetAll() {
    Object.assign(
        state,
        {
            query: "",
            topic: "",
            format: "All",
            year: "All",
            source: "All",
            status: "All",
            exactPhraseOnly:
                false,
            page: 1,
            pageSize: 20
        }
    );

    elements.search.value = "";
    elements.year.value = "All";
    elements.source.value = "All";
    elements.status.value = "All";

    document
        .querySelectorAll(
            ".topic-chip"
        )
        .forEach(
            button => {
                button.classList
                    .remove(
                        "active"
                    );
            }
        );

    document
        .querySelectorAll(
            ".format-option"
        )
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.format ===
                        "All"
                );
            }
        );

    render();
}

function attachInterfaceEvents() {
    elements.search
        .addEventListener(
            "input",
            event => {
                clearTimeout(
                    searchTimer
                );

                searchTimer =
                    setTimeout(
                        () => {
                            state.query =
                                event
                                    .target
                                    .value
                                    .trim();

                            state.exactPhraseOnly =
                                false;

                            state.page = 1;

                            render();
                        },
                        120
                    );
            }
        );

    elements.search
        .addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Enter"
                ) {
                    event.preventDefault();

                    showSearchResults();
                }
            }
        );

    elements.submitSearch
        .addEventListener(
            "click",
            () => {
                if (
                    elements
                        .submitSearch
                        .textContent
                        .trim() ===
                    "Retry"
                ) {
                    elements
                        .submitSearch
                        .textContent =
                            "Search";

                    loadArchive();

                    return;
                }

                showSearchResults();
            }
        );

    elements.clearSearch
        .addEventListener(
            "click",
            () => {
                state.query = "";

                elements
                    .search
                    .value = "";

                state.exactPhraseOnly =
                    false;

                state.page = 1;

                render();

                elements.search.focus();
            }
        );

    elements.clearFilters
        .addEventListener(
            "click",
            resetAll
        );

    elements.year
        .addEventListener(
            "change",
            event => {
                state.year =
                    event
                        .target
                        .value;

                state.page = 1;

                render();
            }
        );

    elements.source
        .addEventListener(
            "change",
            event => {
                state.source =
                    event
                        .target
                        .value;

                state.page = 1;

                render();
            }
        );

    elements.status
        .addEventListener(
            "change",
            event => {
                state.status =
                    event
                        .target
                        .value;

                state.page = 1;

                render();
            }
        );

    if (elements.load) {
        elements.load.style.display =
            "none";
    }

    if (
        elements.mobileFilterButton &&
        elements.filters
    ) {
        setFiltersOpen(
            readFiltersOpen(),
            { persist: false }
        );

        elements
            .mobileFilterButton
            .addEventListener(
                "click",
                () => {
                    const isOpen =
                        elements
                            .mobileFilterButton
                            .getAttribute(
                                "aria-expanded"
                            ) === "true";

                    setFiltersOpen(
                        !isOpen
                    );
                }
            );
    }

    document
        .querySelectorAll(
            ".collection"
        )
        .forEach(
            button => {
                button
                    .addEventListener(
                        "click",
                        () => {
                            chooseFormat(
                                button
                                    .dataset
                                    .format
                            );
                        }
                    );
            }
        );

    document
        .querySelectorAll(
            ".topic-chip"
        )
        .forEach(
            button => {
                button.addEventListener(
                    "click",
                    () => {
                        const wasActive =
                            button
                                .classList
                                .contains(
                                    "active"
                                );

                        document
                            .querySelectorAll(
                                ".topic-chip"
                            )
                            .forEach(
                                item => {
                                    item.classList
                                        .remove(
                                            "active"
                                        );
                                }
                            );

                        state.topic =
                            wasActive
                                ? ""
                                : button
                                    .dataset
                                    .topic;

                        if (!wasActive) {
                            button.classList
                                .add(
                                    "active"
                                );
                        }

                        state.page = 1;

                        render();
                    }
                );
            }
        );

    document
        .querySelectorAll(
            "[data-topic-link]"
        )
        .forEach(
            link => {
                link.addEventListener(
                    "click",
                    () => {
                        state.topic =
                            link
                                .dataset
                                .topicLink;

                        state.page = 1;

                        document
                            .querySelectorAll(
                                ".topic-chip"
                            )
                            .forEach(
                                item => {
                                    item.classList.toggle(
                                        "active",
                                        item.dataset.topic ===
                                            state.topic
                                    );
                                }
                            );

                        render();
                    }
                );
            }
        );

    document
        .querySelectorAll(
            "[data-status-link]"
        )
        .forEach(
            link => {
                link.addEventListener(
                    "click",
                    () => {
                        state.status =
                            "Uncatalogued";

                        elements
                            .status
                            .value =
                                "Uncatalogued";

                        state.page = 1;

                        render();
                    }
                );
            }
        );

    document
        .querySelectorAll(
            "[data-year-link]"
        )
        .forEach(
            link => {
                link.addEventListener(
                    "click",
                    () => {
                        state.year =
                            link
                                .dataset
                                .yearLink;

                        elements
                            .year
                            .value =
                                state.year;

                        state.page = 1;

                        render();
                    }
                );
            }
        );
}

async function applyArchive(
    archiveObject,
    sourceLabel
) {
    setLoading(
        sourceLabel ===
            "cache"
            ? "Opening cached archive…"
            : "Preparing archive…"
    );

    await new Promise(
        resolve =>
            requestAnimationFrame(
                resolve
            )
    );

    records =
        transformArchive(
            archiveObject
        );

    state.page = 1;

    updateFormatControls();
    updateSelectControls();
    setReady();
    render();
}

async function loadArchive() {
    try {
        setLoading(
            "Checking local archive cache…"
        );

        if (!searchDatabase) {
            searchDatabase =
                await openSearchDatabase();

            void requestPersistentArchiveStorage();
        }

        const cachedArchive =
            await readCachedArchive();

        if (cachedArchive) {
            await applyArchive(
                cachedArchive,
                "cache"
            );

            void refreshArchiveCacheInBackground(
                cachedArchive
            );

            return;
        }

        setLoading(
            "Loading archive, 0%"
        );

        const downloadedArchive =
            await fetchArchiveWithProgress();

        await saveArchiveToCache(
            downloadedArchive
        );

        await applyArchive(
            downloadedArchive,
            "network"
        );
    } catch (error) {
        setLoadError(error);
    }
}

const ARCHIVE_STATE_KEY =
    "aajonusArchiveStateV1";

const ARTICLE_CONTEXT_KEY =
    "aajonusArticleContextV1";

function saveArchiveState() {
    const savedState = {
        query: state.query,
        topic: state.topic,
        format: state.format,
        year: state.year,
        source: state.source,
        status: state.status,
        exactPhraseOnly:
            state.exactPhraseOnly,
        page: state.page,
        pageSize: state.pageSize,
        scrollY: window.scrollY
    };

    sessionStorage.setItem(
        ARCHIVE_STATE_KEY,
        JSON.stringify(savedState)
    );
}

function restoreArchiveState() {
    const savedText =
        sessionStorage.getItem(
            ARCHIVE_STATE_KEY
        );

    if (!savedText) {
        return;
    }

    try {
        const saved =
            JSON.parse(savedText);

        state.query =
            typeof saved.query === "string"
                ? saved.query
                : "";

        state.topic =
            typeof saved.topic === "string"
                ? saved.topic
                : "";

        state.format =
            typeof saved.format === "string"
                ? saved.format
                : "All";

        state.year =
            typeof saved.year === "string"
                ? saved.year
                : "All";

        state.source =
            typeof saved.source === "string"
                ? saved.source
                : "All";

        state.status =
            typeof saved.status === "string"
                ? saved.status
                : "All";

        state.exactPhraseOnly =
            saved.exactPhraseOnly === true;

        state.page =
            Number.isInteger(saved.page) &&
            saved.page > 0
                ? saved.page
                : 1;

        state.pageSize = 20;

        elements.search.value =
            state.query;

        elements.year.value =
            state.year;

        if (
            elements.year.value !==
            state.year
        ) {
            state.year = "All";
            elements.year.value = "All";
        }

        elements.source.value =
            state.source;

        if (
            elements.source.value !==
            state.source
        ) {
            state.source = "All";
            elements.source.value = "All";
        }

        elements.status.value =
            state.status;

        if (
            elements.status.value !==
            state.status
        ) {
            state.status = "All";
            elements.status.value = "All";
        }

        document
            .querySelectorAll(
                ".format-option"
            )
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.format ===
                        state.format
                );
            });

        document
            .querySelectorAll(
                ".topic-chip"
            )
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.topic ===
                        state.topic
                );
            });

        render();

        requestAnimationFrame(() => {
            window.scrollTo(
                0,
                Number(saved.scrollY) || 0
            );
        });
    } catch (error) {
        console.error(
            "Saved archive state was invalid.",
            error
        );

        sessionStorage.removeItem(
            ARCHIVE_STATE_KEY
        );
    }
}

const applyArchiveWithoutRestore =
    applyArchive;

applyArchive = async function (
    archiveObject,
    sourceLabel
) {
    await applyArchiveWithoutRestore(
        archiveObject,
        sourceLabel
    );

    restoreArchiveState();
};

document.addEventListener(
    "click",
    event => {
        const articleLink =
            event.target.closest(
                ".record-main h3 a"
            );

        if (articleLink) {
            saveArchiveState();
        }
    }
);


function saveArticleResultContext(
    articleLink
) {
    const analysis =
        searchAnalysis();

    const items =
        analysis.matches.map(
            record => {
                const url =
                    new URL(
                        buildArticleUrl(
                            record
                        ),
                        window.location.href
                    );

                return {
                    title:
                        record.title,

                    url:
                        url.href
                };
            }
        );

    const clickedUrl =
        new URL(
            articleLink.href,
            window.location.href
        );

    const currentIndex =
        items.findIndex(
            item => {
                const itemUrl =
                    new URL(
                        item.url,
                        window.location.href
                    );

                return (
                    itemUrl.pathname ===
                    clickedUrl.pathname
                );
            }
        );

    if (currentIndex < 0) {
        return;
    }

    sessionStorage.setItem(
        ARTICLE_CONTEXT_KEY,
        JSON.stringify({
            items,
            currentIndex,
            savedAt:
                Date.now()
        })
    );
}

document.addEventListener(
    "click",
    event => {
        if (
            !(
                event.target
                instanceof Element
            )
        ) {
            return;
        }

        const articleLink =
            event.target.closest(
                ".record-main h3 a"
            );

        if (!articleLink) {
            return;
        }

        saveArticleResultContext(
            articleLink
        );
    }
);

window.addEventListener(
    "pagehide",
    saveArchiveState
);


/* SHAREABLE_ARCHIVE_VIEW_URLS_V1 */

let archiveUrlStateApplied =
    false;

let archiveUrlSyncReady =
    false;

let archiveUrlSyncTimer =
    null;

function archiveUrlContainsState(
    parameters
) {
    return [
        "q",
        "topic",
        "format",
        "year",
        "source",
        "status",
        "exact",
        "page"
    ].some(
        key =>
            parameters.has(key)
    );
}

function updateArchiveControlsFromState() {
    elements.search.value =
        state.query;

    if (elements.year) {
        elements.year.value =
            state.year;

        if (
            elements.year.value !==
            state.year
        ) {
            state.year =
                "All";

            elements.year.value =
                "All";
        }
    }

    if (elements.source) {
        elements.source.value =
            state.source;

        if (
            elements.source.value !==
            state.source
        ) {
            state.source =
                "All";

            elements.source.value =
                "All";
        }
    }

    if (elements.status) {
        elements.status.value =
            state.status;

        if (
            elements.status.value !==
            state.status
        ) {
            state.status =
                "All";

            elements.status.value =
                "All";
        }
    }

    const formatButtons = [
        ...document.querySelectorAll(
            ".format-option"
        )
    ];

    const formatExists =
        formatButtons.some(
            button =>
                button.dataset.format ===
                state.format
        );

    if (!formatExists) {
        state.format =
            "All";
    }

    formatButtons.forEach(
        button => {
            button.classList.toggle(
                "active",
                button.dataset.format ===
                    state.format
            );
        }
    );

    const topicButtons = [
        ...document.querySelectorAll(
            ".topic-chip"
        )
    ];

    const topicExists =
        !state.topic ||
        topicButtons.some(
            button =>
                button.dataset.topic ===
                state.topic
        );

    if (!topicExists) {
        state.topic = "";
    }

    topicButtons.forEach(
        button => {
            button.classList.toggle(
                "active",
                state.topic !== "" &&
                button.dataset.topic ===
                    state.topic
            );
        }
    );
}

function applyArchiveStateFromUrl(
    useDefaultsWhenEmpty = false
) {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const hasState =
        archiveUrlContainsState(
            parameters
        );

    if (
        !hasState &&
        !useDefaultsWhenEmpty
    ) {
        return false;
    }

    state.query =
        hasState
            ? (
                parameters.get("q") ||
                ""
            ).trim()
            : "";

    state.topic =
        hasState
            ? (
                parameters.get(
                    "topic"
                ) || ""
            )
            : "";

    state.format =
        hasState
            ? (
                parameters.get(
                    "format"
                ) || "All"
            )
            : "All";

    state.year =
        hasState
            ? (
                parameters.get(
                    "year"
                ) || "All"
            )
            : "All";

    state.source =
        hasState
            ? (
                parameters.get(
                    "source"
                ) || "All"
            )
            : "All";

    state.status =
        hasState
            ? (
                parameters.get(
                    "status"
                ) || "All"
            )
            : "All";

    state.exactPhraseOnly =
        hasState &&
        parameters.get("exact") ===
            "1";

    const requestedPage =
        Number.parseInt(
            parameters.get("page") ||
                "1",
            10
        );

    state.page =
        Number.isInteger(
            requestedPage
        ) &&
        requestedPage > 0
            ? requestedPage
            : 1;

    state.pageSize = 20;

    updateArchiveControlsFromState();

    return hasState;
}

function buildArchiveViewUrl() {
    const url =
        new URL(
            window.location.href
        );

    const parameters =
        new URLSearchParams();

    if (state.query) {
        parameters.set(
            "q",
            state.query
        );
    }

    if (state.topic) {
        parameters.set(
            "topic",
            state.topic
        );
    }

    if (
        state.format !==
        "All"
    ) {
        parameters.set(
            "format",
            state.format
        );
    }

    if (
        state.year !==
        "All"
    ) {
        parameters.set(
            "year",
            state.year
        );
    }

    if (
        state.source !==
        "All"
    ) {
        parameters.set(
            "source",
            state.source
        );
    }

    if (
        state.status !==
        "All"
    ) {
        parameters.set(
            "status",
            state.status
        );
    }

    if (
        state.exactPhraseOnly
    ) {
        parameters.set(
            "exact",
            "1"
        );
    }

    if (state.page > 1) {
        parameters.set(
            "page",
            String(state.page)
        );
    }

    url.search =
        parameters.toString();

    url.hash = "";

    return url;
}

function syncArchiveViewUrl() {
    if (!archiveUrlSyncReady) {
        return;
    }

    const url =
        buildArchiveViewUrl();

    history.replaceState(
        {
            archiveView: true
        },
        "",
        url
    );
}

function queueArchiveUrlSync() {
    clearTimeout(
        archiveUrlSyncTimer
    );

    archiveUrlSyncTimer =
        setTimeout(
            syncArchiveViewUrl,
            60
        );
}

function ensureCopyViewLinkButton() {
    if (
        document.getElementById(
            "copyArchiveViewLink"
        )
    ) {
        return;
    }

    const statusRow =
        document.querySelector(
            ".search-status-row"
        );

    if (!statusRow) {
        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "copyArchiveViewLink";

    button.type =
        "button";

    button.className =
        "search-clear";

    button.textContent =
        "Copy view link";

    button.addEventListener(
        "click",
        async () => {
            syncArchiveViewUrl();

            try {
                await navigator
                    .clipboard
                    .writeText(
                        window.location.href
                    );

                button.textContent =
                    "View link copied";
            } catch {
                button.textContent =
                    "Copy failed";
            }

            setTimeout(
                () => {
                    button.textContent =
                        "Copy view link";
                },
                1500
            );
        }
    );

    if (elements.clearSearch) {
        statusRow.insertBefore(
            button,
            elements.clearSearch
        );
    } else {
        statusRow.appendChild(
            button
        );
    }
}

const renderBeforeArchiveUrlSync =
    render;

render = function () {
    renderBeforeArchiveUrlSync();

    if (archiveUrlSyncReady) {
        queueArchiveUrlSync();
    }
};

const applyArchiveBeforeUrlState =
    applyArchive;

applyArchive = async function (
    archiveObject,
    sourceLabel
) {
    await applyArchiveBeforeUrlState(
        archiveObject,
        sourceLabel
    );

    if (!archiveUrlStateApplied) {
        const restoredFromUrl =
            applyArchiveStateFromUrl(
                false
            );

        archiveUrlStateApplied =
            true;

        archiveUrlSyncReady =
            true;

        ensureCopyViewLinkButton();

        if (restoredFromUrl) {
            render();
        } else {
            syncArchiveViewUrl();
        }
    }
};

window.addEventListener(
    "popstate",
    () => {
        if (!records.length) {
            return;
        }

        archiveUrlSyncReady =
            false;

        applyArchiveStateFromUrl(
            true
        );

        render();

        archiveUrlSyncReady =
            true;
    }
);


/* METADATA_FIRST_ARCHIVE_LOADING_V1 */

let fullTextSearchReady =
    false;

let fullTextLoadingFailed =
    false;

function appendArchiveLoadingStatus() {
    if (
        fullTextSearchReady ||
        !records.length
    ) {
        return;
    }

    const message =
        fullTextLoadingFailed
            ? " Full-text search is unavailable. Title and filename search still work."
            : " Full-text search is loading in the background.";

    if (
        !elements.feedback
            .textContent
            .includes(message.trim())
    ) {
        elements.feedback.textContent +=
            message;
    }
}

const renderBeforeMetadataStatus =
    render;

render = function () {
    renderBeforeMetadataStatus();

    appendArchiveLoadingStatus();
};

async function fetchArchiveMetadata() {
    const response =
        await fetch(
            "../code/loadsearch-meta.php",
            {
                cache: "default"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Archive metadata request failed with status ${response.status}.`
        );
    }

    return response.json();
}

async function fetchFullArchiveSilently(
    forceRevalidation = false
) {
    const response =
        await fetch(
            "../code/loadsearch-fast.php",
            {
                cache:
                    forceRevalidation
                        ? "no-cache"
                        : "default"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Full archive request failed with status ${response.status}.`
        );
    }

    return response.json();
}

function shouldRefreshArchiveCache() {
    if (!archiveCacheLastCheckedAt) {
        return true;
    }

    const refreshInterval =
        CACHE_REFRESH_HOURS *
        60 *
        60 *
        1000;

    return (
        Date.now() -
        archiveCacheLastCheckedAt
    ) >= refreshInterval;
}

function archiveFingerprint(
    archiveObject
) {
    const serialized =
        JSON.stringify(
            archiveObject
        );

    let hash = 2166136261;

    for (
        let index = 0;
        index < serialized.length;
        index += 1
    ) {
        hash ^=
            serialized.charCodeAt(
                index
            );

        hash = Math.imul(
            hash,
            16777619
        );
    }

    return `${serialized.length}:${
        hash >>> 0
    }`;
}

async function refreshArchiveCacheInBackground(
    cachedArchive
) {
    if (!shouldRefreshArchiveCache()) {
        return;
    }

    archiveCacheLastCheckedAt =
        Date.now();

    try {
        const refreshedArchive =
            await fetchFullArchiveSilently(
                true
            );

        const archiveChanged =
            archiveFingerprint(
                refreshedArchive
            ) !==
            archiveFingerprint(
                cachedArchive
            );

        await saveArchiveToCache(
            refreshedArchive
        );

        if (archiveChanged) {
            await upgradeToFullTextArchive(
                refreshedArchive
            );
        }
    } catch (error) {
        console.warn(
            "The archive opened from its permanent local cache, but the background refresh failed.",
            error
        );
    }
}

function synchronizeControlsAfterUpgrade() {
    if (
        typeof updateArchiveControlsFromState ===
        "function"
    ) {
        updateArchiveControlsFromState();

        return;
    }

    elements.search.value =
        state.query;

    elements.year.value =
        state.year;

    elements.source.value =
        state.source;

    elements.status.value =
        state.status;

    document
        .querySelectorAll(
            ".format-option"
        )
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.format ===
                        state.format
                );
            }
        );

    document
        .querySelectorAll(
            ".topic-chip"
        )
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.topic ===
                        state.topic
                );
            }
        );
}

async function upgradeToFullTextArchive(
    archiveObject
) {
    const savedState = {
        query:
            state.query,

        topic:
            state.topic,

        format:
            state.format,

        year:
            state.year,

        source:
            state.source,

        status:
            state.status,

        exactPhraseOnly:
            state.exactPhraseOnly,

        page:
            state.page,

        pageSize:
            state.pageSize
    };

    const savedScrollPosition =
        window.scrollY;

    records =
        transformArchive(
            archiveObject
        );

    updateFormatControls();
    updateSelectControls();

    Object.assign(
        state,
        savedState
    );

    fullTextSearchReady =
        true;

    fullTextLoadingFailed =
        false;

    synchronizeControlsAfterUpgrade();

    setReady();
    render();

    requestAnimationFrame(
        () => {
            window.scrollTo(
                0,
                savedScrollPosition
            );
        }
    );
}

loadArchive = async function () {
    try {
        setLoading(
            "Opening archive…"
        );

        if (!searchDatabase) {
            searchDatabase =
                await openSearchDatabase();

            void requestPersistentArchiveStorage();
        }

        const cachedArchive =
            await readCachedArchive();

        if (cachedArchive) {
            fullTextSearchReady =
                true;

            fullTextLoadingFailed =
                false;

            await applyArchive(
                cachedArchive,
                "cache"
            );

            void refreshArchiveCacheInBackground(
                cachedArchive
            );

            return;
        }

        fullTextSearchReady =
            false;

        fullTextLoadingFailed =
            false;

        const fullArchiveRequest =
            fetchFullArchiveSilently()
                .then(
                    archiveObject => ({
                        archiveObject,
                        error: null
                    })
                )
                .catch(
                    error => ({
                        archiveObject:
                            null,
                        error
                    })
                );

        setLoading(
            "Opening archive index…"
        );

        const metadataArchive =
            await fetchArchiveMetadata();

        await applyArchive(
            metadataArchive,
            "metadata"
        );

        const fullArchiveResult =
            await fullArchiveRequest;

        if (
            fullArchiveResult.error ||
            !fullArchiveResult.archiveObject
        ) {
            console.error(
                fullArchiveResult.error
            );

            fullTextLoadingFailed =
                true;

            render();

            return;
        }

        await saveArchiveToCache(
            fullArchiveResult.archiveObject
        );

        await upgradeToFullTextArchive(
            fullArchiveResult.archiveObject
        );
    } catch (error) {
        setLoadError(error);
    }
};

ensurePaginationControls();
attachInterfaceEvents();
loadArchive();