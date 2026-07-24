(() => {
    "use strict";

    const STORAGE_KEY =
        "aajonusReadingProgressV1";

    const DISMISSED_KEY =
        "aajonusContinueReadingDismissedV1";

    const CARD_ID =
        "continueReadingCard";

    function readProgressStore() {
        try {
            const stored =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_KEY
                    ) || "{}"
                );

            return (
                stored &&
                typeof stored === "object"
            )
                ? stored
                : {};
        } catch (error) {
            console.error(
                "Reading progress could not be read.",
                error
            );

            return {};
        }
    }

    function latestIncompleteRecord() {
        const records =
            Object.values(
                readProgressStore()
            );

        return records
            .filter(record => {
                const percentage =
                    Number(record.percent);

                return (
                    record &&
                    typeof record.title ===
                        "string" &&
                    typeof record.url ===
                        "string" &&
                    percentage >= 3 &&
                    percentage < 95 &&
                    record.completed !== true
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
            )[0] || null;
    }

    function recordIdentity(record) {
        return [
            record.url,
            record.updatedAt,
            record.percent
        ].join("|");
    }

    function wasDismissed(record) {
        return (
            sessionStorage.getItem(
                DISMISSED_KEY
            ) ===
            recordIdentity(record)
        );
    }

    function removeExistingCard() {
        document
            .getElementById(
                CARD_ID
            )
            ?.remove();
    }

    function insertCard(card) {
        const searchSection =
            document.querySelector(
                ".search-section"
            );

        if (
            searchSection &&
            searchSection.parentElement
        ) {
            searchSection.insertAdjacentElement(
                "afterend",
                card
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
                "beforebegin",
                card
            );

            return;
        }

        const main =
            document.querySelector(
                "main"
            );

        if (main) {
            main.prepend(card);
        }
    }

    function renderContinueReading() {
        removeExistingCard();

        const record =
            latestIncompleteRecord();

        if (
            !record ||
            wasDismissed(record)
        ) {
            return;
        }

        const percentage =
            Math.round(
                Number(record.percent)
            );

        const card =
            document.createElement(
                "section"
            );

        card.id =
            CARD_ID;

        card.className =
            "continue-reading-card";

        card.setAttribute(
            "aria-label",
            "Continue reading"
        );

        const content =
            document.createElement(
                "div"
            );

        content.className =
            "continue-reading-content";

        const label =
            document.createElement(
                "p"
            );

        label.className =
            "continue-reading-label";

        label.textContent =
            "Continue reading";

        const title =
            document.createElement(
                "a"
            );

        title.className =
            "continue-reading-title";

        title.href =
            record.url;

        title.textContent =
            record.title;

        const metadata =
            document.createElement(
                "p"
            );

        metadata.className =
            "continue-reading-meta";

        metadata.textContent =
            `Last position: ${percentage}% through this record`;

        const progress =
            document.createElement(
                "div"
            );

        progress.className =
            "continue-reading-progress";

        progress.setAttribute(
            "aria-hidden",
            "true"
        );

        const progressValue =
            document.createElement(
                "div"
            );

        progressValue.className =
            "continue-reading-progress-value";

        progressValue.style.width =
            `${percentage}%`;

        progress.appendChild(
            progressValue
        );

        content.append(
            label,
            title,
            metadata,
            progress
        );

        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "continue-reading-actions";

        const continueLink =
            document.createElement(
                "a"
            );

        continueLink.className =
            "continue-reading-button";

        continueLink.href =
            record.url;

        continueLink.textContent =
            "Continue";

        const dismissButton =
            document.createElement(
                "button"
            );

        dismissButton.type =
            "button";

        dismissButton.className =
            "continue-reading-button secondary";

        dismissButton.textContent =
            "Dismiss";

        dismissButton.addEventListener(
            "click",
            () => {
                sessionStorage.setItem(
                    DISMISSED_KEY,
                    recordIdentity(
                        record
                    )
                );

                card.remove();
            }
        );

        actions.append(
            continueLink,
            dismissButton
        );

        card.append(
            content,
            actions
        );

        insertCard(card);
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            renderContinueReading,
            {
                once: true
            }
        );
    } else {
        renderContinueReading();
    }

    window.addEventListener(
        "pageshow",
        renderContinueReading
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key ===
                STORAGE_KEY
            ) {
                renderContinueReading();
            }
        }
    );
})();
