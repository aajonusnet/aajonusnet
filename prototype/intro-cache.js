(() => {
    "use strict";

    const CACHE_NAME =
        "aajonus-intro-assets-v2";

    const READY_KEY =
        "aajonusIntroAssetsReadyV2";

    const ASSETS = [
        "opening-animation.css",
        "opening-animation.js",
        "assets/earthlight/alpine-mist.webp"
    ];

    function absoluteUrl(path) {
        return new URL(
            path,
            document.baseURI
        ).href;
    }

    async function cacheAssets() {
        if (!("caches" in window)) {
            return;
        }

        try {
            const cache =
                await caches.open(
                    CACHE_NAME
                );

            await Promise.all(
                ASSETS.map(
                    async path => {
                        const url =
                            absoluteUrl(path);

                        const current =
                            await cache.match(
                                url,
                                {
                                    ignoreSearch: true
                                }
                            );

                        if (current) {
                            return;
                        }

                        const response =
                            await fetch(
                                url,
                                {
                                    cache: "reload"
                                }
                            );

                        if (!response.ok) {
                            throw new Error(
                                `Failed to cache ${path}`
                            );
                        }

                        await cache.put(
                            url,
                            response.clone()
                        );
                    }
                )
            );

            const confirmation =
                await Promise.all(
                    ASSETS.map(
                        path =>
                            cache.match(
                                absoluteUrl(path),
                                {
                                    ignoreSearch: true
                                }
                            )
                    )
                );

            const complete =
                confirmation.every(Boolean);

            if (complete) {
                localStorage.setItem(
                    READY_KEY,
                    "1"
                );
            } else {
                localStorage.removeItem(
                    READY_KEY
                );
            }
        } catch (error) {
            try {
                localStorage.removeItem(
                    READY_KEY
                );
            } catch {
                // Storage is optional.
            }

            console.warn(
                "Intro cache warm-up failed safely.",
                error
            );
        }
    }

    async function registerWorker() {
        if (
            !(
                "serviceWorker" in
                navigator
            )
        ) {
            return;
        }

        try {
            const registration =
                await navigator
                    .serviceWorker
                    .register(
                        "intro-service-worker.js",
                        {
                            scope: "./"
                        }
                    );

            void registration.update();
        } catch (error) {
            console.warn(
                "Intro service worker failed safely.",
                error
            );
        }
    }

    async function requestPersistence() {
        try {
            await navigator.storage
                ?.persist?.();
        } catch {
            // Persistence is an optimization.
        }
    }

    function start() {
        void requestPersistence();
        void registerWorker();
        void cacheAssets();
    }

    if (
        "requestIdleCallback" in
        window
    ) {
        window.requestIdleCallback(
            start,
            {
                timeout: 1000
            }
        );
    } else {
        window.setTimeout(
            start,
            250
        );
    }
})();
