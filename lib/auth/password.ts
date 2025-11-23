import crypto from 'crypto'

const KEY_LENGTH = 64

const buildHash = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = buildHash(password, salt)
  return `${salt}:${hash}`
}

export const verifyPassword = (password: string, stored: string) => {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = buildHash(password, salt)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
}
