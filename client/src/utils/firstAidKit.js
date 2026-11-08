// Довідник "Рекомендована аптечка" — ~14 базових позицій домашньої аптечки. Кожна позиція має
// ключові слова (основи діючих речовин / форм випуску) для АВТОМАТИЧНОГО зіставлення з тим, що вже
// є в аптечці користувача (порівняння за входженням підрядка в назву+речовину препарату).
// Назви й опис призначення — в i18n (firstaid.item.<key>.name / .purpose). Клієнтський довідник:
// дані фіксовані й малі, зіставлення — проти вже завантаженої аптечки, серверне сховище не потрібне.
export const FIRST_AID_KIT = [
  { key: 'antipyretic', keywords: ['парацетамол', 'ібупрофен', 'німесулід', 'ацетамінофен', 'paracetamol', 'ibuprofen', 'acetaminophen'] },
  { key: 'analgesic', keywords: ['анальгін', 'метамізол', 'кеторолак', 'кетопрофен', 'німесулід', 'парацетамол', 'ібупрофен', 'analgin', 'ketorolac', 'ketoprofen'] },
  { key: 'antiseptic', keywords: ['хлоргексидин', 'перекис', 'пероксид', 'йод', 'зеленк', 'брильянтов', 'бетадин', 'мірамістин', 'повідон', 'chlorhexidine', 'peroxide', 'iodine', 'miramistin', 'betadine'] },
  { key: 'dressing', keywords: ['бинт', 'марл', 'вата', 'серветк', 'bandage', 'gauze', 'cotton wool'] },
  { key: 'sorbent', keywords: ['вугілля', 'активован', 'смект', 'ентеросгель', 'полісорб', 'атоксіл', 'сорбент', 'charcoal', 'smecta', 'sorbent'] },
  { key: 'antihistamine', keywords: ['лоратадин', 'дезлоратадин', 'цетиризин', 'діазолін', 'супрастин', 'хлоропірамін', 'фенкарол', 'лорано', 'loratadine', 'cetirizine', 'suprastin'] },
  { key: 'burn', keywords: ['пантенол', 'декспантенол', 'олазоль', 'бепантен', 'panthenol', 'dexpanthenol'] },
  { key: 'rehydration', keywords: ['регідрон', 'регідрат', 'електроліт', 'ораліт', 'rehydron', 'electrolyte', 'oralit'] },
  { key: 'thermometer', keywords: ['термометр', 'градусник', 'thermometer'] },
  { key: 'plaster', keywords: ['пластир', 'лейкопластир', 'plaster', 'adhesive bandage', 'band-aid'] },
  { key: 'scissors', keywords: ['ножиц', 'scissors'] },
  { key: 'gloves', keywords: ['рукавич', 'латекс', 'нітрил', 'gloves', 'latex', 'nitrile'] },
  { key: 'nasal', keywords: ['ксилометазолін', 'оксиметазолін', 'нафазолін', 'назол', 'отривін', 'нокспрей', 'піносол', 'xylometazoline', 'oxymetazoline', 'nasal'] },
  { key: 'heartburn', keywords: ['омепразол', 'пантопразол', 'фамотидин', 'антацид', 'альмагель', 'маалокс', 'ренні', 'гавіскон', 'omeprazole', 'antacid', 'almagel'] },
]
