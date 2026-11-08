import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import Icon from '../components/Icon'
import { PALETTES } from '../utils/settings'
import './Legal.css'

// Юридично-інформаційні сторінки (Політика конфіденційності / Умови й оферта). Довгий текст тримаємо
// тут двома мовами (uk/en), а не в i18n.json — це цілісні документи, а не окремі підписи інтерфейсу.
// Це навчальний дипломний проєкт: контент демонструє обізнаність із вимогами (ЗУ №2297-VI про захист
// персональних даних, №675-VII про електронну комерцію, захист прав споживачів), а не юридичну силу.
// Тон — знеособлений ("дані обробляються", "розроблено"), бо це дипломна робота однієї особи, а не
// суб'єкт господарювання ("ми").

const CONTENT = {
  privacy: {
    uk: {
      title: 'Політика конфіденційності',
      intro: 'Всетута — навчальний дипломний проєкт (планувальник для студентів). Нижче пояснено, які саме дані обробляються, з якою метою та які у вас права.',
      sections: [
        { h: 'Володілець даних', p: ['У реальному запуску тут була б повна назва суб’єкта господарювання та його контакти.'] },
        { h: 'Які дані обробляються', p: ['Обліковий запис: нікнейм, email, пароль (у вигляді незворотного хешу).', 'Профіль: стать, статус навчання (школяр/студент), факт роботи, за бажанням — зріст, вага, рік народження.', 'Дані ваших модулів: задачі, нотатки, список покупок, фінанси, аптечка та здоров’я, менструальний цикл.', 'Дані оплати платної функції обробляє платіжний провайдер — реквізити картки в застосунку не зберігаються.'] },
        { h: 'Мета та правова підстава', p: ['Дані обробляються, щоб надавати функції планувальника саме вам. Правова підстава — ваша згода, яку ви надаєте під час реєстрації (ЗУ «Про захист персональних даних» №2297-VI, ст. 6, 11).'] },
        { h: 'Особлива категорія: здоров’я та цикл', p: ['Дані аптечки, здоров’я та менструального циклу належать до особливої категорії (ст. 7 №2297-VI). Вони обробляються лише після вашої окремої явної згоди, яку запитують перед першим відкриттям цих модулів. Ви можете не давати цю згоду — тоді відповідні модулі залишаться закритими.'] },
        { h: 'Строк зберігання та автовидалення', p: ['Дані зберігаються, поки існує ваш акаунт. Якщо акаунт неактивний понад один рік, він разом з усіма даними автоматично видаляється. Приблизно за 30 днів до видалення на ваш email надсилається попередження — щоб зберегти акаунт, досить зайти у застосунок.'] },
        { h: 'Ваші права', p: ['Ви маєте право на доступ, виправлення та видалення даних, а також на їх перенесення. У розділі «Налаштування → Акаунт» ви можете будь-коли вивантажити всі свої дані у файл, видалити весь вміст або повністю видалити акаунт.'] },
        { h: 'Зберігання на вашому пристрої', p: ['Для зберігання токена входу та налаштувань вигляду (тема, мова, формат дати) використовується localStorage браузера. Це не рекламні трекери; сторонніх аналітичних cookie не встановлено.'] },
        { h: 'Треті сторони', p: ['Оплата платної функції проходить через платіжний сервіс WayForPay — йому передаються лише дані, потрібні для платежу.', 'Довідкові дані показуються з відкритих джерел: взаємодії ліків — DDInter 2.0, дані про продукти — USDA FoodData Central, довідник ліків — Державний реєстр лікарських засобів України (ДРЛЗ).'] },
        { h: 'Неповнолітні', p: ['Серед користувачів можуть бути школярі. Якщо вам менше 18 років, користуйтеся сервісом за згодою та під наглядом батьків або законних представників.'] },
      ],
    },
    en: {
      title: 'Privacy Policy',
      intro: 'Всетута is an educational diploma project (a planner for students). The text below explains what data is processed, why, and what rights you have.',
      sections: [
        { h: 'Data controller', p: ['In a real launch this would list the full legal entity and its contacts.'] },
        { h: 'What data is processed', p: ['Account: nickname, email, password (stored only as an irreversible hash).', 'Profile: gender, study status (pupil/student), employment flag, optionally height, weight, birth year.', 'Your module data: tasks, notes, shopping list, finances, medicine cabinet and health, menstrual cycle.', 'Payment data for the paid feature is handled by the payment provider — card details are not stored in the app.'] },
        { h: 'Purpose and legal basis', p: ['Data is processed to provide the planner features to you personally. The legal basis is your consent, given during registration (Law of Ukraine “On Personal Data Protection” No. 2297-VI, Art. 6, 11).'] },
        { h: 'Special category: health and cycle', p: ['Medicine cabinet, health and menstrual-cycle data are a special category (Art. 7 of No. 2297-VI). They are processed only after your separate explicit consent, which is requested before you first open these modules. You may withhold this consent — the modules then stay closed.'] },
        { h: 'Retention and auto-deletion', p: ['Data is kept while your account exists. If an account is inactive for over a year, it is automatically deleted together with all data. About 30 days before deletion a warning is emailed — simply sign in to keep your account.'] },
        { h: 'Your rights', p: ['You have the right to access, correct, delete and port your data. Under “Settings → Account” you can export all your data to a file, wipe all content, or delete the account entirely at any time.'] },
        { h: 'Storage on your device', p: ['The browser’s localStorage is used for your login token and appearance settings (theme, language, date format). These are not advertising trackers; no third-party analytics cookies are set.'] },
        { h: 'Third parties', p: ['Payment for the paid feature goes through the WayForPay payment service, which receives only the data needed for the payment.', 'Reference data comes from open sources: drug interactions from DDInter 2.0, product data from USDA FoodData Central, the medicine directory from the State Register of Medicinal Products of Ukraine.'] },
        { h: 'Minors', p: ['Some users may be pupils. If you are under 18, use the service with the consent and supervision of a parent or legal guardian.'] },
      ],
    },
  },
  terms: {
    uk: {
      title: 'Умови користування та публічна оферта',
      intro: 'Користуючись Всетутою, ви погоджуєтесь із цими умовами. Це навчальний дипломний проєкт.',
      sections: [
        { h: 'Про сервіс', p: ['Всетута — планувальник для студентів: календар, навчання, робота, їжа, покупки, фінанси, здоров’я, цикл і нотатки. Сервіс надається в межах дипломної демонстрації.'] },
        { h: 'Мінімальний вік', p: ['Сервіс призначений для осіб віком від 6 років. Реєструючись, ви підтверджуєте, що вам виповнилося щонайменше 6 років. Якщо вам менше 18 років, користуйтеся сервісом за згодою та під наглядом батьків або законних представників.'] },
        { h: 'Платна функція «Швидке додавання»', p: ['Більшість функцій безкоштовні. Функція «Швидке додавання» (розпізнавання задач природною мовою) після кількох безкоштовних використань потребує одноразової оплати 100 грн — це покупка назавжди, без підписки й автопродовження.'] },
        { h: 'Продавець та оплата', p: ['У реальному запуску тут вказувались би повні реквізити продавця (найменування ФОП/ТОВ, ЄДРПОУ/РНОКПП, адреса, контакти) згідно із ЗУ «Про електронну комерцію» №675-VII. Оплата проходить через платіжний сервіс WayForPay; картку ви вводите на його захищеній сторінці.'] },
        { h: 'Повернення коштів', p: ['Оскільки це цифрова послуга, яка відкривається одразу після оплати, ви можете звернутися за поверненням коштів, якщо функція не працює належним чином. Запит на повернення — через контакт сервісу.'] },
        { h: 'Медичне застереження', p: ['Всетута не є медичним засобом і не замінює консультацію лікаря. Дані про ліки, взаємодії та фази циклу — лише довідкові й орієнтовні. Рішення щодо здоров’я приймайте разом із лікарем.'] },
        { h: 'Фінансовий облік', p: ['Розділ «Фінанси» — це особистий облік для навчальних цілей. Він не є бухгалтерською чи податковою системою: дані не аудуються, не формують офіційної звітності й не призначені для обліку підприємства, компанії чи професійної діяльності. Суми орієнтовні; фінансові рішення приймайте на власний розсуд.'] },
        { h: 'Обмеження відповідальності', p: ['Як навчальний проєкт, сервіс надається без гарантій. Відповідальність за можливі втрати, пов’язані з використанням орієнтовних даних чи з перервами в роботі, виключається.'] },
      ],
    },
    en: {
      title: 'Terms of Use and Public Offer',
      intro: 'By using Всетута you agree to these terms. This is an educational diploma project.',
      sections: [
        { h: 'About the service', p: ['Всетута is a student planner: calendar, study, work, food, shopping, finances, health, cycle and notes. The service is provided within a diploma demonstration.'] },
        { h: 'Minimum age', p: ['The service is intended for people aged 6 and older. By registering, you confirm that you are at least 6 years old. If you are under 18, use the service with the consent and supervision of a parent or legal guardian.'] },
        { h: 'Paid “Quick add” feature', p: ['Most features are free. The “Quick add” feature (natural-language task parsing) requires a one-time payment of UAH 100 after a few free uses — a permanent purchase, with no subscription or auto-renewal.'] },
        { h: 'Seller and payment', p: ['In a real launch this would list the seller’s full details (sole-proprietor/company name, tax codes, address, contacts) per the Law “On Electronic Commerce” No. 675-VII. Payment goes through the WayForPay service; you enter your card on its secure page.'] },
        { h: 'Refunds', p: ['As this is a digital service unlocked immediately after payment, you may request a refund if the feature does not work properly. Submit refund requests via the service contact.'] },
        { h: 'Medical disclaimer', p: ['Всетута is not a medical device and does not replace a doctor’s advice. Data on medicines, interactions and cycle phases is reference-only and approximate. Make health decisions together with your doctor.'] },
        { h: 'Finance', p: ['The “Finances” section is personal tracking for educational purposes. It is not an accounting or tax system: the data is not audited, produces no official reporting, and is not intended for bookkeeping of a business, company or professional activity. Amounts are approximate; make financial decisions at your own discretion.'] },
        { h: 'Limitation of liability', p: ['As an educational project, the service is provided without warranties. Liability for any losses from relying on approximate data or from service interruptions is excluded.'] },
      ],
    },
  },
}

