namespace Server.Models;

// Список "що подивитися / що прочитати" — доменний аналог ToDo-дошки, але з трьома
// фіксованими станами й привʼязкою до календаря. Kind розрізняє відео й книги
// (в книги є автор і рейтинг). Status рухається тільки вперед:
// planned → in_progress → done; назад у planned не можна (контролер це стереже).
// TaskId — логічне посилання на створену подію календаря (TaskItem.Id), той самий
// принцип, що SourceModule/SourceEntityId на боці задачі.
public class MediaItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Kind { get; set; } = "video";   // video | book
    public string Title { get; set; } = string.Empty;
    public string? Author { get; set; }            // тільки книги, необовʼязкове
    public string Status { get; set; } = "planned"; // planned | in_progress | done

    // Класифікація (ключі з фіксованих довідників, дзеркало watchlistTaxonomy.js).
    // Genre — для відео й книг; MediaType (вид: фільм/серіал/аніме/…) — лише для відео. Необовʼязкові.
    public string? Genre { get; set; }
    public string? MediaType { get; set; }

    public DateTime? StartDate { get; set; }       // дата початку перегляду/читання (коли заплановано)
    public int? RatingStars { get; set; }          // 1..5, для відео й книг у "done"
    public string? Review { get; set; }            // короткий відгук, необовʼязковий

    public int? TaskId { get; set; }               // звʼязок зі створеною подією календаря

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
