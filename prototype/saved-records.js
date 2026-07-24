(() => {
    "use strict";

    const STORAGE_KEY =
        "aajonusSavedRecordsV1";

    const PANEL_ID =
        "savedRecordsPanel";

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
                "Saved records could not be updated.",
                error
            );
        }
    }

    function savedRecords() {
        return Object.values(
            readStore()
        )
            .filter(record => {
                return (
                    record &&
                    typeof record.title ===
                        "string" &&
                    typeof record.url ===
                        "string"
                );
            })
            .sort(
                (first, second) =>
                    Number(
                        second.savedAt
                    ) -
                    Number(
                        first.savedAt
                    )
            );
    }

    function removePanel() {
        document
            .getElementById(
                PANEL_ID
            )
            ?.remove();
    }

    function insertPanel(panel) {
        const timeline =
            document.getElementById(
                "timeline"
            );

        if (
            timeline &&
            timeline.parentElement
        ) {
            timeline.insertAdjacentElement(
                "beforebegin",
                panel
            );

            return;
        }

        const archive =
            document.getElementById(
                "archive"
            );

        if (
            archive &&
            archive.parentElement
        ) {
            archive.insertAdjacentElement(
                "afterend",
                panel
            );

            return;
        }

        const main =
            document.querySelector(
                "main"
            );

        if (main) {
            main.append(panel);
        }
    }

    function render() {
        removePanel();

        const records =
            savedRecords();

        if (!records.length) {
            return;
        }

        const panel =
            document.createElement(
                "section"
            );

        panel.id =
            PANEL_ID;

        panel.className =
            "saved-records-panel";

        panel.setAttribute(
            "aria-label",
            "Saved archive records"
        );

        const heading =
            document.createElement(
                "header"
            );

        heading.className =
            "saved-records-heading";

        const headingText =
            document.createElement(
                "div"
            );

        const kicker =
            document.createElement(
                "p"
            );

        kicker.className =
            "saved-records-kicker";

        kicker.textContent =
            "Personal reading list";

        const title =
            document.createElement(
                "h2"
            );

        title.textContent =
            `Saved records (${records.length})`;

        headingText.append(
            kicker,
            title
        );

        const clearButton =
            document.createElement(
                "button"
            );

        clearButton.type =
            "button";

        clearButton.className =
            "saved-records-clear";

        clearButton.textContent =
            "Clear all";

        clearButton.addEventListener(
            "click",
            () => {
                localStorage.removeItem(
                    STORAGE_KEY
                );

                render();
            }
        );

        heading.append(
            headingText,
            clearButton
        );

        const list =
            document.createElement(
                "ul"
            );

        list.className =
            "saved-records-list";

        records.forEach(record => {
            const item =
                document.createElement(
                    "li"
                );

            item.className =
                "saved-record";

            const information =
                document.createElement(
                    "div"
                );

            const link =
                document.createElement(
                    "a"
                );

            link.className =
                "saved-record-title";

            link.href =
                record.url;

            link.textContent =
                record.title;

            const metadata =
                document.createElement(
                    "p"
                );

            metadata.className =
                "saved-record-meta";

            metadata.textContent =
                record.meta ||
                "Archive record";

            information.append(
                link,
                metadata
            );

            const removeButton =
                document.createElement(
                    "button"
                );

            removeButton.type =
                "button";

            removeButton.className =
                "saved-record-remove";

            removeButton.textContent =
                "×";

            removeButton.title =
                "Remove saved record";

            removeButton.setAttribute(
                "aria-label",
                `Remove ${record.title}`
            );

            removeButton.addEventListener(
                "click",
                () => {
                    const store =
                        readStore();

                    delete store[
                        record.id
                    ];

                    writeStore(store);
                    render();
                }
            );

            item.append(
                information,
                removeButton
            );

            list.appendChild(item);
        });

        panel.append(
            heading,
            list
        );

        insertPanel(panel);
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            render,
            {
                once: true
            }
        );
    } else {
        render();
    }

    window.addEventListener(
        "pageshow",
        render
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key ===
                STORAGE_KEY
            ) {
                render();
            }
        }
    );
})();
