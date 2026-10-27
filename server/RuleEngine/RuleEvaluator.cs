namespace Server.RuleEngine;

// planner-spec.md §2.3. Єдина точка перевірки обмежень для "Їжі" й аптечки: отримує вже
// розгорнуті (TagMatcher) теги продукту/страви й список обмежень користувача, повертає, чи є
// серед них жорстка заборона (Forbidden) та/або мʼяке "небажано" (Avoid). Обмеження — це ДАНІ
// (UserTagPreference), а не if у коді, тому логіка тут навмисно крихітна й спільна для всіх модулів.
public static class RuleEvaluator
{
    // Обмеження користувача: Id тега, його ключ (для відповіді клієнту) і тип відношення.
    public record Restriction(int TagId, string Key, string Relation); // Forbidden | Avoid

    // Forbidden має пріоритет для показу, але повертаємо обидва ключі незалежно — клієнт сам
    // вирішує, що показати (жорстке приховування чи мʼяке попередження).
    public record Result(string? Forbidden, string? Avoid);

    public static Result Evaluate(HashSet<int> productTagIds, IEnumerable<Restriction> restrictions)
    {
        string? forbidden = null;
        string? avoid = null;
        foreach (var r in restrictions)
        {
            if (!productTagIds.Contains(r.TagId)) continue;
            if (r.Relation == "Forbidden") forbidden ??= r.Key;
            else if (r.Relation == "Avoid") avoid ??= r.Key;
        }
        return new Result(forbidden, avoid);
    }
}
