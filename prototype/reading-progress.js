(() => {
    "use strict";

    const STORAGE_KEY =
        "aajonusReadingProgressV1";

    const article =
        document.getElementById(
            "articleBody"
        );

    const titleElement =
        document.querySelector(
            ".article-header h1"
        );

    if (!article || !titleElement) {
        return;
    }

    const recordKey =
        window.location.pathname;

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
                "Saved reading progress was invalid.",
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
                "Reading progress failed to save.",
                error
            );
        }
    }

    function articleBoundaries() {
        const articleTop =
            article.getBoundingClientRect().top +
            window.scrollY;

        const articleBottom =
            articleTop +
            article.offsetHeight;

        const start =
            Math.max(
                0,
                articleTop -
                window.innerHeight * 0.2
            );

        const end =
            Math.max(
                start + 1,
                articleBottom -
                window.innerHeight * 0.75
            );

        return {
            start,
            end
        };
    }

    function currentProgress() {
        const boundaries =
            articleBoundaries();

        const rawProgress =
            (
                window.scrollY -
                boundaries.start
            ) /
            (
                boundaries.end -
                boundaries.start
            );

        const percent =
            Math.min(
                100,
                Math.max(
                    0,
                    rawProgress * 100
                )
            );

        return {
            scrollY:
                Math.round(
                    window.scrollY
                ),

            percent:
                Math.round(
                    percent * 10
                ) / 10
        };
    }

    const progressTrack =
        document.createElement("div");

    progressTrack.className =
        "reading-progress-track";

    progressTrack.setAttribute(
        "aria-hidden",
        "true"
    );

    const progressValue =
        document.createElement("div");

    progressValue.className =
        "reading-progress-value";

    progressTrack.appendChild(
        progressValue
    );

    document.body.appendChild(
        progressTrack
    );

    const initialStore =
        readStore();

    const savedProgress =
        initialStore[recordKey];

    const resumeEligible =
        Boolean(
            savedProgress &&
            Number(
                savedProgress.percent
            ) >= 3 &&
            Number(
                savedProgress.percent
            ) < 95 &&
            Number(
                savedProgress.scrollY
            ) > 120
        );

    let savingEnabled =
        !resumeEligible;

    let animationFrame = null;
    let lastSavedAt = 0;

    function updateProgressBar() {
        const progress =
            currentProgress();

        progressValue.style.width =
            `${progress.percent}%`;

        return progress;
    }

    function saveProgress(force = false) {
        if (!savingEnabled) {
            updateProgressBar();
            return;
        }

        const now =
            Date.now();

        if (
            !force &&
            now - lastSavedAt < 500
        ) {
            updateProgressBar();
            return;
        }

        lastSavedAt = now;

        const progress =
            updateProgressBar();

        const store =
            readStore();

        store[recordKey] = {
            title:
                recordTitle,

            url:
                recordUrl,

            scrollY:
                progress.scrollY,

            percent:
                progress.percent,

            completed:
                progress.percent >= 95,

            updatedAt:
                now
        };

        writeStore(store);
    }

    function enableSaving() {
        savingEnabled = true;
    }

    window.addEventListener(
        "wheel",
        enableSaving,
        {
            passive: true,
            once: true
        }
    );

    window.addEventListener(
        "touchstart",
        enableSaving,
        {
            passive: true,
            once: true
        }
    );

    window.addEventListener(
        "keydown",
        enableSaving,
        {
            once: true
        }
    );

    window.addEventListener(
        "scroll",
        () => {
            if (
                animationFrame !== null
            ) {
                return;
            }

            animationFrame =
                requestAnimationFrame(
                    () => {
                        animationFrame =
                            null;

                        saveProgress();
                    }
                );
        },
        {
            passive: true
        }
    );

    window.addEventListener(
        "resize",
        updateProgressBar
    );

    window.addEventListener(
        "pagehide",
        () => {
            if (savingEnabled) {
                saveProgress(true);
            }
        }
    );

    if (resumeEligible) {
        const panel =
            document.createElement(
                "aside"
            );

        panel.className =
            "reading-resume-panel";

        panel.setAttribute(
            "aria-label",
            "Continue reading"
        );

        const label =
            document.createElement("p");

        label.className =
            "reading-resume-label";

        label.textContent =
            "Continue reading";

        const heading =
            document.createElement("h2");

        heading.textContent =
            recordTitle;

        const description =
            document.createElement("p");

        description.className =
            "reading-resume-description";

        description.textContent =
            `You stopped around ${
                Math.round(
                    Number(
                        savedProgress.percent
                    )
                )
            }% through this record.`;

        const actions =
            document.createElement("div");

        actions.className =
            "reading-resume-actions";

        const continueButton =
            document.createElement(
                "button"
            );

        continueButton.type =
            "button";

        continueButton.className =
            "button";

        continueButton.textContent =
            `Continue from ${
                Math.round(
                    Number(
                        savedProgress.percent
                    )
                )
            }%`;

        const restartButton =
            document.createElement(
                "button"
            );

        restartButton.type =
            "button";

        restartButton.className =
            "button";

        restartButton.textContent =
            "Start over";

        continueButton.addEventListener(
            "click",
            () => {
                savingEnabled = true;
                panel.remove();

                window.scrollTo({
                    top:
                        Number(
                            savedProgress.scrollY
                        ) || 0,

                    behavior:
                        "smooth"
                });

                window.setTimeout(
                    () => {
                        saveProgress(true);
                    },
                    900
                );
            }
        );

        restartButton.addEventListener(
            "click",
            () => {
                const store =
                    readStore();

                delete store[recordKey];

                writeStore(store);

                savingEnabled = true;
                panel.remove();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

                window.setTimeout(
                    () => {
                        saveProgress(true);
                    },
                    700
                );
            }
        );

        actions.append(
            continueButton,
            restartButton
        );

        panel.append(
            label,
            heading,
            description,
            actions
        );

        document.body.appendChild(
            panel
        );
    }

    updateProgressBar();
})();
