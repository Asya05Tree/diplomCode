import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const nlp = path.resolve(here, '../../../client/src/utils/nlp/index.js')
const { parseInput } = await import(pathToFileURL(nlp).href)
console.log('Scaling of parseInput on N repeats of "завтра " (main-thread blocking time):')
for (const n of [500, 1000, 2000, 4000, 8000]) {
  const input = 'завтра '.repeat(n)
  const t0 = process.hrtime.bigint()
  parseInput(input, new Date('2026-11-04T10:00:00'))
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  console.log(`  n=${String(n).padStart(5)}  (${String(input.length).padStart(6)} chars)  ${ms.toFixed(0)} ms`)
}
