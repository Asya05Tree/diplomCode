# Security PoCs — "Всетут"

Attacker-side reproductions for the findings in
`adversarial-review/sections/01-security-hacker.md`.

| # | File | Finding | Needs live server? | Executed here |
|---|------|---------|--------------------|---------------|
| 1 | `01-jwt-forgery.ps1` | Forge JWT for any user (committed placeholder key) | yes (crypto is offline) | No |
| 2 | `02-billing-paywall-bypass.ps1` | Free unlock via mock-confirm + unsigned callback | yes | No |
| 3 | `03-email-code-bruteforce.ps1` | 6-digit code brute force, no lockout/rate limit | yes | No |
| 4 | `04-account-enumeration-and-abuse.http` | Email enumeration + open send-code | yes | No |
| 5 | `05-token-never-revoked.ps1` | Token valid 90d, logout is client-only | yes | No |

Nothing was executed against a live target because no server/MySQL is running in this
review environment. Every finding is additionally confirmed by static source citation
(file:line) in the report. Default API base URL assumed: `http://localhost:5080`.

PowerShell PoCs: `powershell -ExecutionPolicy Bypass -File <script>.ps1 -BaseUrl http://localhost:5080 ...`
