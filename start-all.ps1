<#
===============================================================================
  start-all.ps1 — запуск всего проекта "Планувальник" одной командой
===============================================================================

  ЧТО ДЕЛАЕТ:
    1. Запускает Docker Desktop (если ещё не запущен) и ждёт, пока поднимется.
    2. Поднимает контейнер MySQL через docker-compose.yml.
    3. Запускает backend (ASP.NET Core, /server) в отдельном окне PowerShell.
    4. Запускает frontend (Vite/React, /client) в отдельном окне PowerShell.

  КАК ЗАПУСТИТЬ:
    - Правой кнопкой по файлу -> "Выполнить с помощью PowerShell", ИЛИ
    - Из терминала:  powershell -ExecutionPolicy Bypass -File .\start-all.ps1

  ПОСЛЕ ЗАПУСКА (когда всё поднимется, обычно 20-40 секунд):
    - Фронтенд (сайт):        http://localhost:5173
    - Backend API:            http://localhost:5080
    - Swagger (тест API):     http://localhost:5080/swagger
    - Проверка что backend жив и видит БД:  http://localhost:5080/api/health

  ГДЕ ЧТО ХРАНИТСЯ:
    - База данных: MySQL 8, поднимается в Docker-контейнере "planner-mysql"
        (описан в docker-compose.yml в корне проекта).
        Данные контейнера лежат в Docker-volume "planner-mysql-data" —
        это НЕ папка в проекте, а внутреннее хранилище Docker, но оно
        живёт постоянно между перезапусками (пока volume не удалили вручную).
    - Подключение к БД: сервер=localhost, порт=3306, БД=planner,
        юзер=planner, пароль=planner_dev_password
        (взято из server/appsettings.Development.json, ключ ConnectionStrings:Default).
    - Аккаунты пользователей: таблица `Users` в БД planner
        (плюс `UserProfiles`, `EmailVerificationCodes` — код подтверждения email).
        Модель таблицы: server/Models/User.cs, EF-контекст: server/Data/AppDbContext.cs.
    - JWT-секрет и настройки токена: server/appsettings.json (ключ "Jwt").
    - Роуты фронта: client/src/App.jsx ("/", "/login", "/reg", "/app").

  РУЧНЫЕ КОМАНДЫ (если нужно сделать что-то по отдельности):
    - Поднять только БД:            docker compose up -d
    - Остановить БД:                docker compose stop
    - Посмотреть логи БД:           docker logs planner-mysql
    - Зайти в консоль MySQL:        docker exec -it planner-mysql mysql -uplanner -pplanner_dev_password planner
    - Запустить только backend:     cd server; dotnet run
    - Запустить только frontend:    cd client; npm run dev
    - Применить EF-миграции вручную: cd server; dotnet ef database update
    - Проверить, что порт занят:    netstat -ano | findstr ":ПОРТ"
        (3306=MySQL, 5080=backend, 5173=frontend)

  ОСТАНОВКА ВСЕГО:
    Просто закрыть открывшиеся окна PowerShell (backend/frontend), либо
    использовать stop-all.ps1 рядом с этим файлом.
    БД (Docker-контейнер) отдельно останавливать не обязательно — она лёгкая,
    но при желании: docker compose stop

===============================================================================
#>

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

# --- 1. Docker Desktop ---------------------------------------------------
Write-Step "Проверяю Docker..."
$dockerReady = $false
try {
    docker info *> $null
    $dockerReady = $true
} catch {
    $dockerReady = $false
}

if (-not $dockerReady) {
    Write-Host "Docker Desktop не запущен — запускаю..." -ForegroundColor Yellow
    $dockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (Test-Path $dockerExe) {
        Start-Process $dockerExe
    } else {
        Write-Host "Не нашёл Docker Desktop.exe по стандартному пути. Запусти его вручную и перезапусти этот скрипт." -ForegroundColor Red
        exit 1
    }

    Write-Host "Жду, пока поднимется движок Docker (до ~2 минут)..."
    $attempts = 0
    do {
        Start-Sleep -Seconds 5
        $attempts++
        try {
            docker info *> $null
            $dockerReady = $true
        } catch {
            $dockerReady = $false
        }
    } while (-not $dockerReady -and $attempts -lt 24)

    if (-not $dockerReady) {
        Write-Host "Docker так и не поднялся за отведённое время. Проверь Docker Desktop вручную." -ForegroundColor Red
        exit 1
    }
}
Write-Host "Docker готов." -ForegroundColor Green

# --- 2. MySQL контейнер ---------------------------------------------------
Write-Step "Поднимаю MySQL (docker compose up -d)..."
Push-Location $root
docker compose up -d
Pop-Location
Write-Host "MySQL контейнер запущен (planner-mysql, порт 3306)." -ForegroundColor Green

# --- 3. Backend (ASP.NET Core) --------------------------------------------
Write-Step "Запускаю backend в отдельном окне (http://localhost:5080)..."
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\server'; Write-Host 'BACKEND — dotnet run (localhost:5080, swagger: /swagger)' -ForegroundColor Cyan; dotnet run"
)

# --- 4. Frontend (Vite/React) ----------------------------------------------
Write-Step "Запускаю frontend в отдельном окне (http://localhost:5173)..."
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\client'; Write-Host 'FRONTEND — npm run dev (localhost:5173)' -ForegroundColor Cyan; npm run dev"
)

Write-Step "Готово. Открылись 2 отдельных окна (backend и frontend) — логи смотри там."
Write-Host ""
Write-Host "Сайт откроется на:        http://localhost:5173" -ForegroundColor Green
Write-Host "Проверка backend+БД:      http://localhost:5080/api/health" -ForegroundColor Green
Write-Host "Дай серверам 10-20 секунд подняться перед первым заходом на сайт."
