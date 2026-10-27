namespace Server.RuleEngine;

// planner-spec.md §3.2. Ієрархія тегів: заборона на батьківський тег має ловити й нащадків
// (заборона "dairy" ловить інгредієнт із тегом "lactose"/"cheese"). Тому набір тегів продукту
// розгортаємо ВГОРУ по ParentId — так тег-нащадок підтягує своїх предків, і далі достатньо
// простої перевірки входження в множину заборонених тегів користувача (RuleEvaluator).
public static class TagMatcher
{
    // Повертає множину Id = самі теги + усі їхні предки (транзитивно).
    // parentById: TagId -> ParentId (null, якщо кореневий). Захищено від циклів у даних.
    public static HashSet<int> ExpandWithAncestors(IEnumerable<int> tagIds, IReadOnlyDictionary<int, int?> parentById)
    {
        var result = new HashSet<int>();
        foreach (var id in tagIds)
        {
            int? current = id;
            // !Contains зупиняє підйом, щойно натрапили на вже доданий тег — це й обриває можливий цикл
            while (current is int cur && !result.Contains(cur))
            {
                result.Add(cur);
                current = parentById.TryGetValue(cur, out var parent) ? parent : null;
            }
        }
        return result;
    }
}
