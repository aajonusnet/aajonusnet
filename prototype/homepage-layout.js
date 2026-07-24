(() => {
    "use strict";

    const NOTES_STORAGE_KEY =
        "aajonusArticleNotesV1";

    const SHORTCUT_ID =
        "notesShortcut";

    function readNoteCount() {
        try {
            const stored = JSON.parse(
                localStorage.getItem(
                    NOTES_STORAGE_KEY
                ) || "{}"
            );

            if (
                !stored ||
                typeof stored !== "object"
            ) {
                return 0;
            }

            return Object.values(stored)
                .filter(note => {
                    return (
                        note &&
                        typeof note.text ===
                            "string" &&
                        note.text.trim() !== ""
                    );
                })
                .length;
        } catch (error) {
            console.warn(
                "Research-note count could not be read.",
                error
            );

            return 0;
        }
    }

    function moveAfter(reference, element) {
        if (
            !reference ||
            !element ||
            reference === element
        ) {
            return reference;
        }

        reference.insertAdjacentElement(
            "afterend",
            element
        );

        return element;
    }

    function arrangeHomepage() {
        const main =
            document.querySelector(
                "main.page"
            );

        const search =
            document.querySelector(
                ".search-section"
            );

        if (!main || !search) {
            return;
        }

        const orderedSections = [
            document.getElementById(
                "continueReadingCard"
            ),
            document.getElementById(
                "archive"
            ),
            document.getElementById(
                "collections"
            ),
            document.getElementById(
                "featuredArchive"
            ),
            document.getElementById(
                "savedRecordsPanel"
            ),
            document.getElementById(
                "notesLibrary"
            ),
            document.getElementById(
                "timeline"
            ),
            main.querySelector(
                ":scope > .archive-features"
            ),
            main.querySelector(
                ":scope > .site-footer"
            )
        ];

        let cursor = search;

        orderedSections.forEach(section => {
            if (!section) {
                return;
            }

            cursor = moveAfter(
                cursor,
                section
            );
        });
    }

    function scrollToNotes() {
        const notes =
            document.getElementById(
                "notesLibrary"
            );

        if (!notes) {
            return;
        }

        notes.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        window.setTimeout(() => {
            const search =
                notes.querySelector(
                    ".notes-library-search"
                );

            search?.focus({
                preventScroll: true
            });
        }, 500);
    }

    function ensureNotesShortcut() {
        const navigation =
            document.querySelector(
                ".top-nav"
            );

        if (!navigation) {
            return null;
        }

        let shortcut =
            document.getElementById(
                SHORTCUT_ID
            );

        if (shortcut) {
            return shortcut;
        }

        shortcut =
            document.createElement(
                "button"
            );

        shortcut.id = SHORTCUT_ID;
        shortcut.type = "button";
        shortcut.className =
            "notes-shortcut";

        shortcut.addEventListener(
            "click",
            scrollToNotes
        );

        const switcher =
            navigation.querySelector(
                ".display-mode-switcher"
            );

        if (switcher) {
            navigation.insertBefore(
                shortcut,
                switcher
            );
        } else {
            navigation.appendChild(
                shortcut
            );
        }

        return shortcut;
    }

    function updateNotesShortcut(
        suppliedCount = null
    ) {
        const shortcut =
            ensureNotesShortcut();

        if (!shortcut) {
            return;
        }

        const count =
            Number.isFinite(
                Number(suppliedCount)
            )
                ? Number(suppliedCount)
                : readNoteCount();

        shortcut.hidden = count < 1;
        shortcut.textContent =
            `Notes (${count})`;

        shortcut.setAttribute(
            "aria-label",
            count === 1
                ? "Open 1 research note"
                : `Open ${count} research notes`
        );
    }

    function initialize() {
        arrangeHomepage();
        updateNotesShortcut();

        document.addEventListener(
            "aajonus:notes-updated",
            event => {
                arrangeHomepage();
                updateNotesShortcut(
                    event.detail?.count
                );
            }
        );

        window.addEventListener(
            "storage",
            event => {
                if (
                    event.key ===
                    NOTES_STORAGE_KEY
                ) {
                    updateNotesShortcut();
                }
            }
        );

        window.addEventListener(
            "pageshow",
            () => {
                arrangeHomepage();
                updateNotesShortcut();
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
            { once: true }
        );
    } else {
        initialize();
    }
})();
