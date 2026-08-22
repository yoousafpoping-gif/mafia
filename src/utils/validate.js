import { assert, ErrorCodes } from '../errors/GameError.js';
import { LIMITS } from '../game/constants.js';

export function sanitizeName(rawName) {
  assert(typeof rawName === 'string', ErrorCodes.VALIDATION_ERROR, 'A player name is required');
  const name = rawName.replace(/\s+/g, ' ').trim();
  assert(
    name.length >= LIMITS.NAME_MIN && name.length <= LIMITS.NAME_MAX,
    ErrorCodes.VALIDATION_ERROR,
    `Player name must be ${LIMITS.NAME_MIN}-${LIMITS.NAME_MAX} characters`,
  );
  return name;
}

export function sanitizeChatText(rawText, maxLength) {
  assert(typeof rawText === 'string', ErrorCodes.VALIDATION_ERROR, 'Message text is required');
  const text = rawText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  assert(text.length > 0, ErrorCodes.VALIDATION_ERROR, 'Message cannot be empty');
  assert(text.length <= maxLength, ErrorCodes.VALIDATION_ERROR, `Message must be at most ${maxLength} characters`);
  return text;
}
