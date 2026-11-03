// English dictionary for the natural-language parser (nlp/parser.js). Mirror of dict.uk.js.
// The engine is language-agnostic; adding a word or a whole language means editing/adding
// one such config file only. Keys are lowercase — the engine lowercases text before matching.
//
// modules / lessonMarkers / teacherMarkers are matched BY STEM (prefix + any ending), so
// "pay" catches pay/pays/payment. Pick stems carefully to avoid false matches.

export default {
  code: 'en',

  // Step 1. Task delimiters (phrases). Comma and period are handled separately by the engine.
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

  // Spelled-out day-of-month ordinals ("the fifth", "twenty-first"). Digit forms ("5th")
  // are handled by the ordinalSuffixes matcher instead.
  ordinalWords: {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
    eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
    sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
    'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23, 'twenty-fourth': 24, 'twenty-fifth': 25,
    'twenty-sixth': 26, 'twenty-seventh': 27, 'twenty-eighth': 28, 'twenty-ninth': 29, thirtieth: 30,
    'thirty-first': 31,
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

  // Filler words — trimmed only from the START of a title (phrases too). Action verbs are kept.
  fillerWords: [
    "don't forget to", 'dont forget to', 'remind me to', 'i want to', 'i need to', 'i have to',
    'i should', 'remember to', 'need to', 'have to', 'want to', 'gotta', 'let me', 'please',
  ],

  // Module stems (prefix + any ending) → module code.
  modules: {
    shopping: ['buy', 'purchase', 'order', 'grab', 'grocer', 'shop'],
    media: ['read', 'watch', 'view', 'movie', 'film', 'book', 'series', 'episode', 'video'],
    food: ['cook', 'bake', 'boil', 'fry', 'roast', 'prepare', 'breakfast', 'lunch', 'dinner', 'recipe', 'meal'],
    health: ['doctor', 'dentist', 'pharmac', 'pill', 'vitamin', 'appointment', 'clinic', 'vaccin', 'checkup'],
    study: ['lecture', 'seminar', 'class', 'lesson', 'exam', 'homework', 'assignment', 'quiz', 'course', 'professor', 'teacher', 'tutorial'],
    work: ['meeting', 'deadline', 'shift', 'client', 'standup', 'interview', 'overtime'],
    finance: ['pay', 'bill', 'invoice', 'rent', 'credit', 'loan', 'tax', 'deposit'],
    notes: ['note', 'jot', 'memo'],
  },

  // --- Study-module markers to pull out subject / teacher / link ---
  lessonMarkers: ['class', 'lecture', 'seminar', 'lesson', 'course'],
  teacherMarkers: ['teacher', 'professor', 'prof', 'lecturer', 'instructor'],
  linkWords: ['link', 'url'],
  noneWords: ['none', 'no'],

  // Prepositions/conjunctions — trimmed only at the EDGES of a title.
  edgeWords: ['a', 'an', 'the', 'at', 'on', 'to', 'in', 'of', 'for', 'by', 'and'],
}
