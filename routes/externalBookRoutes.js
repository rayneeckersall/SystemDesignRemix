// routes/externalBookRoutes.js
const express = require('express');
const axios = require('axios');

const router = express.Router();
const BASE_URL = 'https://api.bigbookapi.com';

router.get('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const response = await axios.get(`${BASE_URL}/${id}`, {
      params: { 'api-key': process.env.BIGBOOK_API_KEY },
    });

    const data = response.data;

    res.json({
      id: data.id,
      title: data.title,
      image: data.image,
      authors: (data.authors || []).map((a) => a.name),
      numberOfPages: data.number_of_pages || null,
      description: data.description || '',
      averageRating:
        data.rating && typeof data.rating.average === 'number'
          ? data.rating.average
          : null,
    });
  } catch (err) {
    console.error('Error fetching book details:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error fetching book details' });
  }
});

module.exports = router;
