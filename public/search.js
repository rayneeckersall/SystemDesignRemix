const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const resultsDiv = document.getElementById("results");
const genreSelect = document.getElementById('genre-filter');
const ratingSelect = document.getElementById('rating-filter');
const lengthSelect = document.getElementById('length-filter');

const detailsCache = {}; // cache book info for cards


form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await performSearch();
});

window.addEventListener('DOMContentLoaded', () => {
  // default recommended search
  input.value = 'popular fiction books';
  performSearch();
});

// re-run search when filters change
[genreSelect, ratingSelect, lengthSelect].forEach((el) => {
  el.addEventListener('change', () => {
    performSearch();
  });
});


async function performSearch() {
  const baseQuery = input.value.trim() || 'books';

  const params = new URLSearchParams({ q: baseQuery });

  const genre = genreSelect.value;
  const rating = ratingSelect.value;
  const length = lengthSelect.value;

  if (genre && genre !== 'any') params.set('genre', genre);
  if (rating && rating !== 'any') params.set('rating', rating);
  if (length && length !== 'any') params.set('length', length);

  resultsDiv.textContent = 'Loading...';

  try {
    const res = await fetch(`/api/search?${params.toString()}`);
    const books = await res.json();

    resultsDiv.innerHTML = '';

    if (!books.length) {
      resultsDiv.textContent = 'No results.';
      return;
    }

    books.forEach((book) => {
      renderBookTile(book);
    });
  } catch (err) {
    console.error(err);
    resultsDiv.textContent = 'Error loading search results.';
  }
}


// Close menus & info cards when clicking anywhere else on the page
document.addEventListener("click", () => {
  document
    .querySelectorAll(".book-menu")
    .forEach((menu) => menu.classList.add("hidden"));

  document
    .querySelectorAll(".book-info-card")
    .forEach((card) => card.remove());
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
function renderBookTile(book) {
  const tile = document.createElement('div');
  tile.className = 'book-tile';

  const coverWrapper = document.createElement('div');
  coverWrapper.className = 'book-cover-wrapper';

  const img = document.createElement('img');
  img.src = book.coverImageUrl || '';
  img.alt = book.title;

  // "+" button and menu (unchanged from before)
  const plus = document.createElement('button');
  plus.className = 'book-plus';
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Add to shelf');

  const menu = document.createElement('div');
  menu.className = 'book-menu hidden';

  ['TBR', 'READ', 'DNF'].forEach((status) => {
    const btn = document.createElement('button');
    btn.textContent =
      status === 'TBR'
        ? 'Add to TBR'
        : status === 'READ'
        ? 'Mark as Read'
        : 'Add to DNF';

    btn.addEventListener('click', () => {
      addBookToShelf(book.bigBookId, status);
      menu.classList.add('hidden');
    });

    menu.appendChild(btn);
  });

  plus.addEventListener('click', (e) => {
    e.stopPropagation();
    document
      .querySelectorAll('.book-menu')
      .forEach((m) => m !== menu && m.classList.add('hidden'));
    document
      .querySelectorAll('.book-info-card')
      .forEach((c) => c.remove());

    menu.classList.toggle('hidden');
  });

  coverWrapper.appendChild(img);
  coverWrapper.appendChild(plus);
  coverWrapper.appendChild(menu);

  const titleEl = document.createElement('p');
  titleEl.className = 'book-title';
  titleEl.textContent = book.title;

  // Clicking cover OR title opens info card
  const openInfo = (e) => {
    e.stopPropagation();
    showInfoCard(book, tile);
  };

  coverWrapper.addEventListener('click', openInfo);
  titleEl.addEventListener('click', openInfo);

  tile.appendChild(coverWrapper);
  tile.appendChild(titleEl);

  resultsDiv.appendChild(tile);
}
async function showInfoCard(book, tile) {
  // close any other cards/menus
  document.querySelectorAll('.book-info-card').forEach((c) => c.remove());
  document
    .querySelectorAll('.book-menu')
    .forEach((m) => m.classList.add('hidden'));

  let details = detailsCache[book.bigBookId];

  if (!details) {
    try {
      const res = await fetch(`/api/external-books/${book.bigBookId}`);
      details = await res.json();
      detailsCache[book.bigBookId] = details;
    } catch (err) {
      console.error(err);
      return;
    }
  }

  const card = document.createElement('div');
  card.className = 'book-info-card';

  const title = document.createElement('h4');
  title.textContent = details.title || book.title;

  const authors = document.createElement('p');
  authors.className = 'card-meta';
  authors.textContent =
    (details.authors && details.authors.join(', ')) ||
    (book.authors && book.authors.join(', ')) ||
    'Unknown author';

  const rating = document.createElement('p');
  rating.className = 'card-meta';
  const avg =
    details.averageRating != null
      ? details.averageRating
      : book.averageRating;
  rating.textContent =
    avg != null ? `Rating: ${(avg * 5).toFixed(1)}★` : 'Rating: N/A';

  const pages = document.createElement('p');
  pages.className = 'card-meta';
  if (details.numberOfPages) {
    pages.textContent = `Pages: ${details.numberOfPages}`;
  } else {
    pages.textContent = '';
  }

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  if (details.description) {
    const trimmed =
      details.description.length > 260
        ? details.description.slice(0, 260) + '…'
        : details.description;
    desc.textContent = trimmed;
  } else {
    desc.textContent = 'No description available.';
  }

  card.appendChild(title);
  card.appendChild(authors);
  card.appendChild(rating);
  if (pages.textContent) card.appendChild(pages);
  card.appendChild(desc);

  tile.appendChild(card);
}

document.addEventListener('click', () => {
  document
    .querySelectorAll('.book-menu')
    .forEach((menu) => menu.classList.add('hidden'));
  document
    .querySelectorAll('.book-info-card')
    .forEach((c) => c.remove());
});
