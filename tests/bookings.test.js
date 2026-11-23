'use strict';

const { api, book, redeem, resetState, store, clock } = require('./helpers');
const config = require('../src/config');

beforeEach(resetState);

describe('POST /bookings', () => {
  test('creates a booking, deducts one credit, returns a code', async () => {
    const res = await book('u1', 'v2');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: 'u1', venueId: 'v2', status: 'active', redeemedAt: null });
    expect(res.body.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(new Date(res.body.expiresAt) - new Date(res.body.createdAt)).toBe(config.CODE_TTL_SECONDS * 1000);
    expect(store.users.get('u1').credits).toBe(2);
  });

  test.each([
    [{}, 'userId'],
    [{ userId: 'u1' }, 'venueId'],
    [{ userId: '', venueId: 'v1' }, 'userId'],
    [{ userId: 123, venueId: 'v1' }, 'userId'],
  ])('400 when body is %j', async (body, field) => {
    const res = await api().post('/bookings').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain(field);
  });

  test('400 on malformed JSON', async () => {
    const res = await api().post('/bookings').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  test('404 for unknown user', async () => {
    const res = await book('nope', 'v1');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  test('404 for unknown venue, no credit deducted', async () => {
    const res = await book('u1', 'nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VENUE_NOT_FOUND');
    expect(store.users.get('u1').credits).toBe(3);
  });

  test('402 with a friendly message when user has no credits', async () => {
    const res = await book('u2', 'v1');
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
    expect(res.body.error.message).toMatch(/don't have any visit credits/);
    expect(store.users.get('u2').credits).toBe(0);
  });

  test('402 once credits run out', async () => {
    store.users.get('u1').credits = 1;
    expect((await book('u1', 'v1')).status).toBe(201);
    const res = await book('u1', 'v2');
    expect(res.status).toBe(402);
    expect(store.users.get('u1').credits).toBe(0);
  });

  test('409 on duplicate active booking at same venue same day, no extra credit spent', async () => {
    await book('u1', 'v2');
    const res = await book('u1', 'v2');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_BOOKING');
    expect(store.users.get('u1').credits).toBe(2);
  });

  test('can book same venue again after the earlier booking was redeemed', async () => {
    const first = await book('u1', 'v2');
    await redeem(first.body.code);
    expect((await book('u1', 'v2')).status).toBe(201);
  });

  test('409 when venue is at daily capacity', async () => {
    store.users.set('u3', { id: 'u3', name: 'Cara', credits: 5 });
    await book('u1', 'v1');
    await book('u3', 'v1'); // v1 capacity = 2
    store.users.get('u2').credits = 1;

    const res = await book('u2', 'v1');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VENUE_FULL');
    expect(store.users.get('u2').credits).toBe(1);
  });

  test('402 (not VENUE_FULL) when user has no credits and venue is full', async () => {
    store.users.set('u3', { id: 'u3', name: 'Cara', credits: 5 });
    await book('u1', 'v1');
    await book('u3', 'v1'); // v1 now full

    const res = await book('u2', 'v1'); // u2 has 0 credits
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
  });

  test('expired bookings free capacity and allow rebooking; credit is not refunded', async () => {
    store.users.set('u3', { id: 'u3', name: 'Cara', credits: 5 });
    await book('u1', 'v1');
    await book('u3', 'v1');

    clock.advance(config.CODE_TTL_SECONDS * 1000);

    const res = await book('u1', 'v1');
    expect(res.status).toBe(201);
    expect(store.users.get('u1').credits).toBe(1); // 3 - 2, no refund for the expired one
  });

  test('parallel requests cannot overspend the last credit', async () => {
    store.users.get('u1').credits = 1;
    const results = await Promise.all([book('u1', 'v1'), book('u1', 'v2')]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 402]);
    expect(store.users.get('u1').credits).toBe(0);
  });
});

describe('POST /bookings/redeem', () => {
  test('redeems an active code', async () => {
    const { body: booking } = await book('u1', 'v1');
    const res = await redeem(booking.code);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: booking.id, status: 'redeemed' });
    expect(res.body.redeemedAt).not.toBeNull();
  });

  test('code matching is case-insensitive and trims whitespace', async () => {
    const { body: booking } = await book('u1', 'v1');
    const res = await redeem(`  ${booking.code.toLowerCase()} `);
    expect(res.status).toBe(200);
  });

  test('409 on second redemption', async () => {
    const { body: booking } = await book('u1', 'v1');
    await redeem(booking.code);
    const res = await redeem(booking.code);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_REDEEMED');
  });

  test('404 for unknown code', async () => {
    const res = await redeem('NOTACODE');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CODE_NOT_FOUND');
  });

  test('400 when code is missing', async () => {
    const res = await api().post('/bookings/redeem').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('still redeemable one second before expiry', async () => {
    const { body: booking } = await book('u1', 'v1');
    clock.advance(config.CODE_TTL_SECONDS * 1000 - 1000);
    expect((await redeem(booking.code)).status).toBe(200);
  });

  test('410 once the code has expired', async () => {
    const { body: booking } = await book('u1', 'v1');
    clock.advance(config.CODE_TTL_SECONDS * 1000);
    const res = await redeem(booking.code);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('CODE_EXPIRED');
  });

  test('a redeemed booking stays redeemed after the expiry time passes', async () => {
    const { body: booking } = await book('u1', 'v1');
    await redeem(booking.code);
    clock.advance(config.CODE_TTL_SECONDS * 1000 * 2);
    const res = await api().get('/users/u1');
    expect(res.body.bookings[0].status).toBe('redeemed');
  });
});
