<#
===============================================================================
  stop-all.ps1 — остановить ВСЁ, что поднимает start-all.ps1, по очереди
===============================================================================
  Останавливает по порядку:
    1. Backend  (ASP.NET) — процесс на порту 5080 + его дочерний Server.exe
    2. Frontend (Vite)    — процесс на порту 5173 + дочерние node/esbuild
    3. Docker-контейнеры  (planner-mysql, planner-phpmyadmin) через docker compose stop

  Почему раньше "процесс шёл после закрытия": `dotnet run` запускает отдельный
  дочерний Server.exe — убийство самого dotnet его не трогало. Теперь глушим по
  ПОРТУ вместе со всем деревом процессов (taskkill /T), поэтому хвостов не остаётся.

  КАК ЗАПУСТИТЬ:
    - Правой кнопкой -> "Выполнить с помощью PowerShell", ИЛИ
    - powershell -ExecutionPolicy Bypass -File .\stop-all.ps1
===============================================================================
#>

$root = $PSScriptRoot

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

# Глушит процесс(ы), слушающие порт, вместе со всем деревом дочерних процессов.
function Stop-ByPort($port, $label) {
    $pids = @()
    try {
        $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop |
                Select-Object -ExpandProperty OwningProcess -Unique
    } catch {
        # Фолбэк для старых систем без Get-NetTCPConnection — парсим netstat
        $pids = netstat -ano | Select-String ":$port\s" | ForEach-Object {
            ($_ -split '\s+')[-1]
        } | Sort-Object -Unique
    }

    $pids = $pids | Where-Object { $_ -and $_ -ne 0 }
    if (-not $pids) {
        Write-Host "  $label (порт $port): уже не запущен." -ForegroundColor DarkGray
        return
    }

    foreach ($procId in $pids) {
        $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "  $label (порт $port): глушу PID $procId ($name) с деревом процессов..." -ForegroundColor Yellow
        taskkill /PID $procId /T /F *> $null
    }
}

# --- 1. Backend ----------------------------------------------------------
Write-Step "Останавливаю backend..."
Stop-ByPort 5080 'backend'
# На случай осиротевшего Server.exe (если run падал раньше и порт не держался)
Get-Process Server -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  добиваю Server.exe (PID $($_.Id))..." -ForegroundColor Yellow
    taskkill /PID $_.Id /T /F *> $null
}

# --- 2. Frontend ---------------------------------------------------------
Write-Step "Останавливаю frontend..."
Stop-ByPort 5173 'frontend'

# --- 3. Docker-контейнеры ------------------------------------------------
Write-Step "Останавливаю Docker-контейнеры (MySQL + phpMyAdmin)..."
$dockerUp = $false
try { docker info *> $null; if ($LASTEXITCODE -eq 0) { $dockerUp = $true } } catch { $dockerUp = $false }

if (-not $dockerUp) {
    Write-Host "  Docker не отвечает — контейнеры и так не работают." -ForegroundColor DarkGray
} else {
    Push-Location $root
    docker compose stop
    Pop-Location
    Write-Host "  Контейнеры остановлены (данные БД сохранены в volume)." -ForegroundColor Green
}

Write-Step "Готово — backend, frontend и контейнеры остановлены."
Write-Host "Снова поднять всё: .\start-all.ps1" -ForegroundColor DarkGray
Write-Host "Полностью удалить контейнеры (не данные): docker compose down" -ForegroundColor DarkGray
