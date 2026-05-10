const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes (we'll add these later)
app.get('/', (req, res) => {
  res.json({ message: 'TourneyHub API is running' });
});

module.exports = app;