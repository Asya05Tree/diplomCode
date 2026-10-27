namespace Server.Models;

// Модель даних модуля "Їжа" (planner-spec.md §3.4). Довідкові таблиці (Product/Recipe) — системні,
// заповнюються імпортом із USDA FDC та сідом рецептів; користувацькі (StockItem/SelectedDish) — порожні на старті.

// Інгредієнт/продукт. StorageGroup визначає групу зберігання й оцінку терміну придатності.
// FdcId/FdcCategory — слід походження з USDA FoodData Central (назва+категорія, без нутрієнтів).
public class Product
{
    public int Id { get; set; }
    public string NameUk { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string StorageGroup { get; set; } = string.Empty;

    public int? FdcId { get; set; }
    public string? FdcCategory { get; set; }

    public bool IsSystem { get; set; } = true;
    public int? CreatedByUserId { get; set; }

    public List<ProductTag> Tags { get; set; } = new();
}

// Тег продукту (алерген/нутрієнт/група). Value: Yes | No | Unknown —
// для алергенів "Unknown" трактується як небезпечно (planner-spec.md §3.4).
public class ProductTag
{
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public int TagId { get; set; }
    public Tag? Tag { get; set; }
    public string Value { get; set; } = "Yes";
}

// Рецепт. Для системних рецептів Emoji — заглушка-ілюстрація. CookTimeMinutes — довідково.
public class Recipe
{
    public int Id { get; set; }
    public string NameUk { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string Emoji { get; set; } = string.Empty;
    public int CookTimeMinutes { get; set; }

    public bool IsSystem { get; set; } = true;
    public int? CreatedByUserId { get; set; }

    public List<RecipeIngredient> Ingredients { get; set; } = new();
    public List<RecipeStep> Steps { get; set; } = new();
}

// AmountText ("2 шт", "300 г") — зберігається довідково для людини, системою не перевіряється.
public class RecipeIngredient
{
    public int Id { get; set; }
    public int RecipeId { get; set; }
    public Recipe? Recipe { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string AmountUk { get; set; } = string.Empty;
    public string AmountEn { get; set; } = string.Empty;
}

public class RecipeStep
{
    public int Id { get; set; }
    public int RecipeId { get; set; }
    public Recipe? Recipe { get; set; }
    public int StepNumber { get; set; }
    public string TextUk { get; set; } = string.Empty;
    public string TextEn { get; set; } = string.Empty;
}

// Запас продукту користувача. Кількості не зберігаються — лише стан наявності (planner-spec.md §3.4).
// ExpiresAt заповнюється оцінкою за групою зберігання; користувач може виправити.
public class StockItem
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string State { get; set; } = "Available"; // Available | RunningLow | OutOfStock
    public DateTime? ExpiresAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// Обрана страва користувача. Не прив'язана до дати — людина готує коли хоче (planner-spec.md §3.4).
public class SelectedDish
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int RecipeId { get; set; }
    public Recipe? Recipe { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    public bool IsCooked { get; set; }
}

// Per-user стан рецепта. LastCookedAt — для функції "не показувати нещодавно приготовані".
public class UserRecipeState
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public int RecipeId { get; set; }
    public Recipe? Recipe { get; set; }
    public DateTime? LastCookedAt { get; set; }
}
