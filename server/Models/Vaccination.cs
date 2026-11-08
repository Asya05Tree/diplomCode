namespace Server.Models;

// --- Щеплення (розділ "Здоров'я", вкладка "Щеплення") ---
// Довідник системний: одиниця — не щеплення, а ДОЗА (Календар профілактичних щеплень в Україні,
// наказ МОЗ від 16.09.2011 № 595 у ред. наказу від 05.03.2025 № 396). Статуси (до віку / строк
// минув / виконано / наступна) рахуються на клієнті з віку профілю — у БД їх не зберігаємо.

// Одна доза довідника: інфекція + порядковий номер дози + правило (за віком / за інтервалом).
// Системний рядок (не належить користувачу), заповнюється імпортером VaccinesImporter.
public class VaccineDose
{
    public int Id { get; set; }
    public string InfectionKey { get; set; } = ""; // стабільний ключ інфекції для групування (tb, hepb, …)
    public string InfectionUk { get; set; } = "";
    public string InfectionEn { get; set; } = "";
    public int DoseNumber { get; set; }            // порядковий номер дози в межах інфекції (1,2,3,…)
    public string RuleType { get; set; } = "Age";  // "Age" — за віком | "Interval" — за інтервалом
    public int RuleValueMonths { get; set; }       // вік у місяцях (Age) або інтервал у місяцях (Interval)
    public int SortOrder { get; set; }             // стабільний порядок показу вкладки
    public string Source { get; set; } = "";       // джерело (реквізити наказу) для відображення в UI
}

// Відмітка користувача про зроблене щеплення. Посилання на дозу довідника АБО власна назва
// (для щеплення поза календарем). Дата проведення + необов'язкова примітка.
public class UserVaccination
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public int? VaccineDoseId { get; set; }        // null → власне щеплення поза календарем
    public VaccineDose? VaccineDose { get; set; }
    public string? CustomName { get; set; }        // назва для щеплення поза довідником
    public int? DoseCount { get; set; }            // кількість доз (лише для власного щеплення; редаговане)
    public DateTime DoneDate { get; set; }         // дата проведення
    public string? Note { get; set; }
}
