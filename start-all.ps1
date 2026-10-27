<#
===============================================================================
  start-all.ps1 — запуск всего проекта "Всетут" одной командой
===============================================================================

  ЧТО ДЕЛАЕТ:
    1. Запускает Docker Desktop (если ещё не запущен) и ждёт, пока поднимется.
    2. Поднимает контейнеры через docker-compose.yml:
         - MySQL        (planner-mysql,       порт 3306)  — сама база данных
         - phpMyAdmin   (planner-phpmyadmin,  порт 8080)  — веб-просмотр БД
    3. Ждёт, пока MySQL начнёт принимать подключения.
    4. Запускает backend (ASP.NET Core, /server) в отдельном окне PowerShell.
    5. Запускает frontend (Vite/React, /client) в отдельном окне PowerShell.
    6. Открывает в браузере сайт и phpMyAdmin.

  КАК ЗАПУСТИТЬ:
    - Правой кнопкой по файлу -> "Выполнить с помощью PowerShell", ИЛИ
    - Из терминала:  powershell -ExecutionPolicy Bypass -File .\start-all.ps1

  ПОСЛЕ ЗАПУСКА (когда всё поднимется, обычно 20-40 секунд):
    - Фронтенд (сайт):        http://localhost:5173
    - Backend API:            http://localhost:5080
    - Swagger (тест API):     http://localhost:5080/swagger
    - Проверка backend+БД:    http://localhost:5080/api/health
    - ПРОСМОТР БАЗЫ ДАННЫХ:    http://localhost:8080   (phpMyAdmin, входит сам)
        Там слева — список всех таблиц БД planner, сверху — вкладки
        (Обзор / Структура / SQL / Поиск / Экспорт). Логин/пароль вводить
        не нужно — phpMyAdmin заходит автоматически под юзером planner.

  ГДЕ ЧТО ХРАНИТСЯ:
    - База данных: MySQL 8 в Docker-контейнере "planner-mysql"
        (описан в docker-compose.yml). Данные — в Docker-volume
        "planner-mysql-data" (живёт между перезапусками, пока не удалён вручную).
    - Подключение к БД: сервер=localhost, порт=3306, БД=planner,
        юзер=planner, пароль=planner_dev_password
        (server/appsettings.Development.json, ключ ConnectionStrings:Default).
    - Справочники (лекарства ДРЛЗ, взаимодействия DDInter, ингредиенты USDA FDC)
        загружаются скриптом-импортёром, а не живут в коде:
            cd server; dotnet run -- import-all
        (сырые датасеты качаются в server/seed-data, он в .gitignore).

  РУЧНЫЕ КОМАНДЫ (если нужно по отдельности):
    - Поднять только БД + phpMyAdmin:  docker compose up -d
    - Остановить контейнеры:           docker compose stop
    - Логи БД:                         docker logs planner-mysql
    - Консоль MySQL:                   docker exec -it planner-mysql mysql -uplanner -pplanner_dev_password planner
    - Только backend:                  cd server; dotnet run
    - Только frontend:                 cd client; npm run dev
    - Применить EF-миграции:           cd server; dotnet ef database update
    - Заполнить справочники:           cd server; dotnet run -- import-all
    - Проверить занятый порт:          netstat -ano | findstr ":ПОРТ"
        (3306=MySQL, 5080=backend, 5173=frontend, 8080=phpMyAdmin)

  ОСТАНОВКА:
    Закрыть окна PowerShell (backend/frontend) или запустить stop-all.ps1.
    Контейнеры БД/phpMyAdmin можно оставить; остановить: docker compose stop

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

# --- 2. MySQL + phpMyAdmin контейнеры ------------------------------------
Write-Step "Поднимаю MySQL и phpMyAdmin (docker compose up -d)..."
Push-Location $root
docker compose up -d
Pop-Location
Write-Host "Контейнеры запущены: planner-mysql (3306), planner-phpmyadmin (8080)." -ForegroundColor Green

# --- 3. Жду готовности MySQL ---------------------------------------------
Write-Step "Жду, пока MySQL начнёт принимать подключения..."
$mysqlReady = $false
$attempts = 0
do {
    Start-Sleep -Seconds 2
    $attempts++
    try {
        # mysqladmin ping внутри контейнера — самый надёжный признак готовности
        docker exec planner-mysql mysqladmin ping -uplanner -pplanner_dev_password --silent *> $null
        if ($LASTEXITCODE -eq 0) { $mysqlReady = $true }
    } catch {
        $mysqlReady = $false
    }
} while (-not $mysqlReady -and $attempts -lt 30)

if ($mysqlReady) {
    Write-Host "MySQL готов принимать подключения." -ForegroundColor Green
} else {
    Write-Host "MySQL ещё поднимается — backend подхватит её, как только она будет готова." -ForegroundColor Yellow
}

# --- 4. Backend (ASP.NET Core) --------------------------------------------
Write-Step "Запускаю backend в отдельном окне (http://localhost:5080)..."
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\server'; Write-Host 'BACKEND — dotnet run (localhost:5080, swagger: /swagger)' -ForegroundColor Cyan; dotnet run"
)

# --- 5. Frontend (Vite/React) ----------------------------------------------
Write-Step "Запускаю frontend в отдельном окне (http://localhost:5173)..."
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\client'; Write-Host 'FRONTEND — npm run dev (localhost:5173)' -ForegroundColor Cyan; npm run dev"
)

# --- 6. Открываю браузер ---------------------------------------------------
Write-Step "Открываю сайт и просмотр БД в браузере..."
# phpMyAdmin — сразу, чтобы видеть базу; сайт откроется тоже (ему дать пару секунд)
Start-Process "http://localhost:8080"
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Step "Готово. Открылись 2 окна PowerShell (backend и frontend) — логи смотри там."
Write-Host ""
Write-Host "Сайт:                 http://localhost:5173" -ForegroundColor Green
Write-Host "Просмотр базы данных: http://localhost:8080   (phpMyAdmin, вход автоматический)" -ForegroundColor Green
Write-Host "Проверка backend+БД:  http://localhost:5080/api/health" -ForegroundColor Green
Write-Host ""
Write-Host "Дай серверам 10-20 секунд подняться перед первым заходом на сайт." -ForegroundColor DarkGray
Write-Host "Если в phpMyAdmin таблицы пустые — справочники грузятся так:" -ForegroundColor DarkGray
Write-Host "    cd server; dotnet run -- import-all" -ForegroundColor DarkGray
