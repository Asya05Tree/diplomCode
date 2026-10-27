namespace Server.DataImport;

// Пошук каталогів із даними працює незалежно від робочої теки запуску
// (dotnet run з теки server чи запуск скомпільованого exe з bin/). Піднімаємося вгору,
// доки не знайдемо Server.csproj — це корінь проєкту server.
public static class ImportPaths
{
    public static string ServerRoot { get; } = FindServerRoot();

    // Сирі великі датасети (гіт-ігнор): reestr.csv, ddinter_*.csv, розпаковані FDC
    public static string SeedData => Path.Combine(ServerRoot, "seed-data");

    // Невеликі куровані файли, що комітяться разом із кодом
    public static string DataImportDir => Path.Combine(ServerRoot, "DataImport");

    // Рецепти й продукти беремо з уже наявної псевдо-БД клієнта (єдине джерело правди для рецептів)
    public static string ClientPseudoDb => Path.Combine(ServerRoot, "..", "client", "src", "pseudo-db");

    private static string FindServerRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Server.csproj")))
                return dir.FullName;
            dir = dir.Parent;
        }
        // Запасний варіант — поточна тека (dotnet run зазвичай стартує саме з теки проєкту)
        return Directory.GetCurrentDirectory();
    }
}
