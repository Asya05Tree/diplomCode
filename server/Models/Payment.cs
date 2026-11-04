namespace Server.Models;

// Платіж за розблокування платної фічі. Один рядок на спробу оплати: створюється зі статусом
// Pending у момент старту чекауту, переходить у Approved після підтвердження (перевірка статусу
// в WayForPay або мок-режим). Зберігаємо orderReference — за ним звіряємось із платіжкою.
public class Payment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    // Що саме оплачується (наразі лише "quick-add"; поле на виріст).
    public string Feature { get; set; } = "quick-add";

    // Унікальний номер замовлення, який ми передаємо платіжці й за яким звіряємо результат.
    public string OrderReference { get; set; } = string.Empty;

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "UAH";

    // Pending | Approved | Declined — спрощений життєвий цикл платежу.
    public string Status { get; set; } = "Pending";

    // Провайдер: "wayforpay" або "mock" (демо без реальних грошей).
    public string Provider { get; set; } = "mock";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}
