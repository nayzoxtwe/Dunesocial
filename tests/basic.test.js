const test = require('node:test');
const assert = require('node:assert/strict');
const { applyTeenNightMode, coinPackEuroToCoins, safetyNumber } = require('../packages/proto/src/index.js');

test('teen night mode wraps over midnight', () => {
  const late = new Date(0);
  late.setHours(23, 30, 0, 0);
  assert.equal(applyTeenNightMode(late, 23 * 60, 5 * 60), true);
  const noon = new Date(0);
  noon.setHours(12, 0, 0, 0);
  assert.equal(applyTeenNightMode(noon, 23 * 60, 5 * 60), false);
});

test('coin packs round to nearest ten coins', () => {
  assert.equal(coinPackEuroToCoins(4.99), 500);
  assert.equal(coinPackEuroToCoins(0.99), 100);
});

test('safety number stable regardless ordering', () => {
  const a = safetyNumber('alice-key', 'bob-key');
  const b = safetyNumber('bob-key', 'alice-key');
  assert.equal(a, b);
  assert.equal(a.length, 6);
});
