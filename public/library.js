// library.js (copy + paste full file)

const shelfButtons = document.querySelectorAll(".shelf-book");
const shelfDiv = document.getElementById("shelf");
const shelfTitle = document.getElementById("shelf-title");

// Track which shelf is currently selected (so we can refresh after actions)
let currentStatus = "TBR";

// Map status → nicer title
function statusToTitle(status) {
  switch (status) {
    case "TBR":
      return "To Be Read";
    case "READ":
      return "Read";
    case "DNF":
      return "Did Not Finish";
    default:
      return status;
  }
}

shelfButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    shelfButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const status = btn.dataset.status;
    currentStatus = status;

    shelfTitle.textContent = statusToTitle(status);
    loadShelf(status);
  });
});

function showToast({ title, message = "", type = "success", timeout = 2200 }) {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <div class="toast-icon">${type === "error" ? "!" : "✓"}</div>
    <div>
      <p class="toast-title">${title}</p>
      ${message ? `<p class="toast-msg">${message}</p>` : ""}
    </div>
    <button class="toast-close" aria-label="Close">×</button>
  `;

  const remove = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector(".toast-close").addEventListener("click", remove);
  root.appendChild(toast);

  if (timeout) setTimeout(remove, timeout);
}

/* ---------- Custom confirm modal (replaces ugly browser confirm) ---------- */

function ensureConfirmModal() {
  if (document.getElementById("confirm-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "confirm-overlay";
  overlay.className = "confirm-overlay hidden";
  overlay.innerHTML = `
    <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button class="confirm-x" type="button" aria-label="Close">×</button>
      <h3 id="confirm-title">Remove book?</h3>
      <p class="confirm-msg">Are you sure you want to remove this book?</p>
      <div class="confirm-actions">
        <button class="confirm-cancel" type="button">Cancel</button>
        <button class="confirm-ok" type="button">Remove</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function confirmDialog({ title, message, okText = "OK", cancelText = "Cancel" }) {
  ensureConfirmModal();

  const overlay = document.getElementById("confirm-overlay");
  const titleEl = overlay.querySelector("#confirm-title");
  const msgEl = overlay.querySelector(".confirm-msg");
  const okBtn = overlay.querySelector(".confirm-ok");
  const cancelBtn = overlay.querySelector(".confirm-cancel");
  const xBtn = overlay.querySelector(".confirm-x");

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;

  overlay.classList.remove("hidden");

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.classList.add("hidden");
      overlay.removeEventListener("click", onOverlayClick);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      xBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    const onOverlayClick = (e) => {
      if (e.target === overlay) onCancel();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    xBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKey);
  });
}

/* ---------- Initial load = TBR ---------- */
loadShelf("TBR");

async function loadShelf(status) {
  shelfDiv.textContent = "Loading...";

  try {
    const res = await fetch(`/api/books?status=${status}`);
    const books = await res.json();

    if (!books.length) {
      shelfDiv.textContent = "No books in this shelf yet.";
      return;
    }

    shelfDiv.innerHTML = "";

    books.forEach((book) => {
      const card = document.createElement("div");
      card.className = "book-card";

      const authors =
        book.authors && book.authors.length
          ? book.authors.join(", ")
          : "Unknown author";

      card.innerHTML = `
        <img src="${book.coverImageUrl || ""}" alt="${book.title}">
        <div>
          <h3>${book.title}</h3>
          <p>${authors}</p>
          <p>Status: ${statusToTitle(book.status)}</p>
          <div class="actions">
            <button class="secondary" data-status="TBR" data-id="${book._id}">TBR</button>
            <button class="secondary" data-status="READ" data-id="${book._id}">Read</button>
            <button class="secondary" data-status="DNF" data-id="${book._id}">DNF</button>
            <button class="danger" data-delete-id="${book._id}">Remove</button>
          </div>
        </div>
      `;

      // Status buttons
      card.querySelectorAll("button[data-status]").forEach((btn) => {
        btn.addEventListener("click", () =>
          updateStatus(btn.dataset.id, btn.dataset.status, book.title)
        );
      });

      // Delete button (uses custom confirm modal)
      card
        .querySelector("button[data-delete-id]")
        .addEventListener("click", () => deleteBook(book._id, book.title));

      shelfDiv.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    shelfDiv.textContent = "Error loading shelf.";
  }
}

async function updateStatus(id, status, title = "") {
  try {
    const res = await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update status.");
    }

    showToast({
      title: "Updated",
      message: title ? `"${title}" moved to ${statusToTitle(status)}.` : `Moved to ${statusToTitle(status)}.`,
      type: "success",
    });

    // Refresh current shelf
    const active = document.querySelector(".shelf-book.active");
    const activeStatus = active ? active.dataset.status : currentStatus || "TBR";
    currentStatus = activeStatus;
    loadShelf(activeStatus);
  } catch (err) {
    console.error(err);
    showToast({
      title: "Couldn’t update",
      message: err.message || "Please try again.",
      type: "error",
      timeout: 3000,
    });
  }
}

async function deleteBook(bookId, title = "") {
  try {
    const confirmed = await confirmDialog({
      title: "Remove book?",
      message: "Are you sure you want to remove this book from your library?",
      okText: "Remove",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    const res = await fetch(`/api/books/${bookId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to delete book.");
    }

    showToast({
      title: "Book removed",
      message: title ? `"${title}" was removed from your library.` : "",
      type: "success",
    });

    // ✅ FIX: refresh shelf (no more loadLibrary() error)
    const active = document.querySelector(".shelf-book.active");
    const activeStatus = active ? active.dataset.status : currentStatus || "TBR";
    currentStatus = activeStatus;
    loadShelf(activeStatus);
  } catch (err) {
    console.error(err);
    showToast({
      title: "Couldn’t remove book",
      message: err.message || "Please try again.",
      type: "error",
      timeout: 3000,
    });
  }
}
