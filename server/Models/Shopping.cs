namespace Server.Models;

// Модель даних модуля "Список покупок" (planner-spec.md §3.8, spisok-pokupok.md).
// Список первинний, задача в календарі — лише нагадування. Ціни особисті, жодних заздалегідь прописаних.

// Позиція списку. Section — розділ/магазин. Source — звідки позиція (нестача страв, запаси, цикл, вручну).
public class ShoppingItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Section { get; set; } = "Groceries"; // Groceries | Pharmacy | Other
    public int? ProductId { get; set; }
    public Product? Product { get; set; }
    public int? MedicineId { get; set; }
    public Medicine? Medicine { get; set; }
    public string? CustomText { get; set; }
    public string? Category { get; set; }
    public bool IsChecked { get; set; }
    public decimal? EstimatedPrice { get; set; }
    public string Source { get; set; } = "Manual"; // Manual | Food | Stock | Cycle
    public int? SourceEntityId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CheckedAt { get; set; }
}

// Особиста ціна продукту (PK = {UserId, ProductId}). Дата — день відмітки покупки, не дата задачі.
public class UserProductPrice
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal LastPrice { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// Історія покупок для підказок "часто купуєте" (вікно 90 днів).
public class PurchaseHistory
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int? ProductId { get; set; }
    public Product? Product { get; set; }
    public string? CustomText { get; set; }
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
}
