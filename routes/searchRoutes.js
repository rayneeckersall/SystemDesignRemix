// routes/searchRoutes.js
const express = require('express');
const axios = require('axios');

const router = express.Router();
const BASE_URL = 'https://api.bigbookapi.com';

// Normalize titles so multiple editions of the same book collapse
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')     // remove (Edition …) etc.
    .replace(/[:\-–].*$/g, '')     // remove subtitles after colon/dash
    .replace(/\s+/g, ' ')
    .trim();
}

// GET /api/search?q=some+query&genre=fantasy (genre is optional)
router.get('/', async (req, res) => {
  const query = req.query.q;
  const genre = req.query.genre || null;

  if (!query) {
    return res.status(400).json({ error: 'Missing q query parameter' });
  }

  // how many unique books we want to end up with for the UI
  const TARGET_COUNT = 12;
  // how many books to ask BigBook for per request
  const PAGE_SIZE = 20;
  // hard limit so we don’t spam the API forever
  const MAX_REQUESTS = 5;

  const seenTitles = new Set();
  const collected = [];

  let offset = 0;
  let available = null;
  let requestCount = 0;

  try {
    while (
      collected.length < TARGET_COUNT &&
      requestCount < MAX_REQUESTS &&
      (available === null || offset < available) &&
      offset <= 1000 // BigBook docs: offset in [0,1000]
    ) {
      const params = {
        'api-key': process.env.BIGBOOK_API_KEY,
        query,
        number: PAGE_SIZE,
        offset,
      };

      // If front-end passed a genre, let BigBook help filter a bit
      if (genre && genre !== 'any') {
        params.genres = genre;
      }

      const response = await axios.get(`${BASE_URL}/search-books`, { params });
      const apiData = response.data;

      // BigBook metadata: how many total matches exist for this query
      if (available === null && typeof apiData.available === 'number') {
        available = apiData.available;
      }

      const rawBooks = apiData.books || apiData.data || [];

      // If BigBook returns nothing, stop trying further pages
      if (!rawBooks.length) {
        break;
      }

      for (const item of rawBooks) {
        const book = Array.isArray(item) ? item[0] : item;
        if (!book || !book.title) continue;

        const normTitle = normalizeTitle(book.title);
        if (!normTitle) continue;

        // de-dupe by normalized title so multiple editions collapse
        if (seenTitles.has(normTitle)) continue;
        seenTitles.add(normTitle);

        collected.push({
          bigBookId: book.id,
          title: book.title,
          authors: (book.authors || []).map((a) => a.name),
          coverImageUrl: book.image,
          // BigBook rating.average is 0–1; we keep that raw
          averageRating:
            book.rating && typeof book.rating.average === 'number'
              ? book.rating.average
              : null,
        });

        if (collected.length >= TARGET_COUNT) break;
      }

      // move to the next “page”
      const usedNumber =
        typeof apiData.number === 'number' && apiData.number > 0
          ? apiData.number
          : PAGE_SIZE;
      offset += usedNumber;
      requestCount += 1;
    }

    // sort highest-rated first so recs feel nice
    collected.sort((a, b) => {
      const ar = typeof a.averageRating === 'number' ? a.averageRating : 0;
      const br = typeof b.averageRating === 'number' ? b.averageRating : 0;
      return br - ar;
    });

    console.log(
      `🔍 Search "${query}" genre=${genre || 'none'} → sending ${collected.length} books (requests=${requestCount}, available=${available})`
    );

    res.json(collected);
  } catch (err) {
    console.error(
      'Error calling BigBook API:',
      err.response?.data || err.message
    );
    res.status(500).json({ error: 'Error fetching books from BigBook API' });
  }
});

module.exports = router;
