// English dictionary for the natural-language parser (nlp/parser.js). Mirror of dict.uk.js.
// The engine is language-agnostic; adding a word or a whole language means editing/adding
// one such config file only. Keys are lowercase — the engine lowercases text before matching.

export default {
  code: 'en',

  // Step 1. Task delimiters (phrases). Comma is handled separately by the engine.
  delimiters: ['and then', 'then', 'after that', 'and also', 'also', 'plus', 'as well as'],

  // Relative dates: word → day offset from today.
  relativeDates: {
    'day before yesterday': -2,
    yesterday: -1,
    today: 0,
    tonight: 0,
    tomorrow: 1,
    'day after tomorrow': 2,
  },

  // Weekdays: full names + common abbreviations → ISO number (1=Mon..7=Sun).
  weekdays: {
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
    sunday: 7, sun: 7,
  },

  weekdayMarkers: ['on', 'this'],
  nextWeekMarkers: ['next'],

  // Months: full names + abbreviations → number (1..12).
  months: {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  },

  // Markers before a time ("at 4", "at 16:00").
  timeMarkers: ['at'],
  dayParts: {}, // English uses am/pm, handled directly by the engine.
  oclockWords: ["o'clock", 'oclock'],

  // Duration units ("for 2 hours", "30 min").
  durationHours: ['hours', 'hour', 'hrs', 'hr'],
  durationMinutes: ['minutes', 'minute', 'mins', 'min'],

  // "Nth" day-of-month suffixes.
  dayOfMonthWords: [],
  ordinalSuffixes: ['st', 'nd', 'rd', 'th'],

  // Module verbs/objects → module code.
  modules: {
    shopping: ['buy', 'purchase', 'order', 'grab'],
    media: ['read', 'watch', 'view'],
    food: ['cook', 'bake', 'boil', 'fry', 'roast', 'prepare'],
  },

  // Prepositions/conjunctions — trimmed only at the EDGES of a title.
  edgeWords: ['a', 'an', 'the', 'at', 'on', 'to', 'in', 'of', 'for', 'by', 'and'],
}
