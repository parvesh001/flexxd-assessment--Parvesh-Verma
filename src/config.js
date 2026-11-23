'use strict';

function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

module.exports = {
  PORT: readPositiveInt('PORT', 3000),
  // How long a redemption code stays valid after booking.
  CODE_TTL_SECONDS: readPositiveInt('CODE_TTL_SECONDS', 3600),
};
