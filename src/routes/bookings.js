'use strict';

const express = require('express');
const service = require('../services/bookingService');
const { AppError } = require('../errors');

const router = express.Router();

function requireString(body, field) {
  const value = body?.[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, 'VALIDATION_ERROR', `"${field}" is required and must be a non-empty string.`);
  }
  return value.trim();
}

router.post('/', (req, res) => {
  const userId = requireString(req.body, 'userId');
  const venueId = requireString(req.body, 'venueId');
  res.status(201).json(service.createBooking(userId, venueId));
});

router.post('/redeem', (req, res) => {
  const code = requireString(req.body, 'code');
  res.status(200).json(service.redeemBooking(code));
});

module.exports = router;
