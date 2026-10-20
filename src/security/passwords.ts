export const PASSWORD_HASH_ROUNDS = 12;
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

// bcrypt silently truncates beyond 72 bytes, including within UTF-8 characters.
export function isSupportedPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8 &&
    Buffer.byteLength(password, 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;
}

export function assertSupportedPassword(password: unknown): asserts password is string {
  if (!isSupportedPassword(password)) {
    throw new Error('Password must contain at least 8 characters and at most 72 UTF-8 bytes');
  }
}
