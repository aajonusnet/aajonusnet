"use strict";

const CACHE_PREFIX =
    "aajonus-intro-assets-";

const CACHE_NAME =
    "aajonus-intro-assets-v2";

const BASE =
    new URL("./", self.location.href);

const ASSETS = [
    "opening-animation.css",
    "opening-animation.js",
    "assets/earthlight/alpine-mist.webp"
].map(
    path =>
        new URL(path, BASE).href
);

const PATHS =
    new Set(
        ASSETS.map(
            url =>
                new URL(url).pathname
        )
    );

self.addEventListener(
    "install",
    event => {
        event.waitUntil(
            (async () => {
                const cache =
                    await caches.open(
                        CACHE_NAME
                    );

                await Promise.allSettled(
                    ASSETS.map(
                        async url => {
                            const response =
                                await fetch(
                                    url,
                                    {
                                        cache: "reload"
                                    }
                                );

                            if (response.ok) {
                                await cache.put(
                                    url,
                                    response.clone()
                                );
                            }
                        }
                    )
                );

                await self.skipWaiting();
            })()
        );
    }
);

self.addEventListener(
    "activate",
    event => {
        event.waitUntil(
            (async () => {
                const names =
                    await caches.keys();

                await Promise.all(
                    names.map(
                        name => {
                            const outdated =
                                name.startsWith(
                                    CACHE_PREFIX
                                ) &&
                                name !==
                                    CACHE_NAME;

                            return outdated
                                ? caches.delete(name)
                                : Promise.resolve();
                        }
                    )
                );

                await self.clients.claim();
            })()
        );
    }
);

self.addEventListener(
    "fetch",
    event => {
        const request =
            event.request;

        if (request.method !== "GET") {
            return;
        }

        const url =
            new URL(request.url);

        if (
            url.origin !==
                self.location.origin ||
            !PATHS.has(url.pathname)
        ) {
            return;
        }

        event.respondWith(
            (async () => {
                const cache =
                    await caches.open(
                        CACHE_NAME
                    );

                const cached =
                    await cache.match(
                        request,
                        {
                            ignoreSearch: true
                        }
                    );

                if (cached) {
                    return cached;
                }

                const response =
                    await fetch(request);

                if (response.ok) {
                    await cache.put(
                        request,
                        response.clone()
                    );
                }

                return response;
            })()
        );
    }
);
