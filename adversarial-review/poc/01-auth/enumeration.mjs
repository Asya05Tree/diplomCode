// §8: account enumeration via send-code (email_taken vs 200) and consistent login shape.
import { provision, api } from '../_lib/provision.mjs'

// A known-existing account:
const u = await provision({ email: 'adv.t01.enum@gmail.com', nickname: 'Enum', gender: 'female' })

const existing = await api('POST', '/api/auth/send-code', { body: { email: u.email, nickname: 'Enum' } })
const unknown = await api('POST', '/api/auth/send-code', { body: { email: 'adv.t01.nobody-xyz@gmail.com', nickname: 'Enum' } })

console.log(`[probe] send-code for EXISTING  ${u.email} -> ${existing.status} ${existing.text}`)
console.log(`[probe] send-code for UNKNOWN   adv.t01.nobody-xyz@gmail.com -> ${unknown.status} ${unknown.text}`)

const enumerable = existing.status !== unknown.status || (existing.json?.error === 'email_taken')
console.log(enumerable
  ? `CONFIRMED: send-code returns 400 email_taken for registered addresses and 200 for free ones -> anyone can enumerate which gmail addresses have an account (AuthController.cs:50-51). Expected identical response.`
  : `NOT CONFIRMED`)

// Login error shape: same 'invalid_credentials' for unknown user and wrong password (good) — verify.
const wrongPw = await api('POST', '/api/auth/login', { body: { email: u.email, password: 'wrong-password' } })
const noUser = await api('POST', '/api/auth/login', { body: { email: 'adv.t01.nobody-xyz@gmail.com', password: 'wrong-password' } })
console.log(`[login] wrong password -> ${wrongPw.status} ${wrongPw.text}`)
console.log(`[login] unknown user   -> ${noUser.status} ${noUser.text}`)
console.log(wrongPw.text === noUser.text
  ? `NOTE: login itself is enumeration-safe (identical "${wrongPw.json?.error}" for both).`
  : `NOTE: login error shapes DIFFER -> login is also enumerable.`)
