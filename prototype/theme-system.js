(() => {
    "use strict";

    const STORAGE_KEY = "aajonusThemeV2";

    const THEMES = [
        {
            id: "archive",
            label: "Archive"
        },
        {
            id: "living-sun",
            label: "Living Sun"
        }
    ];

    const LIVING_COPY = {
        kicker: "Preserving a living record",
        title: "The Living Record.",
        copy:
            "Preserving the teachings. Honoring the life. Sharing the record."
    };

    function isValidTheme(value) {
        return THEMES.some(
            theme => theme.id === value
        );
    }

    function readStoredTheme() {
        try {
            const current = localStorage.getItem(
                STORAGE_KEY
            );

            if (isValidTheme(current)) {
                return current;
            }

            const older = localStorage.getItem(
                "aajonusThemeV1"
            );

            return isValidTheme(older)
                ? older
                : "archive";
        } catch {
            return "archive";
        }
    }

    function saveTheme(themeId) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                themeId
            );
        } catch {
            // Theme still applies during this visit.
        }
    }

    function updateSwitcher(themeId) {
        document
            .querySelectorAll(
                ".theme-switcher-button"
            )
            .forEach(button => {
                const active =
                    button.dataset.theme ===
                    themeId;

                button.classList.toggle(
                    "active",
                    active
                );

                button.setAttribute(
                    "aria-pressed",
                    active ? "true" : "false"
                );
            });
    }

    function rememberText(element) {
        if (
            element &&
            !element.dataset.archiveText
        ) {
            element.dataset.archiveText =
                element.textContent.trim();
        }
    }

    function updateHomeCopy(themeId) {
        const intro = document.querySelector(
            ".intro"
        );

        if (!intro) {
            return;
        }

        const kicker = intro.querySelector(
            ".kicker"
        );

        const title = intro.querySelector(
            "h1"
        );

        const copy = intro.querySelector(
            ".intro-copy"
        );

        [kicker, title, copy].forEach(
            rememberText
        );

        if (themeId === "living-sun") {
            if (kicker) {
                kicker.textContent =
                    LIVING_COPY.kicker;
            }

            if (title) {
                title.textContent =
                    LIVING_COPY.title;
            }

            if (copy) {
                copy.textContent =
                    LIVING_COPY.copy;
            }
        } else {
            [kicker, title, copy].forEach(
                element => {
                    if (
                        element &&
                        element.dataset.archiveText
                    ) {
                        element.textContent =
                            element.dataset.archiveText;
                    }
                }
            );
        }
    }

    function applyTheme(themeId) {
        const theme = isValidTheme(themeId)
            ? themeId
            : "archive";

        document.documentElement.setAttribute(
            "data-theme",
            theme
        );

        document.body?.setAttribute(
            "data-active-theme",
            theme
        );

        saveTheme(theme);
        updateSwitcher(theme);
        updateHomeCopy(theme);
    }

    function addPageIdentity() {
        const homeView = Boolean(
            document.querySelector(".intro")
        );

        const articleView = Boolean(
            document.querySelector(
                ".article-header"
            )
        );

        document.body.classList.toggle(
            "home-view",
            homeView
        );

        document.body.classList.toggle(
            "article-view",
            articleView
        );
    }

    function createImage(
        source,
        alternative,
        className
    ) {
        const image = document.createElement(
            "img"
        );

        image.src = source;
        image.alt = alternative;
        image.className = className;
        image.loading = "eager";
        image.decoding = "async";

        return image;
    }

    function addLivingSunHero() {
        const intro = document.querySelector(
            ".intro"
        );

        if (
            !intro ||
            intro.querySelector(
                ".ls-hero-stage"
            )
        ) {
            return;
        }

        const stage = document.createElement(
            "div"
        );

        stage.className = "ls-hero-stage";
        stage.setAttribute("aria-hidden", "true");

        const gardenCard = document.createElement(
            "figure"
        );

        gardenCard.className =
            "ls-scene-photo ls-scene-garden";

        gardenCard.appendChild(
            createImage(
                "/prototype/assets/ls-garden-postcard.webp",
                "",
                "ls-scene-image"
            )
        );

        const milkCard = document.createElement(
            "figure"
        );

        milkCard.className =
            "ls-scene-photo ls-scene-milk";

        milkCard.appendChild(
            createImage(
                "/prototype/assets/ls-milk-glass.webp",
                "",
                "ls-scene-image"
            )
        );

        const bookCard = document.createElement(
            "figure"
        );

        bookCard.className =
            "ls-scene-photo ls-scene-books";

        bookCard.appendChild(
            createImage(
                "/prototype/assets/ls-milk-books.webp",
                "",
                "ls-scene-image"
            )
        );

        const sun = document.createElement("div");
        sun.className = "ls-sun-emblem";
        sun.innerHTML = `
            <span class="ls-sun-rays"></span>
            <span class="ls-sun-core">AV</span>
        `;

        const caption = document.createElement(
            "div"
        );

        caption.className = "ls-field-caption";
        caption.innerHTML = `
            <span>Independent archive</span>
            <strong>390 records and growing</strong>
        `;

        const bubbles = document.createElement(
            "div"
        );

        bubbles.className = "ls-bubble-field";
        bubbles.innerHTML = `
            <span class="ls-bubble ls-bubble-one"></span>
            <span class="ls-bubble ls-bubble-two"></span>
            <span class="ls-bubble ls-bubble-three"></span>
        `;

        stage.append(
            gardenCard,
            milkCard,
            bookCard,
            sun,
            caption,
            bubbles
        );

        intro.prepend(stage);
    }

    function decorateCollections() {
        const imageMap = {
            "Q&A": "/prototype/assets/ls-aajonus-garden.webp",
            Interview: "/prototype/assets/ls-aajonus-hills.webp",
            Book: "/prototype/assets/ls-milk-books.webp",
            Newsletter: "/prototype/assets/ls-garden-postcard.webp"
        };

        const iconMap = {
            "Q&A": "✦",
            Interview: "◉",
            Book: "▤",
            Newsletter: "✉"
        };

        document
            .querySelectorAll(".collection")
            .forEach(collection => {
                if (
                    collection.querySelector(
                        ".ls-collection-media"
                    )
                ) {
                    return;
                }

                const format =
                    collection.dataset.format ||
                    "Book";

                const media = document.createElement(
                    "span"
                );

                media.className =
                    "ls-collection-media";

                const image = createImage(
                    imageMap[format] ||
                        imageMap.Book,
                    "",
                    "ls-collection-image"
                );

                image.loading = "lazy";

                const icon = document.createElement(
                    "span"
                );

                icon.className =
                    "ls-collection-icon";

                icon.textContent =
                    iconMap[format] || "✦";

                media.append(image, icon);
                collection.prepend(media);
            });
    }

    function decorateFeaturedRecord() {
        const featured = document.querySelector(
            ".featured-record"
        );

        if (
            !featured ||
            featured.querySelector(
                ".ls-featured-visual"
            )
        ) {
            return;
        }

        const visual = document.createElement(
            "div"
        );

        visual.className = "ls-featured-visual";
        visual.setAttribute("aria-hidden", "true");

        visual.appendChild(
            createImage(
                "/prototype/assets/ls-aajonus-garden.webp",
                "",
                "ls-featured-image"
            )
        );

        const badge = document.createElement("span");
        badge.className = "ls-featured-badge";
        badge.textContent = "Featured recording";

        visual.appendChild(badge);
        featured.prepend(visual);
    }

    function addArticleScene() {
        const header = document.querySelector(
            ".article-header"
        );

        if (
            !header ||
            header.querySelector(
                ".ls-article-scene"
            )
        ) {
            return;
        }

        const scene = document.createElement(
            "div"
        );

        scene.className = "ls-article-scene";
        scene.setAttribute("aria-hidden", "true");

        const landscape = createImage(
            "/prototype/assets/ls-wildflowers.webp",
            "",
            "ls-article-landscape"
        );

        const portraitFrame = document.createElement(
            "div"
        );

        portraitFrame.className =
            "ls-article-portrait-frame";

        portraitFrame.appendChild(
            createImage(
                "/prototype/assets/ls-aajonus-hills.webp",
                "",
                "ls-article-portrait"
            )
        );

        const milkFrame = document.createElement(
            "div"
        );

        milkFrame.className =
            "ls-article-milk-frame";

        milkFrame.appendChild(
            createImage(
                "/prototype/assets/ls-milk-glass.webp",
                "",
                "ls-article-milk"
            )
        );

        const label = document.createElement("span");
        label.className = "ls-article-scene-label";
        label.textContent = "Living archive record";

        scene.append(
            landscape,
            portraitFrame,
            milkFrame,
            label
        );

        header.prepend(scene);
    }

    function buildSwitcher() {
        if (
            document.getElementById(
                "themeSwitcher"
            )
        ) {
            updateSwitcher(readStoredTheme());
            return;
        }

        const switcher = document.createElement(
            "div"
        );

        switcher.id = "themeSwitcher";
        switcher.className = "theme-switcher";
        switcher.setAttribute("role", "group");
        switcher.setAttribute(
            "aria-label",
            "Archive appearance"
        );

        const label = document.createElement("span");
        label.className = "theme-switcher-label";
        label.textContent = "Appearance";
        switcher.appendChild(label);

        THEMES.forEach(theme => {
            const button = document.createElement(
                "button"
            );

            button.type = "button";
            button.className =
                "theme-switcher-button";
            button.dataset.theme = theme.id;
            button.textContent = theme.label;

            button.addEventListener(
                "click",
                () => applyTheme(theme.id)
            );

            switcher.appendChild(button);
        });

        const navigation = document.querySelector(
            ".top-nav"
        );

        const headerInner = document.querySelector(
            ".header-inner"
        );

        const backLink = document.getElementById(
            "backLink"
        );

        if (navigation) {
            navigation.appendChild(switcher);
        } else if (headerInner && backLink) {
            headerInner.insertBefore(
                switcher,
                backLink
            );
        } else if (headerInner) {
            headerInner.appendChild(switcher);
        } else {
            document.body.appendChild(switcher);
        }

        updateSwitcher(readStoredTheme());
    }

    function initialize() {
        addPageIdentity();
        addLivingSunHero();
        decorateCollections();
        decorateFeaturedRecord();
        addArticleScene();
        buildSwitcher();
        applyTheme(readStoredTheme());
    }

    document.documentElement.setAttribute(
        "data-theme",
        readStoredTheme()
    );

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key === STORAGE_KEY &&
                isValidTheme(event.newValue)
            ) {
                applyTheme(event.newValue);
            }
        }
    );
})();
