// Спільні правила валідації форм реєстрації/входу — той самий набір символів,
// що й на бекенді (AuthController.NicknamePattern), щоб фронт і бек не розходились.

export const NICKNAME_MAX_LENGTH = 30
export const EMAIL_MAX_LENGTH = 254
export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 72 // bcrypt мовчки обрізає довші паролі — довше немає сенсу

const NICKNAME_CHAR = /[A-Za-zА-ЯҐЄІЇа-яґєіїʼ' -]/
const NICKNAME_FULL = /^[A-Za-zА-ЯҐЄІЇа-яґєіїʼ' -]{2,30}$/
const EMAIL_CHAR = /[A-Za-z0-9@._+-]/
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidNickname(text) {
  return NICKNAME_FULL.test(text)
}

export function isValidEmailFormat(email) {
  return EMAIL_FORMAT.test(email)
}

export function isGmailAddress(email) {
  return email.toLowerCase().endsWith('@gmail.com')
}

// Фільтрує символи одразу під час набору — недопустимий символ просто не з'являється в полі
export function filterNickname(text) {
  return text.split('').filter((ch) => NICKNAME_CHAR.test(ch)).join('').slice(0, NICKNAME_MAX_LENGTH)
}

export function filterEmailChars(text) {
  return text.split('').filter((ch) => EMAIL_CHAR.test(ch)).join('').slice(0, EMAIL_MAX_LENGTH)
}
