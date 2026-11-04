# PoC #5 — "Logout" does not revoke the token; tokens live 90 days with no server-side
#           invalidation. A leaked/stolen token is valid for 3 months.
#
# Root cause:
#   - JwtService.cs:34  expires: DateTime.UtcNow.AddDays(90)
#   - There is NO token blacklist / jti / server session store anywhere.
#   - Client logout only drops localStorage.authToken (client/src). The same bearer
#     token keeps working against the API afterwards.
#
# EXECUTION STATUS: NOT executed here. To confirm on a live instance:
#   1) log in via UI, copy localStorage.authToken
#   2) click "Logout" in the UI
#   3) run this script with that (now "logged out") token -> still 200 OK.

param(
  [string]$BaseUrl = "http://localhost:5080",
  [string]$Token   = ""   # token captured BEFORE logout
)

$r = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Headers @{ Authorization = "Bearer $Token" }
Write-Host "VULNERABLE if this returns identity after logout:"
$r | ConvertTo-Json
