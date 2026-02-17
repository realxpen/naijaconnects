const normalizePin = (pin: string) => String(pin ?? "").replace(/\D/g, "");

const sha256Fallback = (input: string): string => {
  // Deterministic SHA-256 fallback for environments without SubtleCrypto
  // (e.g. non-secure mobile HTTP contexts).
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  let i: number, j: number;
  let result = "";
  const words: number[] = [];
  const asciiBitLength = input[lengthProperty] * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = true;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  input += "\x80";
  while ((input[lengthProperty] % 64) - 56) input += "\x00";
  for (i = 0; i < input[lengthProperty]; i += 1) {
    j = input.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i += 1) {
      const i2 = i + j;
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i += 1) {
    for (j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16 ? 0 : "") + b.toString(16));
    }
  }
  return result;
};

const sha256Hex = async (input: string): Promise<string> => {
  const data = new TextEncoder().encode(input);
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Fallback(input);
};

export const hashPin = async (pin: string, salt: string): Promise<string> => {
  return sha256Hex(`${normalizePin(pin)}:${salt}`);
};

export const isValidPin = (pin: string, len: number | null) => {
  const normalized = normalizePin(pin);
  if (!/^\d+$/.test(normalized)) return false;
  if (len) return normalized.length === len;
  return normalized.length === 4 || normalized.length === 6;
};

export const verifyPinHash = async (
  pin: string,
  storedHash: string | null | undefined,
  opts?: { userId?: string | null; email?: string | null }
): Promise<boolean> => {
  if (!storedHash) return false;
  const normalizedPin = normalizePin(pin);
  const target = String(storedHash);
  const salts = Array.from(
    new Set([
      opts?.userId || "",
      opts?.email || "",
      (opts?.email || "").toLowerCase(),
    ].filter(Boolean))
  );

  for (const salt of salts) {
    const h = await hashPin(normalizedPin, salt);
    if (h === target) return true;
  }

  // Legacy fallback: unsalted hash
  const legacy = await sha256Hex(normalizedPin);
  return legacy === target;
};
