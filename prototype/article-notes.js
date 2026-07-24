(() => {
    "use strict";

    const STORAGE_KEY =
        "aajonusArticleNotesV1";

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

    const recordKey =
        window.location.pathname
            .replace(/\/+$/, "")
            .toLowerCase();

    const recordTitle =
        titleElement.textContent.trim() ||
        document.title;

    const recordUrl =
        window.location.pathname +
        window.location.search;

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
                "Article notes were invalid.",
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
                "Article notes failed to save.",
                error
            );
        }
    }

    function currentRecord() {
        return (
            readStore()[recordKey] ||
            null
        );
    }

    function formatSavedTime(timestamp) {
        if (!timestamp) {
            return "";
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

    function safeFilename(value) {
        const cleaned =
            value
                .replace(
                    /[^a-z0-9]+/gi,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                )
                .toLowerCase();

        return (
            cleaned ||
            "archive-note"
        );
    }

    const shell =
        document.createElement(
            "section"
        );

    shell.className =
        "article-notes-shell";

    const toggleRow =
        document.createElement(
            "div"
        );

    toggleRow.className =
        "article-notes-toggle-row";

    const toggleButton =
        document.createElement(
            "button"
        );

    toggleButton.type =
        "button";

    toggleButton.className =
        "article-notes-toggle";

    toggleButton.setAttribute(
        "aria-expanded",
        "false"
    );

    const summary =
        document.createElement(
            "span"
        );

    summary.className =
        "article-notes-summary";

    toggleRow.append(
        toggleButton,
        summary
    );

    const panel =
        document.createElement(
            "div"
        );

    panel.className =
        "article-notes-panel";

    panel.hidden = true;

    const heading =
        document.createElement(
            "header"
        );

    heading.className =
        "article-notes-heading";

    const headingText =
        document.createElement(
            "div"
        );

    const kicker =
        document.createElement(
            "p"
        );

    kicker.className =
        "article-notes-kicker";

    kicker.textContent =
        "Private workspace";

    const headingTitle =
        document.createElement(
            "h2"
        );

    headingTitle.textContent =
        "Research notes";

    headingText.append(
        kicker,
        headingTitle
    );

    const status =
        document.createElement(
            "span"
        );

    status.className =
        "article-notes-status";

    heading.append(
        headingText,
        status
    );

    const textarea =
        document.createElement(
            "textarea"
        );

    textarea.className =
        "article-notes-textarea";

    textarea.placeholder =
        "Write observations, quotations, questions, corrections, or follow-up ideas…";

    textarea.setAttribute(
        "aria-label",
        `Research notes for ${recordTitle}`
    );

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "article-notes-actions";

    const copyButton =
        document.createElement(
            "button"
        );

    copyButton.type =
        "button";

    copyButton.className =
        "article-notes-action";

    copyButton.textContent =
        "Copy note";

    const exportButton =
        document.createElement(
            "button"
        );

    exportButton.type =
        "button";

    exportButton.className =
        "article-notes-action";

    exportButton.textContent =
        "Export note";

    const clearButton =
        document.createElement(
            "button"
        );

    clearButton.type =
        "button";

    clearButton.className =
        "article-notes-action danger";

    clearButton.textContent =
        "Clear note";

    const privacy =
        document.createElement(
            "p"
        );

    privacy.className =
        "article-notes-privacy";

    privacy.textContent =
        "This note stays in this browser and is not sent to the archive server.";

    actions.append(
        copyButton,
        exportButton,
        clearButton
    );

    panel.append(
        heading,
        textarea,
        actions,
        privacy
    );

    shell.append(
        toggleRow,
        panel
    );

    const tools =
        header.querySelector(
            ".tools"
        );

    if (tools) {
        tools.insertAdjacentElement(
            "afterend",
            shell
        );
    } else {
        header.appendChild(shell);
    }

    let saveTimer = null;

    function refreshDisplay() {
        const record =
            currentRecord();

        const hasNote =
            Boolean(
                record &&
                typeof record.text ===
                    "string" &&
                record.text.trim()
            );

        toggleButton.textContent =
            hasNote
                ? "Research notes • saved"
                : "Research notes";

        toggleButton.classList.toggle(
            "active",
            !panel.hidden
        );

        summary.textContent =
            hasNote
                ? `${record.text.trim().length.toLocaleString()} characters`
                : "No note saved";

        clearButton.disabled =
            !hasNote;

        if (record?.updatedAt) {
            status.textContent =
                `Saved ${formatSavedTime(
                    record.updatedAt
                )}`;
        } else {
            status.textContent =
                "Not saved";
        }
    }

    function saveNote() {
        const text =
            textarea.value;

        const store =
            readStore();

        if (!text.trim()) {
            delete store[recordKey];

            writeStore(store);

            status.textContent =
                "Empty note removed";

            refreshDisplay();
            return;
        }

        const updatedAt =
            Date.now();

        store[recordKey] = {
            title:
                recordTitle,

            url:
                recordUrl,

            text,

            updatedAt
        };

        writeStore(store);

        status.textContent =
            `Saved ${formatSavedTime(
                updatedAt
            )}`;

        refreshDisplay();
    }

    function loadNote() {
        const record =
            currentRecord();

        textarea.value =
            typeof record?.text ===
                "string"
                ? record.text
                : "";

        refreshDisplay();
    }

    toggleButton.addEventListener(
        "click",
        () => {
            panel.hidden =
                !panel.hidden;

            toggleButton.setAttribute(
                "aria-expanded",
                panel.hidden
                    ? "false"
                    : "true"
            );

            refreshDisplay();

            if (!panel.hidden) {
                textarea.focus();
            }
        }
    );

    textarea.addEventListener(
        "input",
        () => {
            clearTimeout(
                saveTimer
            );

            status.textContent =
                "Saving…";

            saveTimer =
                window.setTimeout(
                    saveNote,
                    450
                );
        }
    );

    textarea.addEventListener(
        "blur",
        () => {
            clearTimeout(
                saveTimer
            );

            saveNote();
        }
    );

    copyButton.addEventListener(
        "click",
        async () => {
            const text =
                textarea.value.trim();

            if (!text) {
                copyButton.textContent =
                    "Nothing to copy";

                window.setTimeout(
                    () => {
                        copyButton.textContent =
                            "Copy note";
                    },
                    1300
                );

                return;
            }

            try {
                await navigator
                    .clipboard
                    .writeText(
                        text
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

    exportButton.addEventListener(
        "click",
        () => {
            const text =
                textarea.value.trim();

            if (!text) {
                exportButton.textContent =
                    "Nothing to export";

                window.setTimeout(
                    () => {
                        exportButton.textContent =
                            "Export note";
                    },
                    1300
                );

                return;
            }

            const contents = [
                recordTitle,
                recordUrl,
                "",
                text
            ].join("\n");

            const blob =
                new Blob(
                    [contents],
                    {
                        type:
                            "text/plain;charset=utf-8"
                    }
                );

            const temporaryUrl =
                URL.createObjectURL(
                    blob
                );

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                temporaryUrl;

            link.download =
                `${safeFilename(
                    recordTitle
                )}-notes.txt`;

            document.body.appendChild(
                link
            );

            link.click();
            link.remove();

            URL.revokeObjectURL(
                temporaryUrl
            );

            exportButton.textContent =
                "Exported ✓";

            window.setTimeout(
                () => {
                    exportButton.textContent =
                        "Export note";
                },
                1400
            );
        }
    );

    clearButton.addEventListener(
        "click",
        () => {
            const confirmed =
                window.confirm(
                    "Clear the saved note for this article?"
                );

            if (!confirmed) {
                return;
            }

            const store =
                readStore();

            delete store[recordKey];

            writeStore(store);

            textarea.value = "";

            status.textContent =
                "Note cleared";

            refreshDisplay();
        }
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key ===
                STORAGE_KEY
            ) {
                loadNote();
            }
        }
    );

    loadNote();
})();
