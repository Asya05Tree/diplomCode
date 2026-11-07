namespace Server.Authorization;

// Кидається сервісом, коли вхідні дані не проходять бізнес-валідацію (напр. кінець періоду раніше
// за початок, перекриття періодів, дата поза розумним діапазоном). Глобальний ApiExceptionMiddleware
// перетворює це на 400 { error }, тож контролери лишаються простими й не повторюють перевірки.
public class BadInputException : Exception
{
    public string Error { get; }

    public BadInputException(string error) : base(error) => Error = error;
}
