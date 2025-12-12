// routes/searchRoutes.js
const express = require("express");
const axios = require("axios");

const router = express.Router();
const BASE_URL = "https://api.bigbookapi.com";

const ALLOWED_GENRES = new Set(["fantasy", "romance", "classics", "dystopia"]);

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")     // remove (Edition …)
    .replace(/[:\-–].*$/g, "")     // remove subtitles
    .replace(/[^a-z0-9]+/gi, " ")  // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

router.get("/", async (req, res) => {
  const query = req.query.q;
  const genre = req.query.genre || "any";
  const seed = req.query.seed || null;

  if (!query) {
    return res.status(400).json({ error: "Missing q query parameter" });
  }

  const TARGET_COUNT = 12;
  const PAGE_SIZE = 20;
  const MAX_REQUESTS = 6;

  try {
    // ---- 1) Probe request to learn how many results exist ----
    const probeParams = {
      "api-key": process.env.BIGBOOK_API_KEY,
      query,
      number: PAGE_SIZE,
      offset: 0,
    };

    if (genre !== "any" && ALLOWED_GENRES.has(genre)) {
      probeParams.genres = genre;
    }

    const probeRes = await axios.get(`${BASE_URL}/search-books`, {
      params: probeParams,
    });
    const probeData = probeRes.data;

    const available =
      typeof probeData.available === "number" ? probeData.available : 0;

    // ---- 2) Choose a random starting offset based on seed ----
    // BigBook docs: offset max 1000, so clamp.
    let offset = 0;

    if (seed && available > PAGE_SIZE) {
      const seedNum =
        Number(String(seed).slice(-6)) || Math.floor(Math.random() * 999999);

      const maxOffset = Math.min(1000, Math.max(0, available - PAGE_SIZE));

      offset = seedNum % (maxOffset + 1);

      // snap to page boundary so we don't request odd offsets
      offset = Math.floor(offset / PAGE_SIZE) * PAGE_SIZE;
    }

    // ---- 3) Collect unique books starting from that offset ----
    const seenTitles = new Set();
    const collected = [];

    let requests = 0;

    while (collected.length < TARGET_COUNT && requests < MAX_REQUESTS) {
      const pageParams = {
        "api-key": process.env.BIGBOOK_API_KEY,
        query,
        number: PAGE_SIZE,
        offset,
      };

      if (genre !== "any" && ALLOWED_GENRES.has(genre)) {
        pageParams.genres = genre;
      }

      const pageRes = await axios.get(`${BASE_URL}/search-books`, {
        params: pageParams,
      });
      const pageData = pageRes.data;
      const rawBooks = pageData.books || pageData.data || [];

      if (!rawBooks.length) break;

      for (const item of rawBooks) {
        const book = Array.isArray(item) ? item[0] : item;
        if (!book || !book.title) continue;

        const normTitle = normalizeTitle(book.title);
        if (!normTitle || seenTitles.has(normTitle)) continue;

        seenTitles.add(normTitle);

        collected.push({
          bigBookId: book.id,
          title: book.title,
          authors: (book.authors || []).map((a) => a.name),
          coverImageUrl: book.image,
          averageRating:
            book.rating && typeof book.rating.average === "number"
              ? book.rating.average
              : null,
        });

        if (collected.length >= TARGET_COUNT) break;
      }

      offset += PAGE_SIZE;
      if (offset > 1000) break;
      requests += 1;
    }

    // Optional: make the shelf look better (higher-rated first)
    collected.sort((a, b) => {
      const ar = typeof a.averageRating === "number" ? a.averageRating : 0;
      const br = typeof b.averageRating === "number" ? b.averageRating : 0;
      return br - ar;
    });

    console.log(
      `🔁 seed=${seed} query="${query}" genre=${genre} available=${available} startOffset=${offset -
        requests * PAGE_SIZE} pages=${requests + 1} -> ${collected.length}`
    );

    // prevent caching at the HTTP level
    res.set("Cache-Control", "no-store");
    res.json(collected);
  } catch (err) {
    console.error("Error calling BigBook API:", err.response?.data || err.message);
    res.status(500).json({ error: "Error fetching books from BigBook API" });
  }
});

module.exports = router;
