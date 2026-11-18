function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!/^\+?[\d\s()-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || digits[0] === '0') return null;
  return `+${digits}`;
}

module.exports = { normalizePhone };
