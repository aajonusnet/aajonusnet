const CACHE_DB_NAME = "myDatabase";
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = "myData";
const CACHE_KEY = "allData";
const CACHE_HOURS = 24;

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
                        cached.content &&
                        cached.expireTime >
                            Date.now()
                    ) {
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

            store.put({
                id: CACHE_KEY,
                content:
                    archiveObject,
                expireTime:
                    Date.now() +
                    CACHE_HOURS *
                    60 *
                    60 *
                    1000
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
            "../code/loadsearch.php",
            {
                cache: "no-store"
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

function cleanPreview(rawText) {
    return String(rawText)
        .slice(
            0,
            2200
        )
        .replace(
            /```[\s\S]*?```/g,
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
            /[#>*_`~|]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
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

    const previewText =
        cleanPreview(rawText);

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

            matches.push({
                ...record,
                _exactPhrase:
                    exactPhrase,
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
                record => `
                    <li class="record">
                        <div class="record-date">
                            ${escapeHtml(record.date)}
                        </div>

                        <div class="record-main">
                            <h3>
                                <a href="${buildArticleUrl(record)}">
                                    ${escapeHtml(record.title)}
                                </a>
                            </h3>

                            <p>
                                ${escapeHtml(record.note)}
                            </p>

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

                            <small>
                                ${escapeHtml(record.source)}
                                <br>
                                ${escapeHtml(record.status)}
                            </small>
                        </div>
                    </li>
                `
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
        elements.mobileFilterButton
    ) {
        elements
            .mobileFilterButton
            .addEventListener(
                "click",
                () => {
                    elements
                        .filters
                        .classList
                        .toggle(
                            "open"
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
        }

        const cachedArchive =
            await readCachedArchive();

        if (cachedArchive) {
            await applyArchive(
                cachedArchive,
                "cache"
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

window.addEventListener(
    "pagehide",
    saveArchiveState
);

ensurePaginationControls();
attachInterfaceEvents();
loadArchive();