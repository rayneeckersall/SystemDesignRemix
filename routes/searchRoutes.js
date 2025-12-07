// routes/searchRoutes.js
const express = require('express');
const axios = require('axios');

const router = express.Router();
const BASE_URL = 'https://api.bigbookapi.com';

// GET /api/search?q=harry+potter
router.get('/', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing q query parameter' });
  }

  try {
    const url = `${BASE_URL}/search-books`;
    const response = await axios.get(url, {
      params: {
        'api-key': process.env.BIGBOOK_API_KEY,
        query
      }
    });

    const apiData = response.data;

    // BigBook returns "books" as an array of arrays: [ [book1], [book2], ... ]
    const rawBooks = apiData.books || [];

    const results = rawBooks.map(group => {
      const book = Array.isArray(group) ? group[0] : group;
      return {
        bigBookId: book.id,
        title: book.title,
        authors: (book.authors || []).map(a => a.name),
        coverImageUrl: book.image,
        averageRating: book.rating?.average ?? null
      };
    });

    res.json(results);
  } catch (err) {
    console.error('Error calling BigBook API:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error fetching books from BigBook API' });
  }
});

module.exports = router;
