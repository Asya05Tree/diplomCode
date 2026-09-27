<#
===============================================================================
  stop-all.ps1 — остановить backend и frontend, запущенные start-all.ps1
===============================================================================
  Закрывает процессы dotnet (backend) и node/vite (frontend).
  БД (Docker) не трогает — чтобы не пришлось поднимать заново лишний раз;
  если нужно остановить и её: docker compose stop
===============================================================================
#>

Write-Host "Останавливаю backend (dotnet)..." -ForegroundColor Cyan
Get-Process dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Останавливаю frontend (node/vite)..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Готово. БД (Docker-контейнер planner-mysql) оставлена работать —" -ForegroundColor Green
Write-Host "чтобы остановить и её: docker compose stop" -ForegroundColor Green
