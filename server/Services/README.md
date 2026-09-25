# Services

Бізнес-логіка по доменах (planner-spec.md §2.2): `TaskService`, `RecipeService`, `MedicineService` тощо.
Контролери викликають сервіси, сервіси — RuleEngine та Repositories. Без DI-контейнерів понад вбудований в ASP.NET (coding-guide.md §2).
