(() => {
    "use strict";

    const STORAGE_KEY =
        "aajonusArticleNotesV1";

    const PANEL_ID =
        "notesLibrary";

    function readNotes() {
        try {
            const parsed =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_KEY
                    ) || "{}"
                );

            if (
                !parsed ||
                typeof parsed !== "object"
            ) {
                return {};
            }

            return parsed;
        } catch (error) {
            console.error(
                "Research notes could not be read.",
                error
            );

            return {};
        }
    }

    function writeNotes(store) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(store)
        );
    }

    function noteRecords() {
        return Object.entries(
            readNotes()
        )
            .map(
                ([id, note]) => ({
                    id,
                    ...note
                })
            )
            .filter(note => {
                return (
                    typeof note.title ===
                        "string" &&
                    typeof note.url ===
                        "string" &&
                    typeof note.text ===
                        "string" &&
                    note.text.trim() !== ""
                );
            })
            .sort(
                (first, second) =>
                    Number(
                        second.updatedAt
                    ) -
                    Number(
                        first.updatedAt
                    )
            );
    }

    function formatDate(timestamp) {
        if (!timestamp) {
            return "Date unavailable";
        }

        return new Date(
            timestamp
        ).toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
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
        const savedRecordsPanel =
            document.getElementById(
                "savedRecordsPanel"
            );

        if (savedRecordsPanel) {
            savedRecordsPanel
                .insertAdjacentElement(
                    "afterend",
                    panel
                );

            return;
        }

        const timeline =
            document.getElementById(
                "timeline"
            );

        if (timeline) {
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

        if (archive) {
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

    function exportNotes(notes) {
        const contents =
            notes
                .map(
                    (note, index) => [
                        `NOTE ${index + 1}`,
                        note.title,
                        note.url,
                        `Updated: ${formatDate(
                            note.updatedAt
                        )}`,
                        "",
                        note.text.trim(),
                        "",
                        "----------------------------------------",
                        ""
                    ].join("\n")
                )
                .join("\n");

        const blob =
            new Blob(
                [contents],
                {
                    type:
                        "text/plain;charset=utf-8"
                }
            );

        const objectUrl =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                "a"
            );

        link.href =
            objectUrl;

        link.download =
            "aajonus-research-notes.txt";

        document.body.appendChild(
            link
        );

        link.click();
        link.remove();

        URL.revokeObjectURL(
            objectUrl
        );
    }

    function renderLibrary() {
        removePanel();

        const notes =
            noteRecords();

        if (!notes.length) {
            document.dispatchEvent(
                new CustomEvent(
                    "aajonus:notes-updated",
                    { detail: { count: 0 } }
                )
            );

            return;
        }

        const panel =
            document.createElement(
                "section"
            );

        panel.id =
            PANEL_ID;

        panel.className =
            "notes-library";

        panel.setAttribute(
            "aria-label",
            "Research notes library"
        );

        const header =
            document.createElement(
                "header"
            );

        header.className =
            "notes-library-header";

        const heading =
            document.createElement(
                "div"
            );

        const kicker =
            document.createElement(
                "p"
            );

        kicker.className =
            "notes-library-kicker";

        kicker.textContent =
            "Private workspace";

        const title =
            document.createElement(
                "h2"
            );

        title.className =
            "notes-library-title";

        title.textContent =
            `Research notes (${notes.length})`;

        heading.append(
            kicker,
            title
        );

        const tools =
            document.createElement(
                "div"
            );

        tools.className =
            "notes-library-tools";

        const exportButton =
            document.createElement(
                "button"
            );

        exportButton.type =
            "button";

        exportButton.className =
            "notes-library-button";

        exportButton.textContent =
            "Export all";

        const clearButton =
            document.createElement(
                "button"
            );

        clearButton.type =
            "button";

        clearButton.className =
            "notes-library-button danger";

        clearButton.textContent =
            "Clear all notes";

        tools.append(
            exportButton,
            clearButton
        );

        header.append(
            heading,
            tools
        );

        const search =
            document.createElement(
                "input"
            );

        search.type =
            "search";

        search.className =
            "notes-library-search";

        search.placeholder =
            "Search your research notes";

        const count =
            document.createElement(
                "p"
            );

        count.className =
            "notes-library-count";

        const list =
            document.createElement(
                "ul"
            );

        list.className =
            "notes-library-list";

        panel.append(
            header,
            search,
            count,
            list
        );

        function drawNotes() {
            const query =
                search.value
                    .trim()
                    .toLowerCase();

            const visible =
                notes.filter(note => {
                    return (
                        !query ||
                        note.title
                            .toLowerCase()
                            .includes(query) ||
                        note.text
                            .toLowerCase()
                            .includes(query)
                    );
                });

            count.textContent =
                `${visible.length} of ${notes.length} ${
                    notes.length === 1
                        ? "note"
                        : "notes"
                }`;

            list.innerHTML = "";

            visible.forEach(note => {
                const item =
                    document.createElement(
                        "li"
                    );

                item.className =
                    "notes-library-item";

                const itemHeader =
                    document.createElement(
                        "div"
                    );

                itemHeader.className =
                    "notes-library-item-header";

                const articleLink =
                    document.createElement(
                        "a"
                    );

                articleLink.className =
                    "notes-library-item-title";

                articleLink.href =
                    note.url;

                articleLink.textContent =
                    note.title;

                const date =
                    document.createElement(
                        "span"
                    );

                date.className =
                    "notes-library-date";

                date.textContent =
                    formatDate(
                        note.updatedAt
                    );

                itemHeader.append(
                    articleLink,
                    date
                );

                const preview =
                    document.createElement(
                        "p"
                    );

                preview.className =
                    "notes-library-preview";

                preview.textContent =
                    note.text.trim();

                const actions =
                    document.createElement(
                        "div"
                    );

                actions.className =
                    "notes-library-actions";

                const openLink =
                    document.createElement(
                        "a"
                    );

                openLink.className =
                    "notes-library-action";

                openLink.href =
                    note.url;

                openLink.textContent =
                    "Open record";

                const copyButton =
                    document.createElement(
                        "button"
                    );

                copyButton.type =
                    "button";

                copyButton.className =
                    "notes-library-action";

                copyButton.textContent =
                    "Copy note";

                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.type =
                    "button";

                deleteButton.className =
                    "notes-library-action";

                deleteButton.textContent =
                    "Delete";

                copyButton.addEventListener(
                    "click",
                    async () => {
                        try {
                            await navigator
                                .clipboard
                                .writeText(
                                    note.text
                                );

                            copyButton.textContent =
                                "Copied ✓";
                        } catch {
                            copyButton.textContent =
                                "Copy failed";
                        }

                        window.setTimeout(
                            () => {
                                copyButton.textContent =
                                    "Copy note";
                            },
                            1400
                        );
                    }
                );

                deleteButton.addEventListener(
                    "click",
                    () => {
                        const confirmed =
                            window.confirm(
                                `Delete the note for “${note.title}”?`
                            );

                        if (!confirmed) {
                            return;
                        }

                        const store =
                            readNotes();

                        delete store[note.id];

                        writeNotes(store);
                        renderLibrary();
                    }
                );

                actions.append(
                    openLink,
                    copyButton,
                    deleteButton
                );

                item.append(
                    itemHeader,
                    preview,
                    actions
                );

                list.appendChild(
                    item
                );
            });

            if (!visible.length) {
                const empty =
                    document.createElement(
                        "li"
                    );

                empty.className =
                    "notes-library-empty";

                empty.textContent =
                    "No notes match this search.";

                list.appendChild(
                    empty
                );
            }
        }

        search.addEventListener(
            "input",
            drawNotes
        );

        exportButton.addEventListener(
            "click",
            () => {
                exportNotes(notes);
            }
        );

        clearButton.addEventListener(
            "click",
            () => {
                const confirmed =
                    window.confirm(
                        "Delete every saved research note?"
                    );

                if (!confirmed) {
                    return;
                }

                localStorage.removeItem(
                    STORAGE_KEY
                );

                renderLibrary();
            }
        );

        insertPanel(panel);
        drawNotes();

        document.dispatchEvent(
            new CustomEvent(
                "aajonus:notes-updated",
                { detail: { count: notes.length } }
            )
        );
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            renderLibrary,
            {
                once: true
            }
        );
    } else {
        renderLibrary();
    }

    window.addEventListener(
        "pageshow",
        renderLibrary
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key ===
                STORAGE_KEY
            ) {
                renderLibrary();
            }
        }
    );
})();
