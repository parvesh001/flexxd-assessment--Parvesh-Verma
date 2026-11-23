'use strict';

const express = require('express');
const service = require('../services/bookingService');

const router = express.Router();

router.get('/:id', (req, res) => {
  res.status(200).json(service.getUserWithBookings(req.params.id));
});

module.exports = router;
