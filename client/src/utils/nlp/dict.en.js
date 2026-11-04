// English dictionary for the natural-language parser (nlp/parser.js). Mirror of dict.uk.js.
// The engine is language-agnostic; adding a word or a whole language means editing/adding
// one such config file only. Keys are lowercase — the engine lowercases text before matching.
//
// modules / lessonMarkers / teacherMarkers are matched BY STEM (prefix + any ending), so
// "pay" catches pay/pays/payment. Pick stems carefully to avoid false matches.

export default {
  code: 'en',

  // Step 1. Task delimiters (phrases). Comma and period are handled separately by the engine.
  // Bare "but" is also a clause boundary ("buy bread but tomorrow a class").
  delimiters: ['and then', 'then', 'after that', 'and also', 'also', 'plus', 'as well as', 'but'],

  // Relative dates: word → day offset from today.
  relativeDates: {
    'day before yesterday': -2,
    yesterday: -1,
    today: 0,
    tonight: 0,
    tomorrow: 1,
    'day after tomorrow': 2,
  },

  // "in N units" ("in two weeks", "in 3 days"). afterMarkers precede the number; the matcher
  // requires a unit, so "in 6 o'clock" (no unit) is NOT treated as a relative date.
  afterMarkers: ['in'],
  numberWords: {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12,
  },
  durationUnits: {
    day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30, year: 365, years: 365,
  },

  // Deadline markers: when placed BEFORE a date, that date is a deadline, not a start time.
  deadlineMarkers: ['by', 'until', 'till', 'before'],
  // Reference to an already-mentioned date as a deadline ("by then buy …" → deadline = prev date).
  byThenMarkers: ['by then', 'by that time', 'by that date'],

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

  // Markers before a time ("at 4", "at 16:00", "in 6").
  timeMarkers: ['at', 'in'],
  dayParts: {}, // English uses am/pm, handled directly by the engine.
  // o'clock and its common misspellings/spacings (so "6 o clok" is read as a time and stripped).
  oclockWords: ["o'clock", 'oclock', 'o clock', 'oclok', 'o clok', "o' clock"],

  // Duration units ("for 2 hours", "30 min").
  durationHours: ['hours', 'hour', 'hrs', 'hr'],
  durationMinutes: ['minutes', 'minute', 'mins', 'min'],

  // "Nth" day-of-month suffixes.
  dayOfMonthWords: [],
  ordinalSuffixes: ['st', 'nd', 'rd', 'th'],

  // Filler words — trimmed only from the START of a title (phrases too). Action verbs are kept.
  // Trailing entries are interjections/"mumbling" that carry no meaning (also trimmed at start).
  fillerWords: [
    "don't forget to", 'dont forget to', 'remind me to', 'i want to', 'i need to', 'i have to',
    'i should', 'remember to', 'need to', 'have to', 'want to', 'gotta', 'let me', 'please',
    'hmhmhm', 'hmm', 'hm', 'umm', 'um', 'uhh', 'uh', 'erm', 'eh',
  ],

  // Action-verb stems that start a new task ("watch a movie read a book" = two tasks). The split
  // only fires when there's an object between two verbs, so "go for a walk" stays one task.
  // Короткі/неоднозначні основи навмисно не беремо: "go" ловив би "good", "do" — "dog".
  verbs: [
    'watch', 'read', 'cook', 'bake', 'boil', 'fry', 'roast', 'prepare', 'buy', 'purchase',
    'order', 'grab', 'call', 'write', 'send', 'clean', 'wash', 'visit', 'walk', 'finish',
    'submit', 'bring', 'return',
  ],

  // Known subject names (matched by stem) so the Study subject is found even when not right
  // after the word "class".
  subjectWords: [
    'math', 'algebra', 'geometry', 'physic', 'chemist', 'biolog', 'geograph', 'histor',
    'literatur', 'english', 'ukrainian', 'german', 'french', 'informatic', 'programming',
    'philosoph', 'econom', 'law', 'psycholog', 'sociolog', 'astronom', 'ecolog',
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

  // "Add to stock" intent markers (a StockItem, not a task). The product list follows the marker
  // and is split on comma / and. stockStopWords are service words that are not products.
  stockMarkers: [
    'add to stock', 'add to pantry', 'add to inventory', 'add to the fridge', 'add to fridge',
    "i have", "i've got", 'i got', 'to stock', 'to pantry', 'in stock',
  ],
  stockStopWords: ['that', 'this', 'some', 'got', 'home', 'already'],
  // Stem of the "add to stock" verb — bounds the stock clause so a previous task is not
  // swallowed ("buy bread now add milk to stock" → stock is only "milk").
  stockVerbs: ['add'],

  // Prepositions/conjunctions — trimmed only at the EDGES of a title.
  edgeWords: ['a', 'an', 'the', 'at', 'on', 'to', 'in', 'of', 'for', 'by', 'and', 'with', 'my', 'me'],
}
