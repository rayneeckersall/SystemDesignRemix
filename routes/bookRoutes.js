// routes/bookRoutes.js
const express = require('express');
const axios = require('axios');
const Book = require('../models/Book');

const router = express.Router();
const BASE_URL = 'https://api.bigbookapi.com';

// GET /api/books?status=TBR|READ|DNF
router.get('/', async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};

  try {
    const books = await Book.find(filter).sort({ createdAt: -1 });
    console.log('📚 GET /api/books', filter, '→', books.length, 'books');
    res.json(books);
  } catch (err) {
    console.error('❌ Error loading books from DB:', err);
    res.status(500).json({ error: 'Error loading books from database' });
  }
});

// POST /api/books
// body: { bigBookId, status }
router.post('/', async (req, res) => {
  const { bigBookId, status } = req.body;
  console.log('🔹 POST /api/books body:', req.body);

  if (!bigBookId || !status) {
    return res.status(400).json({ error: 'bigBookId and status are required' });
  }

  try {
    // 1) if book already exists, just update the status
    const existing = await Book.findOne({ bigBookId });
    if (existing) {
      existing.status = status;
      const saved = await existing.save();
      console.log('✅ Updated existing book:', saved.title, '→', saved.status);
      return res.json(saved);
    }

    // 2) otherwise, fetch full details from Big Book API
    const url = `${BASE_URL}/${bigBookId}`;
    const response = await axios.get(url, {
      params: { 'api-key': process.env.BIGBOOK_API_KEY }
    });

    const data = response.data;
    console.log('🌐 BigBook detail response id/title:', data.id, data.title);

    // authors comes back as [{ id, name }] → we want ["name", ...]
    const authors = (data.authors || []).map(a => a.name);

    // rating comes back as { average: number } → we want just the number
    const averageRating =
      data.rating && typeof data.rating.average === 'number'
        ? data.rating.average
        : null;

    const book = await Book.create({
      bigBookId: data.id,
      title: data.title,
      authors,
      coverImageUrl: data.image,
      averageRating,
      status
    });

    console.log('✅ Saved new book:', book.title, 'with status', book.status);
    res.status(201).json(book);
  } catch (err) {
    console.error(
      '❌ Error creating book:',
      err.response?.data || err.message || err
    );
    res
      .status(500)
      .json({ error: 'Error saving book', details: err.message || 'Unknown' });
  }
});

// DELETE /api/books/:id
router.delete('/:id', async (req, res) => {
  try {
    await Book.findByIdAndDelete(req.params.id);
    console.log('🗑️ Deleted book', req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('❌ Error deleting book:', err);
    res.status(500).json({ error: 'Error deleting book' });
  }
});

// PATCH /api/books/:id
router.patch('/:id', async (req, res) => {
  try {
    const updated = await Book.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    console.log('✏️ Updated book', req.params.id, '→', updated?.status);
    res.json(updated);
  } catch (err) {
    console.error('❌ Error updating book:', err);
    res.status(500).json({ error: 'Error updating book' });
  }
});

module.exports = router;
