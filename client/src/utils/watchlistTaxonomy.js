// Фіксовані двомовні довідники класифікації для вкладки «Перегляд і читання».
// Ключі зберігаються у MediaItem.Genre / MediaItem.MediaType і дзеркалять набори в
// server/Controllers/MediaController.cs (VideoTypes / VideoGenres / BookGenres).
// Той самий підхід, що й utils/financeCategories.js.

// Вид відео (лише для відео): фільм / серіал / аніме / дорама / мультфільм / інше.
export const VIDEO_TYPES = [
  { key: 'film', uk: 'Фільм', en: 'Film' },
  { key: 'series', uk: 'Серіал', en: 'Series' },
  { key: 'anime', uk: 'Аніме', en: 'Anime' },
  { key: 'dorama', uk: 'Дорама', en: 'Dorama' },
  { key: 'cartoon', uk: 'Мультфільм', en: 'Cartoon' },
  { key: 'other', uk: 'Інше', en: 'Other' },
]

// Жанр відео.
export const VIDEO_GENRES = [
  { key: 'drama', uk: 'Драма', en: 'Drama' },
  { key: 'comedy', uk: 'Комедія', en: 'Comedy' },
  { key: 'action', uk: 'Бойовик', en: 'Action' },
  { key: 'scifi', uk: 'Фантастика', en: 'Sci-fi' },
  { key: 'fantasy', uk: 'Фентезі', en: 'Fantasy' },
  { key: 'horror', uk: 'Жахи', en: 'Horror' },
  { key: 'thriller', uk: 'Трилер', en: 'Thriller' },
  { key: 'melodrama', uk: 'Мелодрама', en: 'Romance' },
  { key: 'detective', uk: 'Детектив', en: 'Detective' },
  { key: 'adventure', uk: 'Пригоди', en: 'Adventure' },
  { key: 'documentary', uk: 'Документальне', en: 'Documentary' },
  { key: 'other', uk: 'Інше', en: 'Other' },
]

// Жанр книги.
export const BOOK_GENRES = [
  { key: 'fiction', uk: 'Художня література', en: 'Fiction' },
  { key: 'nonfiction', uk: 'Нон-фікшн', en: 'Non-fiction' },
  { key: 'scifi', uk: 'Фантастика', en: 'Sci-fi' },
  { key: 'fantasy', uk: 'Фентезі', en: 'Fantasy' },
  { key: 'detective', uk: 'Детектив', en: 'Detective' },
  { key: 'melodrama', uk: 'Мелодрама', en: 'Romance' },
  { key: 'thriller', uk: 'Трилер / жахи', en: 'Thriller / horror' },
  { key: 'poetry', uk: 'Поезія', en: 'Poetry' },
  { key: 'biography', uk: 'Біографія', en: 'Biography' },
  { key: 'selfdev', uk: 'Саморозвиток', en: 'Self-growth' },
  { key: 'history', uk: 'Історія', en: 'History' },
  { key: 'other', uk: 'Інше', en: 'Other' },
]

// Жанри за типом медіа (video|book).
export function genresFor(kind) {
  return kind === 'book' ? BOOK_GENRES : VIDEO_GENRES
}

const label = (list, key, language) => {
  const item = list.find((x) => x.key === key)
  if (!item) return key || ''
  return language === 'en' ? item.en : item.uk
}

// Локалізована назва жанру за типом медіа; невідомий ключ показуємо як є.
export function genreName(key, language, kind) {
  if (!key) return ''
  return label(genresFor(kind), key, language)
}

// Локалізована назва виду (лише відео).
export function typeName(key, language) {
  if (!key) return ''
  return label(VIDEO_TYPES, key, language)
}
