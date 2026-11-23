'use strict';

// In-memory data. Restarting the server (or calling reset) restores the seed.
const users = new Map();
const venues = new Map();
const bookings = new Map(); // bookingId -> booking
const codeIndex = new Map(); // CODE -> bookingId

function seed() {
  users.set('u1', { id: 'u1', name: 'Alice', credits: 3 });
  users.set('u2', { id: 'u2', name: 'Bob', credits: 0 });

  venues.set('v1', { id: 'v1', name: 'City Gym', pricePerVisit: 15, dailyCapacity: 2 });
  venues.set('v2', { id: 'v2', name: 'Yoga Loft', pricePerVisit: 20, dailyCapacity: 10 });
}

function reset() {
  users.clear();
  venues.clear();
  bookings.clear();
  codeIndex.clear();
  seed();
}

seed();

module.exports = { users, venues, bookings, codeIndex, reset };
