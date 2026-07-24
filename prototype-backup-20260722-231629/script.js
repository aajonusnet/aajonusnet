const searchInput = document.getElementById("searchInput");
const documentGrid = document.getElementById("documentGrid");
const documentCards = [...document.querySelectorAll(".document-card")];
const filterChips = [...document.querySelectorAll(".filter-chip")];
const collectionButtons = [
    ...document.querySelectorAll(".collection-card"),
    ...document.querySelectorAll(".sidebar-filter")
];
const libraryTitle = document.getElementById("libraryTitle");
const emptyState = document.getElementById("emptyState");
const loadMoreButton = document.getElementById("loadMoreButton");
const gridViewButton = document.getElementById("gridViewButton");
const listViewButton = document.getElementById("listViewButton");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const mobileMenuButton = document.getElementById("mobileMenuButton");
const sidebar = document.getElementById("sidebar");
const showAllCollections = document.getElementById("showAllCollections");

let selectedCategory = "All";
let expanded = false;

function updateDocuments() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    documentCards.forEach((card) => {
        const matchesCategory =
            selectedCategory === "All" ||
            card.dataset.category === selectedCategory;

        const matchesSearch =
            card.dataset.search.includes(query) ||
            card.textContent.toLowerCase().includes(query);

        const shouldShow = matchesCategory && matchesSearch;

        card.style.display = shouldShow ? "flex" : "none";

        if (shouldShow) {
            visibleCount += 1;
        }
    });

    emptyState.hidden = visibleCount !== 0;

    if (query || selectedCategory !== "All") {
        loadMoreButton.style.display = "none";
    } else {
        loadMoreButton.style.display = expanded ? "none" : "block";

        documentCards
            .filter((card) => card.classList.contains("extra-document"))
            .forEach((card) => {
                card.style.display = expanded ? "flex" : "none";
            });
    }
}

function chooseCategory(category) {
    selectedCategory = category;
    libraryTitle.textContent =
        category === "All" ? "All documents" : category;

    filterChips.forEach((chip) => {
        chip.classList.toggle(
            "active",
            chip.dataset.category === category
        );
    });

    updateDocuments();

    document.getElementById("library").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

searchInput.addEventListener("input", updateDocuments);

filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
        chooseCategory(chip.dataset.category);
    });
});

collectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
        chooseCategory(button.dataset.category);
        sidebar.classList.remove("open");
    });
});

showAllCollections.addEventListener("click", () => {
    chooseCategory("All");
});

loadMoreButton.addEventListener("click", () => {
    expanded = true;
    updateDocuments();
});

gridViewButton.addEventListener("click", () => {
    documentGrid.classList.remove("list-view");
    gridViewButton.classList.add("active");
    listViewButton.classList.remove("active");
});

listViewButton.addEventListener("click", () => {
    documentGrid.classList.add("list-view");
    listViewButton.classList.add("active");
    gridViewButton.classList.remove("active");
});

themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const nextTheme =
        html.dataset.theme === "dark" ? "light" : "dark";

    html.dataset.theme = nextTheme;
    themeIcon.textContent = nextTheme === "dark" ? "☀" : "☾";
    localStorage.setItem("prototype-theme", nextTheme);
});

mobileMenuButton.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

document.querySelectorAll(".bookmark").forEach((button) => {
    button.addEventListener("click", () => {
        const selected = button.textContent === "★";
        button.textContent = selected ? "☆" : "★";
    });
});

document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.focus();
    }

    if (event.key === "Escape") {
        searchInput.blur();
        sidebar.classList.remove("open");
    }
});

const savedTheme = localStorage.getItem("prototype-theme");

if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
    themeIcon.textContent = savedTheme === "dark" ? "☀" : "☾";
}

updateDocuments();
