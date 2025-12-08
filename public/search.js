// public/search.js

// --- DOM references ---
const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const resultsDiv = document.getElementById("results");
const genreSelect = document.getElementById("genre-filter");
const ratingStars = document.querySelectorAll(".rating-star");

// null = no filter
let currentRatingFilter = null;



// cache for book detail responses
const detailsCache = {};

// --- Event wiring ---

// normal search submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await performSearch();
});

// default recommended search on first load
window.addEventListener("DOMContentLoaded", () => {
  performSearch();
});

// re-run search when genre changes
genreSelect.addEventListener("change", () => {
  performSearch();
});

// star rating filter
ratingStars.forEach((star) => {
  star.addEventListener("click", () => {
    const value = Number(star.dataset.rating);

    // If user clicks the same rating → clear filter
    if (currentRatingFilter === value) {
      currentRatingFilter = null;
      ratingStars.forEach((s) => s.classList.remove("active"));
      performSearch();
      return;
    }

    // Otherwise set new filter
    currentRatingFilter = value;

    // Highlight stars up to selected
    ratingStars.forEach((s) => {
      const r = Number(s.dataset.rating);
      s.classList.toggle("active", r <= currentRatingFilter);
    });

    performSearch();
  });
});


// close all "+" menus when clicking anywhere else
document.addEventListener("click", () => {
  document
    .querySelectorAll(".book-menu")
    .forEach((menu) => menu.classList.add("hidden"));
});

// --- Search + render ---

async function performSearch() {
  const baseQuery = input.value.trim() || "books";
  const params = new URLSearchParams({ q: baseQuery });

  const genre = genreSelect.value;

  if (genre && genre !== "any") params.set("genre", genre);
  if (currentRatingFilter != null) {
  params.set("rating", String(currentRatingFilter));
}



  resultsDiv.textContent = "Loading...";

  try {
    const res = await fetch(`/api/search?${params.toString()}`);
    const books = await res.json();

    resultsDiv.innerHTML = "";

    if (!books.length) {
      resultsDiv.textContent = "No results.";
      return;
    }

    books.forEach((book) => {
      renderBookTile(book);
    });
  } catch (err) {
    console.error("Error in performSearch:", err);
    resultsDiv.textContent = "Error loading search results.";
  }
}

// --- Tile + menus ---

function renderBookTile(book) {
  const tile = document.createElement("div");
  tile.className = "book-tile";

  // cover
  const coverWrapper = document.createElement("div");
  coverWrapper.className = "book-cover-wrapper";

  const img = document.createElement("img");
  img.src = book.coverImageUrl || "";
  img.alt = book.title;

  // "+" button
  const plus = document.createElement("button");
  plus.className = "book-plus";
  plus.type = "button";
  plus.textContent = "+";
  plus.setAttribute("aria-label", "Add to shelf");

  // menu under "+" (TBR / READ / DNF)
  const menu = document.createElement("div");
  menu.className = "book-menu hidden";

  ["TBR", "READ", "DNF"].forEach((status) => {
    const btn = document.createElement("button");
    btn.textContent =
      status === "TBR"
        ? "Add to TBR"
        : status === "READ"
        ? "Mark as Read"
        : "Add to DNF";

    btn.addEventListener("click", () => {
      addBookToShelf(book.bigBookId, status);
      menu.classList.add("hidden");
    });

    menu.appendChild(btn);
  });

  plus.addEventListener("click", (e) => {
    e.stopPropagation();
    // close any other menus + info overlays
    document
      .querySelectorAll(".book-menu")
      .forEach((m) => m !== menu && m.classList.add("hidden"));
    document
      .querySelectorAll(".book-info-overlay")
      .forEach((o) => o.remove());

    menu.classList.toggle("hidden");
  });

  coverWrapper.appendChild(img);
  coverWrapper.appendChild(plus);
  coverWrapper.appendChild(menu);

  // title (truncated with ellipsis via CSS)
  const titleEl = document.createElement("p");
  titleEl.className = "book-title";
  titleEl.textContent = book.title;

  // clicking cover OR title opens info modal
  const openInfo = (e) => {
    e.stopPropagation();
    console.log("📖 openInfo clicked for:", book.title);
    showInfoCard(book);
  };

  coverWrapper.addEventListener("click", openInfo);
  titleEl.addEventListener("click", openInfo);

  tile.appendChild(coverWrapper);
  tile.appendChild(titleEl);

  resultsDiv.appendChild(tile);
}

