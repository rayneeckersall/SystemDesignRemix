// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const searchRoutes = require('./routes/searchRoutes');
const bookRoutes = require('./routes/bookRoutes');
const externalBookRoutes = require('./routes/externalBookRoutes'); // ⬅ add this

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// connect to MongoDB
connectDB();

// middleware
app.use(cors());
app.use(express.json());

// serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/external-books', externalBookRoutes);

// fallback route (optional): send index.html if root is hit
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`📚 Server running on http://localhost:${PORT}`);
});

