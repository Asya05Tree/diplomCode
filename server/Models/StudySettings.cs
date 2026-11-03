namespace Server.Models;

// Налаштування навчання користувача (один рядок на користувача, PK = UserId).
// LearningForm — верхній перемикач форми навчання в розділі "Навчання". Дати семестру/року потрібні
// для дедлайнів завдань ("до кінця семестру/року") і як межі генерації розкладу на семестр.
// Дефолти проставляються лениво при першому GET (upsert), тому всі дати nullable.
public class StudySettings
{
    public int UserId { get; set; }
    public User? User { get; set; }

    public string LearningForm { get; set; } = "distance"; // distance | regular | mixed
    public string TermType { get; set; } = "semester";     // semester | trimester

    public DateOnly? StudyStart { get; set; }    // початок навчання (дефолт 1 вересня поточного навч. року)
    public DateOnly? StudyEnd { get; set; }      // кінець навчання (дефолт 31 грудня)
    public DateOnly? SemesterEnd { get; set; }   // кінець семестру/триместру — для дедлайну "до кінця семестру"
    public DateOnly? YearEnd { get; set; }       // кінець навчального року (дефолт 31 травня) — для "до кінця року"
    public DateOnly? VacationStart { get; set; } // канікули (опційно)
    public DateOnly? VacationEnd { get; set; }
}
