// Shared PoC helper for the live adversarial review.
// Provisions a REAL account against the running API (http://localhost:5080) by
// completing the real email-code flow — the 6-digit code is read straight out of
// MySQL (SMTP is unconfigured in dev, so the code is only stored, never sent).
//
// Usage (as a module):
//   import { provision, mintToken, api } from '../_lib/provision.mjs'
//   const u = await provision({ email: 'adv.t03.a@gmail.com', gender: 'female', studentType: 'student', isWorking: true })
//   // u = { userId, token, email, nickname }
//   const res = await api('GET', '/api/tasks', { token: u.token })
//
// Usage (CLI, prints JSON):
//   node provision.mjs adv.t03.a@gmail.com female student true
//
// mintToken(userId,email) forges an HS256 token with the committed dev key — use it
// to prove JWT forgery / to act as a user id without knowing its password.
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const BASE = process.env.ADV_BASE || 'http://localhost:5080'
const KEY = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION'
const ISS = 'planner-api'
const AUD = 'planner-client'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function mintToken(userId, email = 'forged@gmail.com', { expSeconds = 3600 * 24 } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ sub: String(userId), email, iss: ISS, aud: AUD, exp: now + expSeconds, iat: now })
  const sig = crypto.createHmac('sha256', KEY).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

export function userIdFromToken(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  return Number(payload.sub)
}

// Raw fetch wrapper. Returns { status, json, text }.
export async function api(method, path, { token, body, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = null }
  return { status: res.status, json, text }
}

function readCodeFromDb(email) {
  const sql = `SELECT Code FROM EmailVerificationCodes WHERE Email='${email}' ORDER BY Id DESC LIMIT 1;`
  const out = execFileSync('docker', [
    'exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql,
  ], { encoding: 'utf8' })
  return out.trim().split(/\s+/).pop()
}

// Create a real, confirmed account with a chosen profile. gender: 'female'|'male',
// studentType: 'pupil'|'student'|'none'|null, isWorking: bool.
export async function provision({
  email,
  nickname = 'Adv',
  gender = 'female',
  studentType = null,
  isWorking = false,
  password = 'Passw0rd!',
}) {
  const e = email.trim().toLowerCase()
  // best-effort cleanup of a stale code row for idempotent reruns
  try {
    execFileSync('docker', ['exec', 'planner-mysql', 'mysql', '-uplanner', '-pplanner_dev_password', 'planner',
      '-e', `DELETE FROM EmailVerificationCodes WHERE Email='${e}';`], { encoding: 'utf8' })
  } catch { /* ignore */ }

  const sc = await api('POST', '/api/auth/send-code', { body: { email: e, nickname } })
  if (sc.status !== 200) {
    // email_taken → account already exists, just log in
    if (sc.json?.error === 'email_taken') return login({ email: e, password })
    throw new Error(`send-code failed: ${sc.status} ${sc.text}`)
  }
  const code = readCodeFromDb(e)
  const reg = await api('POST', '/api/auth/register', {
    body: { nickname, gender, email: e, code, password, studentType, isWorking },
  })
  if (reg.status !== 200) {
    if (reg.json?.error === 'email_taken') return login({ email: e, password })
    throw new Error(`register failed: ${reg.status} ${reg.text}`)
  }
  return { userId: userIdFromToken(reg.json.token), token: reg.json.token, email: e, nickname }
}

export async function login({ email, password = 'Passw0rd!' }) {
  const res = await api('POST', '/api/auth/login', { body: { email: email.trim().toLowerCase(), password } })
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.text}`)
  return { userId: userIdFromToken(res.json.token), token: res.json.token, email, nickname: res.json.nickname }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('provision.mjs')) {
  const [, , email, gender = 'female', studentType = 'null', isWorking = 'false'] = process.argv
  if (email) {
    const u = await provision({
      email,
      gender,
      studentType: studentType === 'null' ? null : studentType,
      isWorking: isWorking === 'true',
    })
    process.stdout.write(JSON.stringify(u, null, 2) + '\n')
  }
}
