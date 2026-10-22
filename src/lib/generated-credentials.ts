// Web Crypto works in both the browser and server runtime.
export function randomDigits(length: 3 | 6) {
  const minimum = 10 ** (length - 1);
  const range = 9 * minimum;
  const limit = Math.floor(2 ** 32 / range) * range;
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return String(minimum + buffer[0] % range);
}
