namespace Server.Authorization;

// Кидається, коли користувач досяг ліміту кількості записів певного типу. Глобальний
// ApiExceptionMiddleware перетворює це на 409 { error:"limit_reached", entity, limit }, а клієнт
// показує відповідне повідомлення (i18n-ключ errors.limit_reached).
public class LimitReachedException : Exception
{
    public string Entity { get; }
    public int Limit { get; }

    public LimitReachedException(string entity, int limit) : base($"limit_reached:{entity}")
    {
        Entity = entity;
        Limit = limit;
    }
}

// Максимальна кількість записів на одного користувача для кожного типу. Межі навмисно щедрі — це
// захист від накопичення сміття / зловживань (storage-DoS), а не обмеження реального користування.
// Перевірка робиться ПЕРЕД вставкою: current >= max → виняток, нічого не створюється.
public static class Limits
{
    // Календар / задачі
    public const int CalendarTasks = 2000;      // одноразові задачі (разом із нерозподіленими — та сама таблиця)
    public const int RecurrenceRules = 200;     // правила повторення
    public const int ExceptionsPerRule = 500;   // винятки одного правила
    public const int ManualDatesPerRule = 500;  // ручні дати одного правила

    // Нотатки
    public const int Notes = 200;

    // Перегляд / медіа
    public const int MediaItems = 2000;

    // Список покупок
    public const int ShoppingItems = 1000;

    // Фінанси
    public const int FinanceTransactions = 10000;

    // Їжа
    public const int FoodProducts = 1000;       // власні продукти користувача
    public const int FoodRecipes = 500;         // власні рецепти
    public const int StockItems = 2000;         // запаси
    public const int SelectedDishes = 200;      // обрані страви

    // Здоров'я
    public const int HealthVisits = 2000;
    public const int UserMedicines = 500;
    public const int ChronicConditions = 200;

    // Навчання
    public const int StudySubjects = 200;
    public const int StudyAssignments = 2000;
    public const int StudyScheduleEntries = 500;
    public const int StudyProjects = 100;
    public const int StudyStepsPerProject = 200;

    // Робота
    public const int WorkShiftTypes = 100;
    public const int WorkScheduleEntries = 500;
    public const int WorkContacts = 1000;
    public const int WorkLeaves = 500;
    public const int WorkMeetings = 2000;
    public const int WorkObligations = 1000;
    public const int WorkProcessTasks = 1000;

    // Цикл
    public const int CycleRecords = 1000;

    // Кинути, якщо вже досягнуто межі.
    public static void Ensure(int current, int max, string entity)
    {
        if (current >= max) throw new LimitReachedException(entity, max);
    }
}

// Максимальна ДОВЖИНА текстових полів (символів). Клієнтські maxLength — лише UX; прямий виклик API
// обходить їх і зберігає блоби в кілька сотень КБ (storage-DoS, роздуті відповіді). Тому ті самі межі
// дублюються на сервері як [StringLength] на полях DTO — [ApiController] автоматично віддає 400, якщо
// рядок довший (ПЛАН P2-2). Межі щедрі для реального тексту, але скінченні.
public static class TextLimits
{
    public const int Title = 200;        // заголовки/короткі назви (задача, проєкт, предмет, обов'язок…)
    public const int Name = 200;         // імена/назви (контакт, робота, продукт, діагноз…)
    public const int Code = 64;          // короткі токени/ключі (категорія, тег, doctorKey, групи…)
    public const int Phone = 40;         // телефон
    public const int Color = 32;         // колір (hex або токен теми)
    public const int Note = 280;         // нотатка-«квадратик»
    public const int Description = 5000; // вільний текст (опис, коментар, відгук, нотатка зустрічі…)
}
