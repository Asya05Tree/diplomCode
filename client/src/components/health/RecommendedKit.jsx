import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Icon from '../Icon'
import { FIRST_AID_KIT } from '../../utils/firstAidKit'
import { medName, medSubstance } from '../../api/medicineCabinet'
import { addShoppingItem } from '../../api/shopping'

// Блок "Рекомендована аптечка" у вкладці "Аптечка". Згортуваний, не заважає основній таблиці.
// Наявність позиції визначається АВТОМАТИЧНО: якщо серед ліків користувача є препарат, що відповідає
// ключовим словам позиції — позиція закрита (із підписом, яким саме препаратом). Для відсутніх —
// кнопка "Додати до списку покупок" створює пункт у розділі "Аптека" з назвою КАТЕГОРІЇ (не препарату).
export default function RecommendedKit({ medicines, language }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [showNote, setShowNote] = useState(false) // "!" — звідки перелік (застереження)
  const [added, setAdded] = useState(() => new Set())

  // Текст для зіставлення: назва + діюча речовина кожного препарату аптечки (нижній регістр).
  const haystacks = useMemo(
    () => (medicines || []).map((m) => `${medName(m, language)} ${medSubstance(m, language)}`.toLowerCase()),
    [medicines, language],
  )

  const items = useMemo(
    () =>
      FIRST_AID_KIT.map((it) => {
        let idx = -1
        for (let i = 0; i < haystacks.length; i++) {
          if (it.keywords.some((k) => haystacks[i].includes(k))) { idx = i; break }
        }
        return { ...it, present: idx >= 0, by: idx >= 0 ? medName(medicines[idx], language) : null }
      }),
    [haystacks, medicines, language],
  )

  const presentCount = items.filter((i) => i.present).length

  const addToShopping = async (it) => {
    await addShoppingItem({ section: 'Pharmacy', category: 'medicine', text: t(`firstaid.item.${it.key}.name`) })
    setAdded((prev) => new Set(prev).add(it.key))
  }

  return (
    <div className="kit-block">
      <div className="kit-head-row">
        <button type="button" className="kit-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <Icon name="chevron-left" className="kit-caret" />
          <span className="kit-title">{t('firstaid.title')}</span>
          <span className="kit-progress">{t('firstaid.progress', { n: presentCount, total: FIRST_AID_KIT.length })}</span>
        </button>
        <button
          type="button"
          className={showNote ? 'vacc-info-btn vacc-info-btn--on' : 'vacc-info-btn'}
          onClick={() => setShowNote((v) => !v)}
          aria-expanded={showNote}
          aria-label={t('firstaid.noteToggle')}
          title={t('firstaid.noteToggle')}
        >
          <Icon name="info" />
        </button>
      </div>

      {showNote && <p className="kit-note">{t('firstaid.note')}</p>}

      {open && (
        <>
          <ul className="kit-list">
            {items.map((it) => (
              <li key={it.key} className={it.present ? 'kit-item kit-item--have' : 'kit-item'}>
                <span className="kit-item-icon">
                  <Icon name={it.present ? 'check' : 'warning'} />
                </span>
                <span className="kit-item-main">
                  <span className="kit-item-name">{t(`firstaid.item.${it.key}.name`)}</span>
                  <span className="kit-item-purpose">{t(`firstaid.item.${it.key}.purpose`)}</span>
                </span>
                {it.present ? (
                  <span className="kit-item-have">{t('firstaid.have', { med: it.by })}</span>
                ) : added.has(it.key) ? (
                  <span className="kit-item-added">{t('firstaid.added')}</span>
                ) : (
                  <button type="button" className="pill kit-add-btn" onClick={() => addToShopping(it)}>
                    <Icon name="cart" /> {t('firstaid.addToList')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
