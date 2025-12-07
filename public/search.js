const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const resultsDiv = document.getElementById("results");

// when user submits search
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  await performSearch(q);
});

// recommended books on load
window.addEventListener("DOMContentLoaded", () => {
  performSearch("popular fiction books");
});

async function performSearch(query) {
  resultsDiv.textContent = "Loading...";

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const books = await res.json();

    resultsDiv.innerHTML = "";

    if (!books.length) {
      resultsDiv.textContent = "No results.";
      return;
    }

    books.forEach((book) => {
      const tile = document.createElement("div");
      tile.className = "book-tile";

      // Cover
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

      // popup menu (TBR / READ / DNF)
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
        // close all other menus first
        document
          .querySelectorAll(".book-menu")
          .forEach((m) => m !== menu && m.classList.add("hidden"));
        document
          .querySelectorAll(".title-popover")
          .forEach((p) => p.classList.remove("visible"));

        menu.classList.toggle("hidden");
      });

      coverWrapper.appendChild(img);
      coverWrapper.appendChild(plus);
      coverWrapper.appendChild(menu);

      // Title (truncated) + popover
      const titleEl = document.createElement("p");
      titleEl.className = "book-title";
      titleEl.textContent = book.title;

      const popover = document.createElement("div");
      popover.className = "title-popover";
      popover.textContent = book.title;

      titleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        // close other popovers & menus
        document
          .querySelectorAll(".title-popover")
          .forEach((p) => p !== popover && p.classList.remove("visible"));
        document
          .querySelectorAll(".book-menu")
          .forEach((m) => m.classList.add("hidden"));

        popover.classList.toggle("visible");
      });

      tile.appendChild(coverWrapper);
      tile.appendChild(titleEl);
      tile.appendChild(popover);

      resultsDiv.appendChild(tile);
    });
  } catch (err) {
    console.error(err);
    resultsDiv.textContent = "Error loading search results.";
  }
}

// Close menus & popovers when clicking anywhere else
document.addEventListener("click", () => {
  document
    .querySelectorAll(".book-menu")
    .forEach((menu) => menu.classList.add("hidden"));
  document
    .querySelectorAll(".title-popover")
    .forEach((p) => p.classList.remove("visible"));
});


// close menus if you click anywhere else on the page
document.addEventListener("click", () => {
  document
    .querySelectorAll(".book-menu")
    .forEach((menu) => menu.classList.add("hidden"));
});

async function addBookToShelf(bigBookId, status) {
  try {
    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bigBookId, status }),
    });
    alert(`Added to ${status}`);
  } catch (err) {
    console.error(err);
    alert("Error adding book.");
  }
}
