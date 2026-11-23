'use strict';

const crypto = require('crypto');
const store = require('../store');
const clock = require('../clock');
const config = require('../config');
const { AppError } = require('../errors');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid misreads
const CODE_LENGTH = 8;

const STATUS = Object.freeze({ ACTIVE: 'active', REDEEMED: 'redeemed', EXPIRED: 'expired' });

function generateCode() {
  let code;
  do {
    code = Array.from(crypto.randomBytes(CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  } while (store.codeIndex.has(code));
  return code;
}

// Status is derived at read time, so expiry needs no background job.
function statusOf(booking, now = clock.now()) {
  if (booking.redeemedAt) return STATUS.REDEEMED;
  if (now >= booking.expiresAt) return STATUS.EXPIRED;
  return STATUS.ACTIVE;
}

function toView(booking) {
  return {
    id: booking.id,
    userId: booking.userId,
    venueId: booking.venueId,
    code: booking.code,
    status: statusOf(booking),
    createdAt: booking.createdAt.toISOString(),
    expiresAt: booking.expiresAt.toISOString(),
    redeemedAt: booking.redeemedAt ? booking.redeemedAt.toISOString() : null,
  };
}

const dayKey = (date) => date.toISOString().slice(0, 10); // UTC calendar day

function getUserOrThrow(userId) {
  const user = store.users.get(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', `User "${userId}" does not exist.`);
  return user;
}

function getVenueOrThrow(venueId) {
  const venue = store.venues.get(venueId);
  if (!venue) throw new AppError(404, 'VENUE_NOT_FOUND', `Venue "${venueId}" does not exist.`);
  return venue;
}

// Everything below runs synchronously, so concurrent requests cannot interleave
// between the checks and the credit deduction.
function createBooking(userId, venueId) {
  const user = getUserOrThrow(userId);
  const venue = getVenueOrThrow(venueId);
  const now = clock.now();
  const today = dayKey(now);

  const todaysVenueBookings = [...store.bookings.values()].filter(
    (b) => b.venueId === venue.id && dayKey(b.createdAt) === today,
  );

  const duplicate = todaysVenueBookings.find(
    (b) => b.userId === user.id && statusOf(b, now) === STATUS.ACTIVE,
  );
  if (duplicate) {
    throw new AppError(
      409,
      'DUPLICATE_BOOKING',
      `You already have an active booking at ${venue.name} today (code ${duplicate.code}).`,
    );
  }

  // Expired bookings free up their spot; active and redeemed ones hold it.
  const used = todaysVenueBookings.filter((b) => statusOf(b, now) !== STATUS.EXPIRED).length;
  if (used >= venue.dailyCapacity) {
    throw new AppError(409, 'VENUE_FULL', `${venue.name} is fully booked for today. Please try another venue.`);
  }

  if (user.credits < 1) {
    throw new AppError(
      402,
      'INSUFFICIENT_CREDITS',
      `You don't have any visit credits left. Top up your credits to book ${venue.name}.`,
    );
  }

  user.credits -= 1;
  const booking = {
    id: crypto.randomUUID(),
    userId: user.id,
    venueId: venue.id,
    code: generateCode(),
    createdAt: now,
    expiresAt: new Date(now.getTime() + config.CODE_TTL_SECONDS * 1000),
    redeemedAt: null,
  };
  store.bookings.set(booking.id, booking);
  store.codeIndex.set(booking.code, booking.id);
  return toView(booking);
}

function redeemBooking(rawCode) {
  const code = rawCode.trim().toUpperCase();
  const booking = store.bookings.get(store.codeIndex.get(code));
  if (!booking) throw new AppError(404, 'CODE_NOT_FOUND', 'This redemption code is not valid.');

  const now = clock.now();
  const status = statusOf(booking, now);
  if (status === STATUS.REDEEMED) {
    throw new AppError(409, 'ALREADY_REDEEMED', `This code was already redeemed at ${booking.redeemedAt.toISOString()}.`);
  }
  if (status === STATUS.EXPIRED) {
    throw new AppError(410, 'CODE_EXPIRED', `This code expired at ${booking.expiresAt.toISOString()}.`);
  }

  booking.redeemedAt = now;
  return toView(booking);
}

function getUserWithBookings(userId) {
  const user = getUserOrThrow(userId);
  const bookings = [...store.bookings.values()]
    .filter((b) => b.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toView);
  return { id: user.id, name: user.name, credits: user.credits, bookings };
}

module.exports = { createBooking, redeemBooking, getUserWithBookings, STATUS };
