export const hashPin = async (pin: string, salt: string): Promise<string> => {
  const data = new TextEncoder().encode(`${pin}:${salt}`);
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (should not happen in modern browsers)
  let hash = 0;
  for (let i = 0; i < data.length; i += 1) {
    hash = (hash * 31 + data[i]) >>> 0;
  }
  return String(hash);
};

export const isValidPin = (pin: string, len: number | null) => {
  if (!/^\d+$/.test(pin)) return false;
  if (len) return pin.length === len;
  return pin.length === 4 || pin.length === 6;
};
