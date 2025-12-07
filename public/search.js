const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const resultsDiv = document.getElementById('results');

// Run a search when form is submitted
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;

  await performSearch(q);
});

// Run a "recommended" search on initial load
window.addEventListener('DOMContentLoaded', () => {
  // You can change this query to whatever vibe you want:
  performSearch('popular fiction books', true);
});

async function performSearch(query, isRecommended = false) {
  resultsDiv.textContent = 'Loading...';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const books = await res.json();

    resultsDiv.innerHTML = '';

    if (!books.length) {
      resultsDiv.textContent = 'No results.';
      return;
    }

    if (isRecommended) {
      const heading = document.createElement('h2');
      heading.textContent = 'Recommended for you';
      heading.style.marginBottom = '0.5rem';
      resultsDiv.appendChild(heading);
    }

    books.forEach((book) => {
      const card = document.createElement('div');
      card.className = 'book-card';

      const authors = book.authors && book.authors.length
        ? book.authors.join(', ')
        : 'Unknown author';

      card.innerHTML = `
        <img src="${book.coverImageUrl || ''}" alt="${book.title}">
        <div>
          <h3>${book.title}</h3>
          <p>${authors}</p>
          <p>Average rating: ${book.averageRating ?? 'N/A'}</p>
          <div class="actions">
            <button data-status="TBR">Add to TBR</button>
            <button data-status="READ">Add to Read</button>
            <button data-status="DNF">Add to DNF</button>
          </div>
        </div>
      `;

      card.querySelectorAll('button[data-status]').forEach((btn) => {
        btn.addEventListener('click', () => {
          addBookToShelf(book.bigBookId, btn.dataset.status);
        });
      });

      resultsDiv.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    resultsDiv.textContent = 'Error loading search results.';
  }
}

async function addBookToShelf(bigBookId, status) {
  try {
    await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bigBookId, status })
    });
    alert(`Added to ${status}`);
  } catch (err) {
    console.error(err);
    alert('Error adding book.');
  }
}
