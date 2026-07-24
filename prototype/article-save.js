(() => {
    "use strict";

    const STORAGE_KEY =
        "aajonusSavedRecordsV1";

    const header =
        document.querySelector(
            ".article-header"
        );

    const titleElement =
        document.querySelector(
            ".article-header h1"
        );

    if (!header || !titleElement) {
        return;
    }

    const recordId =
        window.location.pathname
            .replace(/\/+$/, "")
            .toLowerCase();

    const recordTitle =
        titleElement.textContent.trim();

    const kicker =
        document.querySelector(
            ".article-header .kicker"
        );

    const recordMeta =
        kicker
            ? kicker.textContent
                .replace(/\s+/g, " ")
                .trim()
            : "Archive record";

    function readStore() {
        try {
            const parsed =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_KEY
                    ) || "{}"
                );

            return (
                parsed &&
                typeof parsed === "object"
            )
                ? parsed
                : {};
        } catch (error) {
            console.error(
                "Saved records could not be read.",
                error
            );

            return {};
        }
    }

    function writeStore(store) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(store)
            );
        } catch (error) {
            console.error(
                "The record could not be saved.",
                error
            );
        }
    }

    const row =
        document.createElement(
            "div"
        );

    row.className =
        "article-save-row";

    const button =
        document.createElement(
            "button"
        );

    button.type =
        "button";

    button.className =
        "article-save-button";

    const note =
        document.createElement(
            "span"
        );

    note.className =
        "article-save-note";

    note.textContent =
        "Saved records remain in this browser.";

    row.append(
        button,
        note
    );

    const tools =
        header.querySelector(
            ".tools"
        );

    if (tools) {
        tools.insertAdjacentElement(
            "afterend",
            row
        );
    } else {
        header.appendChild(row);
    }

    function isSaved() {
        return Boolean(
            readStore()[recordId]
        );
    }

    function refreshButton() {
        const saved =
            isSaved();

        button.classList.toggle(
            "saved",
            saved
        );

        button.textContent =
            saved
                ? "Saved ✓"
                : "Save record";

        button.setAttribute(
            "aria-pressed",
            saved
                ? "true"
                : "false"
        );
    }

    button.addEventListener(
        "click",
        () => {
            const store =
                readStore();

            if (store[recordId]) {
                delete store[recordId];
            } else {
                store[recordId] = {
                    id:
                        recordId,

                    title:
                        recordTitle,

                    url:
                        window.location.pathname,

                    meta:
                        recordMeta,

                    savedAt:
                        Date.now()
                };
            }

            writeStore(store);
            refreshButton();
        }
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key ===
                STORAGE_KEY
            ) {
                refreshButton();
            }
        }
    );

    refreshButton();
})();
