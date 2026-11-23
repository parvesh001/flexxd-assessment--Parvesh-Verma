'use strict';

const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store');
const clock = require('../src/clock');

const api = () => request(app);
const book = (userId, venueId) => api().post('/bookings').send({ userId, venueId });
const redeem = (code) => api().post('/bookings/redeem').send({ code });

function resetState() {
  store.reset();
  clock.reset();
}

module.exports = { api, book, redeem, resetState, store, clock };
