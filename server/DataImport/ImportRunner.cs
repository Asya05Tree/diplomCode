using Server.Data;

namespace Server.DataImport;

// Точка входу для імпорту довідкових даних із CLI (Program.cs).
// Порядок важливий: форми → продукти/рецепти → ліки → взаємодії.
public static class ImportRunner
{
    public static void Run(AppDbContext db, string command)
    {
        switch (command)
        {
            case "import-forms":
                Console.WriteLine("[forms]"); FormsImporter.Run(db); break;
            case "import-ingredients":
                Console.WriteLine("[forms]"); FormsImporter.Run(db);
                Console.WriteLine("[ingredients]"); var m1 = IngredientsImporter.Run(db);
                Console.WriteLine("[recipes]"); RecipesImporter.Run(db, m1); break;
            case "import-medicines":
                Console.WriteLine("[forms]"); FormsImporter.Run(db);
                Console.WriteLine("[medicines]"); MedicinesImporter.Run(db); break;
            case "import-interactions":
                Console.WriteLine("[interactions]"); InteractionsImporter.Run(db); break;
            case "import-all":
                Console.WriteLine("[forms]"); FormsImporter.Run(db);
                Console.WriteLine("[ingredients]"); var m = IngredientsImporter.Run(db);
                Console.WriteLine("[recipes]"); RecipesImporter.Run(db, m);
                Console.WriteLine("[medicines]"); MedicinesImporter.Run(db);
                Console.WriteLine("[interactions]"); InteractionsImporter.Run(db);
                break;
            default:
                Console.WriteLine($"Unknown import command: {command}");
                return;
        }
        PrintSummary(db);
    }

    private static void PrintSummary(AppDbContext db)
    {
        Console.WriteLine("\n=== Reference table row counts ===");
        Console.WriteLine($"  Tags:                 {db.Tags.Count()}");
        Console.WriteLine($"  MedicineForms:        {db.MedicineForms.Count()}");
        Console.WriteLine($"  Products:             {db.Products.Count()}");
        Console.WriteLine($"  ProductTags:          {db.ProductTags.Count()}");
        Console.WriteLine($"  Recipes:              {db.Recipes.Count()}");
        Console.WriteLine($"  RecipeIngredients:    {db.RecipeIngredients.Count()}");
        Console.WriteLine($"  RecipeSteps:          {db.RecipeSteps.Count()}");
        Console.WriteLine($"  Substances:           {db.Substances.Count()}");
        Console.WriteLine($"  Medicines:            {db.Medicines.Count()}");
        Console.WriteLine($"  SubstanceInteractions:{db.SubstanceInteractions.Count()}");
    }
}
