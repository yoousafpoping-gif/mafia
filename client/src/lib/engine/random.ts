// Browser-safe crypto utilities (replaces node:crypto).
function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[randomBytes(1)[0] % CODE_ALPHABET.length];
  }
  return code;
}

export function randomToken(): string {
  return crypto.randomUUID();
}

export function secureShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0] % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
