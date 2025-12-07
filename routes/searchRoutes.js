// routes/searchRoutes.js
const express = require('express');
const axios = require('axios');

const router = express.Router();
const BASE_URL = 'https://api.bigbookapi.com';

// aggressively normalize titles so Gatsby doesn't appear 10 times
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')        // remove (Edition …)
    .replace(/[:\-–].*$/g, '')       // remove subtitles
    .replace(/\s+/g, ' ')
    .trim();
}

router.get('/', async (req, res) => {
  const query = req.query.q;
  const genre = req.query.genre || 'any';
  const ratingFilter = req.query.rating || 'any';
  const lengthFilter = req.query.length || 'any';

  if (!query) {
    return res.status(400).json({ error: 'Missing q query parameter' });
  }

  try {
    const params = {
      'api-key': process.env.BIGBOOK_API_KEY,
      query,
      number: 40, // get more, we'll filter down
    };

    if (genre !== 'any') {
      params.genres = genre; // BigBook supports genres filter
    }

    const response = await axios.get(`${BASE_URL}/search-books`, { params });
    const apiData = response.data;
    const rawBooks = apiData.books || [];

    const deduped = [];
    const seenKeys = new Set();

    for (const group of rawBooks) {
      const book = Array.isArray(group) ? group[0] : group;
      if (!book || !book.title) continue;

      const normTitle = normalizeTitle(book.title);
      const firstAuthor =
        book.authors && book.authors.length ? book.authors[0].name : '';
      const image = book.image || '';

      const key = `${normTitle}|${firstAuthor.toLowerCase().trim()}|${image}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      deduped.push({
        bigBookId: book.id,
        title: book.title,
        authors: (book.authors || []).map((a) => a.name),
        coverImageUrl: book.image,
        averageRating:
          book.rating && typeof book.rating.average === 'number'
            ? book.rating.average
            : null,
      });
    }

    // rating filter (client gives “3”, “4.5” stars)
    let filtered = deduped;
    if (ratingFilter !== 'any') {
      const stars = parseFloat(ratingFilter);
      if (!Number.isNaN(stars)) {
        const threshold = stars / 5; // BigBook ratings are 0–1
        filtered = filtered.filter(
          (b) => b.averageRating === null || b.averageRating >= threshold
        );
      }
    }

    // length filter → we need number_of_pages from Get Book Information
    if (lengthFilter !== 'any') {
      const buckets = {
        short: [0, 250],
        medium: [251, 400],
        long: [401, Infinity],
      };
      const [minPages, maxPages] = buckets[lengthFilter] || [0, Infinity];

      const lengthFiltered = [];

      for (const book of filtered) {
        try {
          const detailsRes = await axios.get(`${BASE_URL}/${book.bigBookId}`, {
            params: { 'api-key': process.env.BIGBOOK_API_KEY },
          });

          const pages = detailsRes.data.number_of_pages;
          if (!pages) continue;
          if (pages >= minPages && pages <= maxPages) {
            lengthFiltered.push(book);
          }
        } catch (err) {
          console.error('Error fetching length details:', err.message);
        }
        if (lengthFiltered.length >= 12) break;
      }

      filtered = lengthFiltered;
    }

    // cap to 12 to keep shelf from being huge
    filtered = filtered.slice(0, 12);

    console.log(
      `🔍 Search "${query}" genre=${genre}, rating=${ratingFilter}, length=${lengthFilter} → ${filtered.length} results`
    );

    res.json(filtered);
  } catch (err) {
    console.error(
      'Error calling BigBook API:',
      err.response?.data || err.message
    );
    res.status(500).json({ error: 'Error fetching books from BigBook API' });
  }
});

module.exports = router;
