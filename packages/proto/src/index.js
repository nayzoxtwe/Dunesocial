const MESSAGE_ENVELOPE = {
  version: 1,
  fields: ['conversationId', 'senderId', 'ciphertext', 'type', 'sentAt']
};

function safetyNumber(publicKeyA, publicKeyB) {
  const merged = [publicKeyA, publicKeyB].sort().join(':');
  let hash = 0;
  for (let i = 0; i < merged.length; i += 1) {
    hash = (hash * 31 + merged.charCodeAt(i)) % 1_000_000;
  }
  return hash.toString().padStart(6, '0');
}

function applyTeenNightMode(now, startMinutes, endMinutes) {
  const start = typeof startMinutes === 'number' ? startMinutes : 23 * 60;
  const end = typeof endMinutes === 'number' ? endMinutes : 5 * 60;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  return minutes >= start || minutes < end;
}

function coinPackEuroToCoins(amountEuro) {
  const base = Math.round(amountEuro * 100);
  return Math.round(base / 10) * 10;
}

module.exports = {
  MESSAGE_ENVELOPE,
  safetyNumber,
  applyTeenNightMode,
  coinPackEuroToCoins
};
