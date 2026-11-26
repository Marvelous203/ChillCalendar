import { randomInt } from 'node:crypto';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Sinh mã phòng ngẫu nhiên 6–8 ký tự không chứa ký tự dễ nhầm. */
export function newRoomCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export const normalizeCode = (raw: string): string =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const isValidCode = (c: string): boolean =>
  /^[2-9A-HJ-KM-NP-Z]{6,8}$/.test(c);

export const showCode = (c: string): string => `#${c}`;
