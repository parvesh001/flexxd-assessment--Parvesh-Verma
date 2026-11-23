'use strict';

const { api, book, redeem, resetState, clock } = require('./helpers');
const config = require('../src/config');

beforeEach(resetState);

describe('GET /users/:id', () => {
  test('returns seeded user with credits and no bookings', async () => {
    const res = await api().get('/users/u1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'u1', name: 'Alice', credits: 3, bookings: [] });
  });

  test('reflects credits and all bookings with live statuses', async () => {
    const a = await book('u1', 'v1');
    const b = await book('u1', 'v2');
    await redeem(a.body.code);

    let res = await api().get('/users/u1');
    expect(res.body.credits).toBe(1);
    expect(res.body.bookings).toHaveLength(2);
    const byId = Object.fromEntries(res.body.bookings.map((x) => [x.id, x.status]));
    expect(byId).toEqual({ [a.body.id]: 'redeemed', [b.body.id]: 'active' });

    clock.advance(config.CODE_TTL_SECONDS * 1000);
    res = await api().get('/users/u1');
    const after = Object.fromEntries(res.body.bookings.map((x) => [x.id, x.status]));
    expect(after).toEqual({ [a.body.id]: 'redeemed', [b.body.id]: 'expired' });
  });

  test('does not include other users\' bookings', async () => {
    await book('u1', 'v1');
    const res = await api().get('/users/u2');
    expect(res.body.bookings).toEqual([]);
  });

  test('404 for unknown user', async () => {
    const res = await api().get('/users/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  test('404 JSON for unknown route', async () => {
    const res = await api().get('/nowhere');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