// --- Info overlay (full-screen modal) ---

async function showInfoCard(book) {
  // close menus + any existing overlays
  document
    .querySelectorAll(".book-menu")
    .forEach((m) => m.classList.add("hidden"));
  document
    .querySelectorAll(".book-info-overlay")
    .forEach((o) => o.remove());

  let details = detailsCache[book.bigBookId];
  let usedFallback = false;

  if (!details) {
    try {
      console.log("🔎 fetching details for", book.bigBookId);
      const res = await fetch(`/api/external-books/${book.bigBookId}`);

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      details = await res.json();
      detailsCache[book.bigBookId] = details;
    } catch (err) {
      console.error("Error in showInfoCard fetch, using fallback:", err);

      // fallback to basic info from search results
      details = {
        title: book.title,
        authors: book.authors || [],
        averageRating: book.averageRating ?? null,
        numberOfPages: null,
        description: "",
        image: book.coverImageUrl || "",
      };
      usedFallback = true;
    }
  } else {
    console.log("📚 using cached details for", book.bigBookId);
  }

  const overlay = document.createElement("div");
  overlay.className = "book-info-overlay";

  const card = document.createElement("div");
  card.className = "book-info-card";

  const closeBtn = document.createElement("button");
  closeBtn.className = "card-close";
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", () => overlay.remove());

  // --- main content layout (cover + text) ---
  const main = document.createElement("div");
  main.className = "book-info-main";

  // cover image
  const imageUrl = details.image || book.coverImageUrl || "";
  if (imageUrl) {
    const cover = document.createElement("img");
    cover.className = "card-cover";
    cover.src = imageUrl;
    cover.alt = details.title || book.title;
    main.appendChild(cover);
  }

  const textWrap = document.createElement("div");
  textWrap.className = "card-text";

  const title = document.createElement("h4");
  title.textContent = details.title || book.title;

  const authors = document.createElement("p");
  authors.className = "card-meta";
  authors.textContent =
    (details.authors && details.authors.length
      ? details.authors.join(", ")
      : book.authors && book.authors.length
      ? book.authors.join(", ")
      : "Unknown author");

  const rating = document.createElement("p");
  rating.className = "card-meta";
  const avg =
    details.averageRating != null
      ? details.averageRating
      : book.averageRating;
  rating.textContent =
    avg != null ? `Rating: ${(avg * 5).toFixed(1)}★` : "Rating: N/A";

  const pages = document.createElement("p");
  pages.className = "card-meta";
  if (details.numberOfPages) {
    pages.textContent = `Pages: ${details.numberOfPages}`;
  }

  const desc = document.createElement("p");
  desc.className = "card-desc";
  if (usedFallback) {
    desc.textContent = "More details are not available for this book.";
  } else if (details.description) {
    const trimmed =
      details.description.length > 260
        ? details.description.slice(0, 260) + "…"
        : details.description;
    desc.textContent = trimmed;
  } else {
    desc.textContent = "No description available.";
  }

  textWrap.appendChild(title);
  textWrap.appendChild(authors);
  textWrap.appendChild(rating);
  if (pages.textContent) textWrap.appendChild(pages);
  textWrap.appendChild(desc);

  main.appendChild(textWrap);

  // --- actions row ---
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const makeActionBtn = (status, label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = "card-action-btn";
    btn.addEventListener("click", async () => {
      await addBookToShelf(book.bigBookId, status);
      overlay.remove();
    });
    return btn;
  };

  actions.appendChild(makeActionBtn("TBR", "Add to TBR"));
  actions.appendChild(makeActionBtn("READ", "Mark as Read"));
  actions.appendChild(makeActionBtn("DNF", "Add to DNF"));

  card.appendChild(closeBtn);
  card.appendChild(main);
  card.appendChild(actions);

  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}


// --- Add to shelf ---

async function addBookToShelf(bigBookId, status) {
  try {
    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bigBookId, status }),
    });
    alert(`Added to ${status}`);
  } catch (err) {
    console.error("Error in addBookToShelf:", err);
    alert("Error adding book.");
  }
}
