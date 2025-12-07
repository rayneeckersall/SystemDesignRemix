const tabs = document.querySelectorAll('.tab');
const shelfDiv = document.getElementById('shelf');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    loadShelf(tab.dataset.status);
  });
});

// initial load
loadShelf('TBR');

async function loadShelf(status) {
  shelfDiv.textContent = 'Loading...';

  try {
    const res = await fetch(`/api/books?status=${status}`);
    const books = await res.json();

    if (!books.length) {
      shelfDiv.textContent = 'No books in this shelf yet.';
      return;
    }

    shelfDiv.innerHTML = '';

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
          <p>Status: ${book.status}</p>
          <div class="actions">
            <button class="secondary" data-status="TBR" data-id="${book._id}">TBR</button>
            <button class="secondary" data-status="READ" data-id="${book._id}">Read</button>
            <button class="secondary" data-status="DNF" data-id="${book._id}">DNF</button>
            <button class="danger" data-delete-id="${book._id}">Remove</button>
          </div>
        </div>
      `;

      card.querySelectorAll('button[data-status]').forEach((btn) => {
        btn.addEventListener('click', () =>
          updateStatus(btn.dataset.id, btn.dataset.status)
        );
      });

      card.querySelector('button[data-delete-id]').addEventListener('click', () =>
        deleteBook(book._id)
      );

      shelfDiv.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    shelfDiv.textContent = 'Error loading shelf.';
  }
}

async function updateStatus(id, status) {
  try {
    await fetch(`/api/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const activeStatus = document.querySelector('.tab.active').dataset.status;
    loadShelf(activeStatus);
  } catch (err) {
    console.error(err);
    alert('Error updating status.');
  }
}

async function deleteBook(id) {
  if (!confirm('Remove this book from your library?')) return;

  try {
    await fetch(`/api/books/${id}`, { method: 'DELETE' });
    const activeStatus = document.querySelector('.tab.active').dataset.status;
    loadShelf(activeStatus);
  } catch (err) {
    console.error(err);
    alert('Error deleting book.');
  }
}

