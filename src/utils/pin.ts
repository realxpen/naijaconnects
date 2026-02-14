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

const sha256Hex = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < data.length; i += 1) {
    hash = (hash * 31 + data[i]) >>> 0;
  }
  return String(hash);
};

export const verifyPinHash = async (
  pin: string,
  storedHash: string | null | undefined,
  opts?: { userId?: string | null; email?: string | null }
): Promise<boolean> => {
  if (!storedHash) return false;
  const target = String(storedHash);
  const salts = Array.from(
    new Set([
      opts?.userId || "",
      opts?.email || "",
      (opts?.email || "").toLowerCase(),
    ].filter(Boolean))
  );

  for (const salt of salts) {
    const h = await hashPin(pin, salt);
    if (h === target) return true;
  }

  // Legacy fallback: unsalted hash
  const legacy = await sha256Hex(pin);
  return legacy === target;
};
