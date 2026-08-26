const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/u;
const ALLOWED_CHARS = /^[\p{Script=Arabic}\p{Script=Latin}\p{M}\p{N} ]+$/u;
const RESERVED_NAMES = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'system', 'server', 'support',
  'mafia', 'guest', 'anonymous', 'null', 'undefined',
  'ادمن', 'أدمن', 'مشرف', 'النظام', 'السيرفر', 'الدعم', 'مافيا', 'ضيف', 'مجهول',
]);

export function validatePlayerName(rawName) {
  if (typeof rawName !== 'string') {
    return { ok: false, code: 'PLAYER_NAME_REQUIRED', message: 'اسم اللاعب مطلوب' };
  }
  const name = rawName.trim();
  if (CONTROL_CHARS.test(name)) {
    return { ok: false, code: 'PLAYER_NAME_CONTROL_CHARS', message: 'الاسم يحتوي على رموز غير مسموحة' };
  }
  if (/\s{2,}/u.test(name)) {
    return { ok: false, code: 'PLAYER_NAME_REPEATED_SPACES', message: 'استخدم مسافة واحدة فقط بين الكلمات' };
  }
  const length = [...name].length;
  if (length < 2 || length > 16) {
    return { ok: false, code: 'PLAYER_NAME_LENGTH', message: 'الاسم لازم يكون من 2 إلى 16 حرف' };
  }
  if (!ALLOWED_CHARS.test(name)) {
    return { ok: false, code: 'PLAYER_NAME_CHARACTERS', message: 'استخدم حروف عربية أو لاتينية وأرقام فقط' };
  }
  if (RESERVED_NAMES.has(name.toLocaleLowerCase('ar'))) {
    return { ok: false, code: 'PLAYER_NAME_RESERVED', message: 'الاسم ده محجوز — اختار اسم تاني' };
  }
  return { ok: true, name };
}

export function requirePlayerName(rawName) {
  const result = validatePlayerName(rawName);
  if (!result.ok) throw Object.assign(new Error(result.message), { code: result.code, status: 400 });
  return result.name;
}
