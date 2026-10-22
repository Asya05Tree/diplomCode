# Псевдо-БД (фронтенд-заготовка даних їжі)

Це **тимчасовий шар даних** для модуля «Їжа», поки на бекенді немає реальних таблиць.
Він навмисно відокремлений від справжньої бази даних:

- **Справжня БД** — у `/server` (ASP.NET Core + EF Core + MySQL), таблиці
  `Product`, `ProductTag`, `Recipe`, `RecipeIngredient`, `RecipeStep`, `StockItem`,
  `SelectedDish` (див. `plans/planner-spec.md` §3.4).
- **Псевдо-БД** — ця папка. Довідкові дані (продукти, рецепти) лежать у JSON
  у форматі, що один-в-один лягає на майбутні таблиці (`coding-guide.md` §10),
  а користувацький стан (запаси, обрані страви, «коли готувалось») —
  у `localStorage` через `index.js`, за тим самим принципом, що й
  `utils/finance.js`, `utils/cycle.js`, `utils/shoppingList.js`.

## Файли

| Файл | Відповідає таблиці | Що це |
|---|---|---|
| `products.json` | `Product` + `ProductTag` | системний довідник продуктів, теги алергенів, орієнтовна ціна |
| `recipes.json` | `Recipe` + `RecipeIngredient` + `RecipeStep` | рецепти з інгредієнтами (посилання на продукти) і кроками |
| `index.js` | `StockItem` + `SelectedDish` + `LastCookedAt` | доступ до даних: запаси й обрані страви в `localStorage`, розрахунок наявності |

## Перенесення на бекенд

Коли зʼявиться API їжі, JSON-довідники стануть сідером у БД, а функції з `index.js`
(`getStockMap`, `setStockState`, `toggleSelected`, `markCooked`, …) замінять
виклики до сервера — сторінка `pages/Food.jsx` при цьому не зміниться, бо працює
тільки через цей шар, а не напряму з `localStorage`.
