namespace Server.DataImport;

// Куроване зіставлення англійської МНН (як у ДРЛЗ та DDInter) → українська назва для показу.
// ДРЛЗ подає МНН латиницею, тож для DDInter матчимо напряму за англійською,
// а ця таблиця лише дає людську українську назву діючої речовини в UI.
// Немає запису — показуємо англійську як є (fallback), тому покривати всі 300 МНН не обов'язково.
public static class SubstanceNameMap
{
    // Ключ — англійська МНН у нижньому регістрі (без зайвих пробілів).
    public static readonly Dictionary<string, string> Uk = new()
    {
        ["ibuprofen"] = "Ібупрофен",
        ["paracetamol"] = "Парацетамол",
        ["acetylsalicylic acid"] = "Ацетилсаліцилова кислота",
        ["acetylcysteine"] = "Ацетилцистеїн",
        ["ambroxol"] = "Амброксол",
        ["bromhexine"] = "Бромгексин",
        ["carbocisteine"] = "Карбоцистеїн",
        ["xylometazoline"] = "Ксилометазолін",
        ["oxymetazoline"] = "Оксиметазолін",
        ["tetryzoline"] = "Тетризолін",
        ["levocetirizine"] = "Левоцетиризин",
        ["desloratadine"] = "Дезлоратадин",
        ["loratadine"] = "Лоратадин",
        ["cetirizine"] = "Цетиризин",
        ["fexofenadine"] = "Фексофенадин",
        ["diphenhydramine"] = "Дифенгідрамін",
        ["dimenhydrinate"] = "Дименгідринат",
        ["clemastine"] = "Клемастин",
        ["azelastine"] = "Азеластин",
        ["mebhydrolin"] = "Мебгідролін",
        ["dimetindene"] = "Диметинден",
        ["cromoglicic acid"] = "Кромоглікова кислота",
        ["diclofenac"] = "Диклофенак",
        ["naproxen"] = "Напроксен",
        ["ketoprofen"] = "Кетопрофен",
        ["flurbiprofen"] = "Флурбіпрофен",
        ["mefenamic acid"] = "Мефенамінова кислота",
        ["nimesulide"] = "Німесулід",
        ["benzydamine"] = "Бензидамін",
        ["choline salicylate"] = "Холіну саліцилат",
        ["fluconazole"] = "Флуконазол",
        ["ketoconazole"] = "Кетоконазол",
        ["clotrimazole"] = "Клотримазол",
        ["terbinafine"] = "Тербінафін",
        ["naftifine"] = "Нафтифін",
        ["miconazole"] = "Міконазол",
        ["bifonazole"] = "Біфоназол",
        ["nystatin"] = "Ністатин",
        ["lactulose"] = "Лактулоза",
        ["drotaverine"] = "Дротаверин",
        ["domperidone"] = "Домперидон",
        ["loperamide"] = "Лоперамід",
        ["bisacodyl"] = "Бісакодил",
        ["sodium picosulfate"] = "Натрію пікосульфат",
        ["aciclovir"] = "Ацикловір",
        ["penciclovir"] = "Пенцикловір",
        ["butamirate"] = "Бутамірат",
        ["guaifenesin"] = "Гвайфенезин",
        ["troxerutin"] = "Троксерутин",
        ["diosmin"] = "Діосмін",
        ["povidone-iodine"] = "Повідон-йод",
        ["chlorhexidine"] = "Хлоргексидин",
        ["benzalkonium"] = "Бензалконій",
        ["benzocaine"] = "Бензокаїн",
        ["lidocaine"] = "Лідокаїн",
        ["doxylamine"] = "Доксиламін",
        ["glycerol"] = "Гліцерол",
        ["silymarin"] = "Силімарин",
        ["heparin"] = "Гепарин",
        ["chondroitin sulfate"] = "Хондроїтину сульфат",
        ["dexpanthenol"] = "Декспантенол",
        ["chloramphenicol"] = "Хлорамфенікол",
        ["phenobarbital"] = "Фенобарбітал",
        ["calcium carbonate"] = "Кальцію карбонат",
        ["calcium gluconate"] = "Кальцію глюконат",
        ["sodium chloride"] = "Натрію хлорид",
        ["metamizole sodium"] = "Метамізол натрію",
        ["adenosine"] = "Аденозин",
        ["aminocaproic acid"] = "Амінокапронова кислота",
        ["adapalene"] = "Адапален",
        ["azelaic acid"] = "Азелаїнова кислота",
        ["ambazone"] = "Амбазон",
        ["ascorbic acid"] = "Аскорбінова кислота (вітамін C)",
        ["ascorbic acid (vit c)"] = "Аскорбінова кислота (вітамін C)",
        ["tocopherol (vit e)"] = "Токоферол (вітамін E)",
        ["biotin"] = "Біотин",
        ["colecalciferol"] = "Колекальциферол (вітамін D3)",
        ["omeprazole"] = "Омепразол",
        ["famotidine"] = "Фамотидин",
        ["phenylephrine"] = "Фенілефрин",
        ["pseudoephedrine"] = "Псевдоефедрин",
        ["menthol"] = "Ментол",
        ["simethicone"] = "Симетикон",
        ["dimeticone"] = "Диметикон",
    };

    // Нормалізація для зіставлення назв ДРЛЗ↔DDInter: нижній регістр, прибираємо дужкові уточнення,
    // службові зірочки-виноски та пунктуацію, стискаємо пробіли. Так "Ascorbic acid (vit C)"
    // співпадає з "Ascorbic Acid" у DDInter без ручного словника на кожен варіант.
    public static string Normalize(string name)
    {
        var s = name.ToLowerInvariant();
        s = System.Text.RegularExpressions.Regex.Replace(s, @"\([^)]*\)", " ");
        s = System.Text.RegularExpressions.Regex.Replace(s, @"[^a-z0-9 ]", " ");
        s = System.Text.RegularExpressions.Regex.Replace(s, @"\s+", " ");
        return s.Trim();
    }

    public static string DisplayUk(string nameEn)
    {
        var key = nameEn.Trim().ToLowerInvariant();
        return Uk.TryGetValue(key, out var uk) ? uk : nameEn;
    }
}
