// Tiny MySQL query helper for the watchlist PoCs (read-only assertions against
// the planner DB). Returns rows as arrays of tab-split cells (mysql -N).
import { execFileSync } from 'node:child_process'

export function db(sql) {
  const out = execFileSync('docker', [
    'exec', 'planner-mysql', 'mysql', '-N', '-uplanner', '-pplanner_dev_password', 'planner', '-e', sql,
  ], { encoding: 'utf8' })
  return out.trim() === '' ? [] : out.trim().split('\n').map((l) => l.split('\t'))
}
