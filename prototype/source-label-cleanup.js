(() => {
    "use strict";

    /*
     * Visible labels only.
     * Option values remain unchanged so the archive's
     * existing filtering and URL state continue working.
     */

    const LABELS = new Map([
        ["All sources", "All sources"],
        ["Books", "Books"],
        ["Community", "Community sources"],
        ["Interviews", "Interviews"],
        ["Misc", "Miscellaneous"],
        ["Newsletters", "Newsletters"],
        ["Old", "Legacy archive"],
        ["Other", "Other sources"],
        ["Q&A", "Questions & answers"],
        ["RawMilkOrg", "RawMilk.org"],
        ["Snippets", "Short excerpts"],
        ["Videos", "Videos"]
    ]);

    const KNOWN_VALUES = new Set(
        [
            ...LABELS.keys()
        ]
    );

    function cleanText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function isSourceSelect(select) {
        const identity = [
            select.id,
            select.name,
            select.getAttribute(
                "aria-label"
            ),
            ...[
                ...(select.labels || [])
            ].map(
                label =>
                    label.textContent
            )
        ]
            .join(" ")
            .toLowerCase();

        if (
            identity.includes("source")
        ) {
            return true;
        }

        const matchingOptions = [
            ...select.options
        ].filter(option => {
            const value =
                cleanText(option.value);

            const text =
                cleanText(
                    option.textContent
                );

            return (
                KNOWN_VALUES.has(value) ||
                KNOWN_VALUES.has(text)
            );
        }).length;

        return matchingOptions >= 5;
    }

    function originalOptionName(option) {
        if (
            option.dataset.originalSourceName
        ) {
            return option.dataset
                .originalSourceName;
        }

        const value =
            cleanText(option.value);

        const text =
            cleanText(
                option.textContent
            );

        const original =
            KNOWN_VALUES.has(value)
                ? value
                : text;

        option.dataset
            .originalSourceName =
            original;

        return original;
    }

    function cleanSelect(select) {
        if (!isSourceSelect(select)) {
            return;
        }

        [
            ...select.options
        ].forEach(option => {
            const original =
                originalOptionName(
                    option
                );

            const replacement =
                LABELS.get(original);

            if (!replacement) {
                return;
            }

            if (
                option.textContent !==
                replacement
            ) {
                option.textContent =
                    replacement;
            }
        });

        select.dataset
            .sourceLabelsCleaned =
            "true";

        select.setAttribute(
            "aria-label",
            "Filter archive by source"
        );
    }

    function cleanAllSourceSelects() {
        document
            .querySelectorAll("select")
            .forEach(cleanSelect);
    }

    function initialize() {
        cleanAllSourceSelects();

        /*
         * The filter panel may be redrawn after searches,
         * mode changes, or URL-state restoration.
         */

        let scheduled = false;

        const observer =
            new MutationObserver(() => {
                if (scheduled) {
                    return;
                }

                scheduled = true;

                window.requestAnimationFrame(
                    () => {
                        scheduled = false;
                        cleanAllSourceSelects();
                    }
                );
            });

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }
})();
