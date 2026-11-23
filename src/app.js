'use strict';

const express = require('express');
const bookingsRouter = require('./routes/bookings');
const usersRouter = require('./routes/users');
const { AppError } = require('./errors');

const app = express();
app.use(express.json());

app.use('/bookings', bookingsRouter);
app.use('/users', usersRouter);

app.use((req, res) => {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `${req.method} ${req.path} does not exist.` } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
});

module.exports = app;
