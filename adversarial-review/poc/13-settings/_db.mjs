// Tiny MySQL query helper for the Settings (TAB 13) PoCs. Read-only assertions
// against the planner DB. Returns rows as arrays of tab-split cells (mysql -N).
import { execFileSync } from 'node:child_process'

export function db(sql) {
  const out = execFileSync('docker', [
    'exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql,
  ], { encoding: 'utf8' })
  return out.trim() === '' ? [] : out.trim().split('\n').map((l) => l.split('\t'))
}

// Convenience: read the single UserProfile row for a userId as an object.
export function profileOf(userId) {
  // HistoryRetentionDays прибрано з моделі в сесії 13 (мертва колонка) — більше не читаємо.
  const rows = db(`SELECT Height, Weight, BirthYear, Gender, StudentType, IsWorking, Language, Theme, AccentColor
                   FROM UserProfiles WHERE UserId=${userId};`)
  if (!rows.length) return null
  const [Height, Weight, BirthYear, Gender, StudentType, IsWorking, Language, Theme, AccentColor] = rows[0]
  return { Height, Weight, BirthYear, Gender, StudentType, IsWorking, Language, Theme, AccentColor }
}
