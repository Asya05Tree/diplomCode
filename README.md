# Планувальник завдань — запуск проекту

Структура репозиторію:

```
диплом/
├── planner-spec.md      — спецификация (модель даних, логіка)
├── coding-guide.md      — інструкція для розробки (стек, стиль коду)
├── PLAN.md              — покроковий план роботи
├── docker-compose.yml   — MySQL для розробки
├── server/              — backend, ASP.NET Core Web API
└── client/              — frontend, React (Vite)
```

Backend і frontend — два незалежні проєкти. Кожен запускається окремо, з різних терміналів.

---

## 0. Що треба встановити один раз

| Інструмент | Навіщо | Перевірка |
|---|---|---|
| [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (встановлено) | збирати й запускати `server/` | `dotnet --version` → має бути `8.x` |
| [Node.js](https://nodejs.org/) (є) | `client/` | `node --version` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (є, встановлено) | підняти MySQL без ручного встановлення | `docker --version` |

Все три вже встановлені й перевірені (`dotnet build` у `server/` проходить без помилок).

**Якщо термінал пише `dotnet: command not found`** — це стара сесія термінала, відкрита до встановлення
SDK і не бачить оновлений PATH. Просто закрити й відкрити термінал (або IDE) заново — переустановлювати
нічого не треба.

Одноразово додати в `server/` інструмент для міграцій:

```bash
dotnet tool install --global dotnet-ef
```

---

## 1. Піднімаємо базу даних (MySQL)

З кореня репозиторію:

```bash
docker compose up -d
```

Це піднімає MySQL 8 на `localhost:3306` з базою `planner`, користувачем `planner` / `planner_dev_password`
(див. `docker-compose.yml`, ці ж креди — у `server/appsettings.Development.json`).

Перевірити, що контейнер живий:

```bash
docker compose ps
```

Зупинити (дані в volume збережуться):

```bash
docker compose down
```

---

## 2. Запускаємо backend

```bash
cd server
dotnet restore
dotnet ef migrations add InitialCreate   # тільки один раз, поки немає жодної міграції
dotnet ef database update                # створює таблиці в MySQL
dotnet run
```

Після старту:
- API: `http://localhost:5080`
- Swagger (документація API): `http://localhost:5080/swagger`
- Перевірка здоров'я: `http://localhost:5080/api/health` — має повернути `{"status":"ok","database":"connected"}`

Якщо `database: "unreachable"` — MySQL-контейнер ще не піднявся або не готовий, зачекайте кілька секунд і перевірте `docker compose ps`.

---

## 3. Запускаємо frontend

У новому терміналі:

```bash
cd client
npm install    # тільки один раз, або коли з'явились нові залежності
npm run dev
```

Відкрити `http://localhost:5173`. Сторінка показує статус з'єднання з backend (якщо він не запущений — це видно на екрані, а не мовчазна помилка).

---

## 4. Щоденний запуск (коли все вже встановлено)

Три термінали, у будь-якому порядку:

```bash
docker compose up -d       # 1. база
cd server && dotnet run    # 2. backend
cd client && npm run dev   # 3. frontend
```

---

## 5. Типові проблеми

| Симптом | Причина | Рішення |
|---|---|---|
| `dotnet: command not found` | не встановлено .NET SDK | встановити з посилання вище, перезапустити термінал |
| `database: "unreachable"` на `/api/health` | MySQL-контейнер не піднятий | `docker compose up -d`, зачекати ~10 сек |
| Frontend показує "Backend недоступний" | backend не запущено або запущено на іншому порту | перевірити `dotnet run` у `server/`, порт `5080` (`server/Properties/launchSettings.json`) |
| CORS-помилка в консолі браузера | frontend запущено не на `5173` | `client/vite.config.js` фіксує порт 5173 (`strictPort`); якщо порт зайнятий — звільнити його, а не міняти |