export default function Legal({ doc, themeMode, onSetThemeMode, palette, onSetPalette }) {
  const { t, language, setLanguage } = useI18n()
  const lang = language === 'en' ? 'en' : 'uk'
  const data = CONTENT[doc][lang]
  const otherDoc = doc === 'privacy' ? 'terms' : 'privacy'

  return (
    <div className="legal-page">
      <header className="legal-top">
        <Link to="/" className="legal-brand">Всетута</Link>
        <div className="legal-top-actions">
          {onSetPalette && (
            <label className="auth-palette">
              <span className="auth-palette-label">{t('landing.colorLabel')}</span>
              <select
                className="auth-palette-select"
                value={palette}
                onChange={(e) => onSetPalette(e.target.value)}
              >
                {PALETTES.map((name) => (
                  <option key={name} value={name}>{t(`settings.palette.${name}`)}</option>
                ))}
              </select>
            </label>
          )}
          {onSetThemeMode && (
            <button
              type="button"
              className="legal-icon-btn"
              onClick={() => onSetThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              aria-label={lang === 'uk' ? 'Змінити тему' : 'Toggle theme'}
              title={lang === 'uk' ? 'Світла / темна тема' : 'Light / dark theme'}
            >
              <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} />
            </button>
          )}
          <button
            type="button"
            className="legal-lang"
            onClick={() => setLanguage(lang === 'uk' ? 'en' : 'uk')}
          >
            {lang === 'uk' ? 'EN' : 'УК'}
          </button>
        </div>
      </header>

      <article className="legal-doc">
        <h1>{data.title}</h1>
        <p className="legal-intro">{data.intro}</p>
        {data.sections.map((s) => (
          <section key={s.h} className="legal-section">
            <h2>{s.h}</h2>
            {s.p.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </section>
        ))}
        <nav className="legal-nav">
          <Link to={`/${otherDoc}`}>{CONTENT[otherDoc][lang].title} →</Link>
          <Link to="/">{lang === 'uk' ? 'На головну' : 'Home'}</Link>
        </nav>
      </article>
    </div>
  )
}
