const test = require('node:test');
const assert = require('node:assert/strict');
const { safetyNumber, applyTeenNightMode } = require('../packages/proto/src/index.js');

test('demo flow: account to sticker to night mode', () => {
  const qrPayload = { uid: 'user123', publicIdentityKey: 'pubA', displayName: 'Nova', checksum: '123' };
  const qrEncoded = Buffer.from(JSON.stringify(qrPayload)).toString('base64url');
  const decoded = JSON.parse(Buffer.from(qrEncoded, 'base64url').toString('utf8'));
  assert.equal(decoded.uid, 'user123');

  const safety = safetyNumber('pubA', 'pubB');
  assert.match(safety, /^\d{6}$/);

  const teenNow = new Date(0);
  teenNow.setHours(23, 15, 0, 0);
  assert.equal(applyTeenNightMode(teenNow, 23 * 60, 5 * 60), true);
});
