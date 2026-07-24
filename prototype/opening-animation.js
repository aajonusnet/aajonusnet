(() => {
    "use strict";

    const LAST_SEEN_KEY =
        "aajonusIntroLastSeenV7";

    const overlay =
        document.getElementById(
            "archiveOpening"
        );

    if (
        !overlay ||
        document.documentElement
            .dataset
            .opening !== "play"
    ) {
        overlay?.remove();

        document.documentElement
            .classList
            .remove("opening-active");

        return;
    }

    const forced =
        new URLSearchParams(
            window.location.search
        ).get("intro") === "1";

    const reducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

    let finished = false;
    let timer = null;

    function rememberIntro() {
        if (forced) {
            return;
        }

        try {
            localStorage.setItem(
                LAST_SEEN_KEY,
                String(Date.now())
            );
        } catch {
            // Local storage is optional.
        }
    }

    function cleanup() {
        overlay.remove();

        document.documentElement
            .dataset
            .opening = "skip";

        document.documentElement
            .classList
            .remove("opening-active");

        document.removeEventListener(
            "keydown",
            handleKeyboard
        );
    }

    function finish() {
        if (finished) {
            return;
        }

        finished = true;

        window.clearTimeout(timer);

        overlay.classList.add(
            "is-leaving"
        );

        window.setTimeout(
            cleanup,
            reducedMotion ? 10 : 300
        );
    }

    function handleKeyboard(event) {
        if (
            event.key === "Escape" ||
            event.key === "Enter" ||
            event.key === " "
        ) {
            event.preventDefault();
            finish();
        }
    }

    rememberIntro();

    overlay
        .querySelector(
            ".opening-skip"
        )
        ?.addEventListener(
            "click",
            finish
        );

    document.addEventListener(
        "keydown",
        handleKeyboard
    );

    /*
     * There is no image wait here.
     * The intro is only eligible when all assets
     * were confirmed cached on an earlier visit.
     */

    overlay.classList.add(
        "is-photo-ready"
    );

    window.requestAnimationFrame(
        () => {
            overlay.classList.add(
                "is-ready"
            );
        }
    );

    timer = window.setTimeout(
        finish,
        forced ? 2600 : 1050
    );
})();
