(() => {
    "use strict";

    const STORAGE_KEY = "aajonusDisplayModeV1";
    const DEFAULT_MODE = "archive";
    const VALID_MODES = new Set(["archive", "earthlight"]);

    const FEATURE_ITEMS = [
        {
            label: "390 indexed archive records",
            icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6.5 8.5h7.2a4.3 4.3 0 0 1 4.3 4.3v12.7H10a3.5 3.5 0 0 0-3.5 3.5V8.5Z"/><path d="M25.5 8.5h-7.2a4.3 4.3 0 0 0-4.3 4.3v12.7h8a3.5 3.5 0 0 1 3.5 3.5V8.5Z"/></svg>',
        },
        {
            label: "Private, on-device search",
            icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="13" width="18" height="14" rx="2.5"/><path d="M11 13V9a5 5 0 0 1 10 0v4"/><path d="M16 18v4"/></svg>',
        },
        {
            label: "No ads, trackers, or third parties",
            icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4.5 25 8v7.2c0 6.3-3.8 10.5-9 12.3-5.2-1.8-9-6-9-12.3V8l9-3.5Z"/><path d="m11.7 16 2.8 2.8 5.8-6"/></svg>',
        },
        {
            label: "Stored locally after the first visit",
            icon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 9.5h18v17H7z"/><path d="M10 9.5V5.8h12v3.7"/><path d="M11 15h10M11 20h7"/></svg>',
        },
    ];

    function readMode() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return VALID_MODES.has(saved) ? saved : DEFAULT_MODE;
        } catch {
            return DEFAULT_MODE;
        }
    }

    function writeMode(mode) {
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // The visual mode still works for the current page when storage
            // is unavailable, such as in a locked-down private session.
        }
    }

    function updateThemeColor(mode) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute(
                "content",
                mode === "earthlight" ? "#f6f2e8" : "#f5f0e5"
            );
        }
    }

    function updateButtons(mode) {
        document.querySelectorAll("[data-display-mode-choice]").forEach((button) => {
            const active = button.dataset.displayModeChoice === mode;
            button.setAttribute("aria-pressed", String(active));
        });
    }

    function markPageType() {
        const root = document.documentElement;
        const isHome = Boolean(document.querySelector(".intro"));
        root.classList.toggle("page-home", isHome);
        root.classList.toggle("page-article", !isHome);
    }

    function ensureHeroFeatures() {
        const introContent = document.querySelector(".intro > div:first-child");
        if (!introContent || introContent.querySelector(".earthlight-hero-features")) {
            return;
        }

        const list = document.createElement("ul");
        list.className = "earthlight-hero-features";
        list.setAttribute("aria-label", "Archive features");

        FEATURE_ITEMS.forEach(({ label, icon }) => {
            const item = document.createElement("li");
            const iconWrap = document.createElement("span");
            const text = document.createElement("span");

            iconWrap.className = "earthlight-feature-icon";
            iconWrap.innerHTML = icon;
            text.textContent = label;

            item.append(iconWrap, text);
            list.append(item);
        });

        introContent.append(list);
    }

    function applyMode(mode, persist = true) {
        const next = VALID_MODES.has(mode) ? mode : DEFAULT_MODE;
        document.documentElement.dataset.displayMode = next;
        updateThemeColor(next);
        updateButtons(next);

        if (persist) {
            writeMode(next);
        }

        document.dispatchEvent(
            new CustomEvent("aajonus:display-mode-change", {
                detail: { mode: next },
            })
        );
    }

    function initialize() {
        markPageType();
        ensureHeroFeatures();

        const initial = document.documentElement.dataset.displayMode || readMode();
        applyMode(initial, false);

        document.addEventListener("click", (event) => {
            const button = event.target.closest("[data-display-mode-choice]");
            if (!button) return;

            applyMode(button.dataset.displayModeChoice);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
