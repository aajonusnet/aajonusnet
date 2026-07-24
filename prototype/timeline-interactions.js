(() => {
    "use strict";

    const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

    function cleanText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function extractYear(value) {
        return cleanText(value)
            .match(YEAR_PATTERN)?.[0] || null;
    }

    function isVisible(element) {
        if (!element) {
            return false;
        }

        const style =
            window.getComputedStyle(element);

        const rectangle =
            element.getBoundingClientRect();

        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            rectangle.width > 0 &&
            rectangle.height > 0
        );
    }

    function findTimeline() {
        const direct =
            document.querySelector(
                "#timeline, " +
                "[data-timeline], " +
                ".timeline-section"
            );

        if (direct) {
            return direct;
        }

        return [
            ...document.querySelectorAll(
                "section"
            )
        ].find(section => {
            const heading =
                section.querySelector(
                    "h1, h2, h3"
                );

            return cleanText(
                heading?.textContent
            ).toLowerCase() === "timeline";
        }) || null;
    }

    function findYearControlFromLabel() {
        const labels = [
            ...document.querySelectorAll(
                "label, legend, " +
                ".filter-label, " +
                ".field-label"
            )
        ];

        for (const label of labels) {
            if (
                cleanText(
                    label.textContent
                ).toUpperCase() !== "YEAR"
            ) {
                continue;
            }

            if (label.htmlFor) {
                const linked =
                    document.getElementById(
                        label.htmlFor
                    );

                if (
                    linked instanceof
                        HTMLSelectElement &&
                    isVisible(linked)
                ) {
                    return linked;
                }
            }

            const container =
                label.closest(
                    ".filter-group, " +
                    ".filter-field, " +
                    ".field, " +
                    "fieldset, " +
                    "label, " +
                    "div"
                );

            const nearby =
                container?.querySelector(
                    "select"
                );

            if (
                nearby instanceof
                    HTMLSelectElement &&
                isVisible(nearby)
            ) {
                return nearby;
            }

            const sibling =
                label.parentElement
                    ?.querySelector(
                        "select"
                    );

            if (
                sibling instanceof
                    HTMLSelectElement &&
                isVisible(sibling)
            ) {
                return sibling;
            }
        }

        return null;
    }

    function selectContainsYears(select) {
        return [
            ...select.options
        ].some(option => {
            return Boolean(
                extractYear(option.value) ||
                extractYear(
                    option.textContent
                )
            );
        });
    }

    function selectIdentity(select) {
        const labels = [
            ...(select.labels || [])
        ]
            .map(label =>
                label.textContent
            )
            .join(" ");

        const parentText =
            select.closest(
                ".filter-group, " +
                ".filter-field, " +
                "fieldset, " +
                "label, " +
                "div"
            )?.textContent || "";

        return cleanText(
            [
                select.id,
                select.name,
                select.getAttribute(
                    "aria-label"
                ),
                labels,
                parentText
            ].join(" ")
        ).toLowerCase();
    }

    function findVisibleYearControl() {
        const labeled =
            findYearControlFromLabel();

        if (labeled) {
            return labeled;
        }

        const candidates = [
            ...document.querySelectorAll(
                "select"
            )
        ].filter(select => {
            return (
                isVisible(select) &&
                selectContainsYears(select)
            );
        });

        const ranked =
            candidates
                .map(select => {
                    const identity =
                        selectIdentity(select);

                    let score = 0;

                    if (
                        identity.includes(
                            "year"
                        )
                    ) {
                        score += 100;
                    }

                    if (
                        select.closest(
                            ".filters, " +
                            "#filters, " +
                            "#archive"
                        )
                    ) {
                        score += 30;
                    }

                    score += [
                        ...select.options
                    ].filter(option =>
                        extractYear(
                            option.value
                        ) ||
                        extractYear(
                            option.textContent
                        )
                    ).length;

                    return {
                        select,
                        score
                    };
                })
                .sort(
                    (first, second) =>
                        second.score -
                        first.score
                );

        return ranked[0]?.select || null;
    }

    function findYearOption(
        select,
        year
    ) {
        return [
            ...select.options
        ].find(option => {
            return (
                extractYear(
                    option.value
                ) === year ||
                extractYear(
                    option.textContent
                ) === year
            );
        }) || null;
    }

    function setNativeSelectValue(
        select,
        value
    ) {
        const descriptor =
            Object.getOwnPropertyDescriptor(
                HTMLSelectElement.prototype,
                "value"
            );

        if (descriptor?.set) {
            descriptor.set.call(
                select,
                value
            );
        } else {
            select.value = value;
        }
    }

    function notifyFilterSystem(
        select
    ) {
        [
            "input",
            "change"
        ].forEach(type => {
            select.dispatchEvent(
                new Event(
                    type,
                    {
                        bubbles: true,
                        cancelable: true
                    }
                )
            );
        });
    }

    function updateTimelineState(year) {
        document
            .querySelectorAll(
                "[data-timeline-year]"
            )
            .forEach(item => {
                const active =
                    item.dataset
                        .timelineYear === year;

                item.classList.toggle(
                    "is-active",
                    active
                );

                item.setAttribute(
                    "aria-pressed",
                    active
                        ? "true"
                        : "false"
                );
            });

        const clearButton =
            document.querySelector(
                ".timeline-clear-year"
            );

        if (clearButton) {
            clearButton.hidden = !year;
        }
    }

    function scrollToResults() {
        window.setTimeout(
            () => {
                const target =
                    document.querySelector(
                        "#archive .results, " +
                        "#archive, " +
                        ".archive-results, " +
                        ".results"
                    );

                target?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            },
            120
        );
    }

    function fallbackNavigation(year) {
        const url =
            new URL(
                window.location.href
            );

        url.searchParams.set(
            "year",
            year
        );

        url.searchParams.delete(
            "page"
        );

        url.hash = "archive";

        window.location.assign(
            url.toString()
        );
    }

    function applyYear(year) {
        const select =
            findVisibleYearControl();

        if (!select) {
            console.warn(
                "[Timeline] Visible YEAR filter was not found."
            );

            fallbackNavigation(year);
            return;
        }

        const option =
            findYearOption(
                select,
                year
            );

        if (!option) {
            console.warn(
                `[Timeline] No option was found for ${year}.`
            );

            fallbackNavigation(year);
            return;
        }

        select.selectedIndex =
            option.index;

        option.selected = true;

        setNativeSelectValue(
            select,
            option.value
        );

        notifyFilterSystem(
            select
        );

        /*
         * A second notification after the current
         * render cycle handles filters whose listeners
         * are attached during page initialization.
         */

        window.setTimeout(
            () => {
                const current =
                    findVisibleYearControl();

                if (!current) {
                    return;
                }

                const currentOption =
                    findYearOption(
                        current,
                        year
                    );

                if (!currentOption) {
                    return;
                }

                current.selectedIndex =
                    currentOption.index;

                currentOption.selected =
                    true;

                setNativeSelectValue(
                    current,
                    currentOption.value
                );

                notifyFilterSystem(
                    current
                );
            },
            50
        );

        updateTimelineState(year);
        scrollToResults();

        console.info(
            `[Timeline] Applied year ${year}.`,
            select
        );
    }

    function findResetOption(select) {
        return [
            ...select.options
        ].find(option => {
            const value =
                cleanText(
                    option.value
                );

            const text =
                cleanText(
                    option.textContent
                ).toLowerCase();

            return (
                value === "" ||
                text === "all years" ||
                text === "all year" ||
                text.includes(
                    "any year"
                )
            );
        }) || null;
    }

    function clearYear() {
        const select =
            findVisibleYearControl();

        if (!select) {
            const url =
                new URL(
                    window.location.href
                );

            url.searchParams.delete(
                "year"
            );

            url.searchParams.delete(
                "page"
            );

            url.hash = "archive";

            window.location.assign(
                url.toString()
            );

            return;
        }

        const option =
            findResetOption(select);

        if (!option) {
            return;
        }

        select.selectedIndex =
            option.index;

        option.selected = true;

        setNativeSelectValue(
            select,
            option.value
        );

        notifyFilterSystem(select);
        updateTimelineState(null);
        scrollToResults();
    }

    function chooseTimelineItem(
        yearElement,
        timeline
    ) {
        const knownContainer =
            yearElement.closest(
                ".timeline-item, " +
                ".timeline-entry, " +
                ".timeline-event, " +
                ".timeline-year, " +
                ".milestone, " +
                "article, li"
            );

        if (
            knownContainer &&
            timeline.contains(
                knownContainer
            )
        ) {
            return knownContainer;
        }

        let current =
            yearElement;

        let best =
            yearElement;

        while (
            current.parentElement &&
            current.parentElement !== timeline
        ) {
            const parent =
                current.parentElement;

            const years = [
                ...new Set(
                    (
                        parent.textContent
                            .match(
                                new RegExp(
                                    YEAR_PATTERN.source,
                                    "g"
                                )
                            ) || []
                    )
                )
            ];

            if (
                years.length !== 1 ||
                cleanText(
                    parent.textContent
                ).length > 250
            ) {
                break;
            }

            best = parent;
            current = parent;
        }

        return best;
    }

    function addClearButton(timeline) {
        if (
            timeline.querySelector(
                ".timeline-clear-year"
            )
        ) {
            return;
        }

        const heading =
            timeline.querySelector(
                "h1, h2, h3"
            );

        if (!heading) {
            return;
        }

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "timeline-controls";

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            "timeline-clear-year";

        button.textContent =
            "Clear year";

        button.hidden = true;

        button.addEventListener(
            "click",
            clearYear
        );

        wrapper.appendChild(button);

        heading.insertAdjacentElement(
            "afterend",
            wrapper
        );
    }

    function enhanceTimeline() {
        const timeline =
            findTimeline();

        if (!timeline) {
            return;
        }

        const leaves = [
            ...timeline.querySelectorAll(
                "*"
            )
        ].filter(element => {
            return (
                element.children.length === 0 &&
                YEAR_PATTERN.test(
                    cleanText(
                        element.textContent
                    )
                )
            );
        });

        const enhanced =
            new Set();

        leaves.forEach(yearElement => {
            const year =
                extractYear(
                    yearElement.textContent
                );

            if (!year) {
                return;
            }

            const item =
                chooseTimelineItem(
                    yearElement,
                    timeline
                );

            if (
                !item ||
                enhanced.has(item)
            ) {
                return;
            }

            enhanced.add(item);

            item.dataset.timelineYear =
                year;

            item.classList.add(
                "timeline-clickable"
            );

            item.setAttribute(
                "role",
                "button"
            );

            item.setAttribute(
                "tabindex",
                "0"
            );

            item.setAttribute(
                "aria-pressed",
                "false"
            );

            item.setAttribute(
                "aria-label",
                `View records from ${year}`
            );
        });

        addClearButton(timeline);
    }

    function handleTimelineClick(
        event
    ) {
        const item =
            event.target.closest(
                "[data-timeline-year]"
            );

        if (!item) {
            return;
        }

        event.preventDefault();

        applyYear(
            item.dataset.timelineYear
        );
    }

    function handleTimelineKeyboard(
        event
    ) {
        if (
            event.key !== "Enter" &&
            event.key !== " "
        ) {
            return;
        }

        const item =
            event.target.closest(
                "[data-timeline-year]"
            );

        if (!item) {
            return;
        }

        event.preventDefault();

        applyYear(
            item.dataset.timelineYear
        );
    }

    function initialize() {
        enhanceTimeline();

        document.addEventListener(
            "click",
            handleTimelineClick
        );

        document.addEventListener(
            "keydown",
            handleTimelineKeyboard
        );

        /*
         * Re-enhance if another script redraws
         * the timeline or archive filters.
         */

        const observer =
            new MutationObserver(() => {
                enhanceTimeline();
            });

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
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
            {
                once: true
            }
        );
    } else {
        initialize();
    }
})();
