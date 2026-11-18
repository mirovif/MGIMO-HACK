'use client'

import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink, MapPin, Star, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, errorText, formatDate, moscowToday, shiftDate, useResource, type Grade, type Lesson, type Schedule } from './lib'
import { Busy, Empty, External, Problem, Section } from './ui'

const REA = 'https://rasp.rea.ru/'
const MAP = 'https://in.umap.world/reu'

export function LessonList({ lessons, dates = false }: { lessons: Lesson[]; dates?: boolean }) {
  if (!lessons.length) return <Empty title="На этот период занятий нет" />
  const grouped = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const day = grouped.get(lesson.date) || []
    day.push(lesson)
    grouped.set(lesson.date, day)
  }
  return <div className="lesson-list">{[...grouped].map(([date, entries]) => <div key={date}>
    {dates && <h3 className="day-label">{formatDate(date, true)}</h3>}
    {entries.map(lesson => <article className="lesson" key={lesson.id}>
      <div className="lesson-time"><strong>{lesson.start}</strong><small>{lesson.end}</small></div>
      <div><strong>{lesson.subject}</strong><p>{[lesson.kind, lesson.teacher].filter(Boolean).join(' · ')}</p>
        {lesson.room && <a className="text-link room-link" href={'#app/campus/' + encodeURIComponent(lesson.room)}><MapPin size={15} />{lesson.room}</a>}
        {lesson.change && <span className="lesson-change"><TriangleAlert size={15} />{lesson.change}</span>}
      </div>
    </article>)}
  </div>)}</div>
}

type Group = { key: string; name: string }

export function SchedulePage() {
  const [source, setSource] = useState<'demo' | 'rea'>('demo')
  const [date, setDate] = useState(moscowToday)
  const [span, setSpan] = useState<'day' | 'week'>('day')
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [selection, setSelection] = useState<Group>()
  const [weekOffset, setWeekOffset] = useState(0)
  const groups = useResource<Group[]>(source === 'rea' && searched ? '/schedule/public/groups?' + new URLSearchParams({ query: searched }) : null)
  const timetable = useResource<Schedule>(source === 'demo'
    ? '/schedule?' + new URLSearchParams({ on: date, span })
    : selection ? '/schedule/public?' + new URLSearchParams({ key: selection.key, offset: String(weekOffset) }) : null)

  function search(event: FormEvent) {
    event.preventDefault()
    if (query.trim().length < 2) return
    setSelection(undefined)
    if (searched === query.trim()) groups.reload()
    else setSearched(query.trim())
  }

  return <Section title="Расписание" text="Занятия, аудитории и изменения." action={<External href={REA} className="button secondary">Официальное расписание РЭУ</External>}>
    <div className="segmented" aria-label="Источник расписания">
      <button aria-pressed={source === 'demo'} onClick={() => setSource('demo')}>Моё демо-расписание</button>
      <button aria-pressed={source === 'rea'} onClick={() => setSource('rea')}>Открытые группы РЭУ</button>
    </div>
    {source === 'demo' ? <div className="panel schedule-tools">
      <div className="segmented" aria-label="Период расписания"><button aria-pressed={span === 'day'} onClick={() => setSpan('day')}>День</button>
        <button aria-pressed={span === 'week'} onClick={() => setSpan('week')}>Неделя</button></div>
      <div className="date-controls">
        <button className="icon-button" aria-label="Предыдущий период" onClick={() => setDate(shiftDate(date, span === 'day' ? -1 : -7))}><ChevronLeft size={21} /></button>
        <input aria-label="Дата расписания" type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value) }} />
        <button className="icon-button" aria-label="Следующий период" onClick={() => setDate(shiftDate(date, span === 'day' ? 1 : 7))}><ChevronRight size={21} /></button>
        <button className="text-button" onClick={() => setDate(moscowToday())}>Сегодня</button>
      </div>
    </div> : <div className="panel stack">
      <form className="search-form" onSubmit={search}><label>Номер группы РЭУ<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Введите часть номера группы" required minLength={2} maxLength={48} /></label>
        <button className="button primary">Найти группу</button></form>
      {groups.loading && <Busy text="Ищем группу в расписании РЭУ…" />}
      {groups.error && <><Problem text={groups.error} retry={groups.reload} /><External href={REA}>Открыть сайт расписания РЭУ</External></>}
      {groups.data?.length === 0 && <Empty title="Группа не найдена">Проверьте номер и повторите поиск.</Empty>}
      {!!groups.data?.length && <label>Найденные группы<select value={selection?.key || ''} onChange={event => {
        setSelection(groups.data?.find(group => group.key === event.target.value)); setWeekOffset(0)
      }}><option value="">Выбрать группу</option>{groups.data.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>}
      {selection && <div className="date-controls">
        <button className="icon-button" aria-label="Предыдущая неделя" disabled={weekOffset <= -8} onClick={() => setWeekOffset(weekOffset - 1)}><ChevronLeft size={21} /></button>
        <button className="text-button" onClick={() => setWeekOffset(0)}>Текущая неделя</button>
        <button className="icon-button" aria-label="Следующая неделя" disabled={weekOffset >= 8} onClick={() => setWeekOffset(weekOffset + 1)}><ChevronRight size={21} /></button>
      </div>}
    </div>}
    {timetable.loading && <Busy text="Загружаем занятия…" />}
    {timetable.error && <Problem text={timetable.error} retry={timetable.reload} />}
    {timetable.data && <div className="panel stack">
      <header className="panel-head"><div><p className="muted small">{source === 'demo' ? 'Демонстрационные данные · ' + timetable.data.group : 'Открытые данные РЭУ · ' + (selection?.name || '')}</p>
        <h2>{formatDate(timetable.data.start, span === 'day' && source === 'demo')}{timetable.data.start !== timetable.data.end && ' — ' + formatDate(timetable.data.end)}</h2></div><CalendarDays size={22} />
      </header><LessonList lessons={timetable.data.lessons} dates={span === 'week' || source === 'rea'} />
    </div>}
  </Section>
}

export function GradesPage() {
  const resource = useResource<Grade[]>('/grades')
  const [session, setSession] = useState(false)
  const grades = resource.data?.filter(grade => session ? grade.exam_date !== null : true)
  return <Section title="Успеваемость" text="Демонстрационная зачётка и предстоящая сессия.">
    <div className="segmented" aria-label="Представление успеваемости"><button aria-pressed={!session} onClick={() => setSession(false)}>Зачётка</button>
      <button aria-pressed={session} onClick={() => setSession(true)}>Сессия</button></div>
    {resource.loading && <Busy />}
    {resource.error && <Problem text={resource.error} retry={resource.reload} />}
    {grades?.length === 0 && <Empty title={session ? 'Даты сессии пока не появились' : 'Оценок пока нет'} />}
    {!!grades?.length && <div className="panel grades"><div className="grades-header"><strong>Дисциплина</strong><strong>Аттестация</strong><strong>Результат</strong></div>
      {grades.map(grade => <div className="grade" key={grade.subject}><div><strong>{grade.subject}</strong><small className="mobile-grade-kind muted">{grade.kind}</small></div><span className="muted">{grade.kind}</span>
        {grade.result ? <span className="badge status-resolved">{grade.result}</span> : <span className="badge status-review">{grade.exam_date ? formatDate(grade.exam_date) : 'Ожидается'}</span>}
      </div>)}</div>}
  </Section>
}

export function Campus({ room }: { room?: string }) {
  const [query, setQuery] = useState(room || '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  async function copy() {
    setError('')
    try { await navigator.clipboard.writeText(query.trim()); setCopied(true) }
    catch { setError('Не удалось скопировать. Выделите текст в поле и скопируйте вручную.') }
  }
  return <Section title="Кампус" text="Найдите корпус или аудиторию на интерактивной карте университета.">
    <div className="campus-grid"><div className="panel stack">
      <h2>Поиск аудитории</h2>
      <label>Корпус или аудитория<input value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setCopied(false) }} placeholder="Например, корпус 3, аудитория 412" /></label>
      <p className="muted">Скопируйте название, откройте карту UMAP и вставьте его в поиск. Выберите точку назначения и проложите маршрут на карте.</p>
      {error && <Problem text={error} />}
      {copied && <p role="status" className="copy-status">Название скопировано</p>}
      <div className="button-group"><button className="button secondary" onClick={() => void copy()} disabled={!query.trim()}><Copy size={18} /> Скопировать</button>
        <External href={MAP} className="button primary">Открыть карту UMAP</External></div>
    </div><div className="campus-display"><MapPin size={62} strokeWidth={1.4} /><strong>Кампус РЭУ</strong><span>Интерактивная карта UMAP</span></div></div>
  </Section>
}

type CampusEvent = { id: number; title: string; category: keyof typeof categories; description: string; location: string; date: string; start: string; end: string; favorite: boolean; conflicts: string[] }
const categories = { career: 'Карьера', study: 'Учёба', community: 'Сообщество' }

export function EventsPage() {
  const [category, setCategory] = useState('')
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState<number>()
  const [error, setError] = useState('')
  const params = new URLSearchParams({ saved: String(saved) })
  if (category) params.set('category', category)
  const events = useResource<CampusEvent[]>('/events?' + params)
  async function toggle(item: CampusEvent) {
    setError(''); setPending(item.id)
    try { await api('/events/' + item.id + '/favorite', { method: item.favorite ? 'DELETE' : 'PUT' }); events.reload() }
    catch (err) { setError(errorText(err)) }
    finally { setPending(undefined) }
  }
  return <Section title="Мероприятия" text="Демонстрационная афиша и пересечения с вашим расписанием.">
    <div className="event-filters"><label className="filter">Категория<select value={category} onChange={event => setCategory(event.target.value)}>
      <option value="">Все категории</option>{Object.entries(categories).map(([key, name]) => <option value={key} key={key}>{name}</option>)}
    </select></label>
    <label className="plain-check"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} /> Только избранное</label></div>
    {error && <Problem text={error} />}
    {events.loading && <Busy />}
    {events.error && <Problem text={events.error} retry={events.reload} />}
    {events.data?.length === 0 && <Empty title={saved ? 'Избранных мероприятий пока нет' : 'Мероприятия в этой категории пока отсутствуют'} />}
    <div className="event-grid">{events.data?.map(item => <article className="panel event" key={item.id}>
      <div className="panel-head"><span className="badge">{categories[item.category]}</span><button type="button" className="icon-button star" disabled={pending === item.id}
        aria-label={item.favorite ? 'Убрать из избранного' : 'Сохранить в избранное'} aria-pressed={item.favorite} onClick={() => void toggle(item)}><Star size={22} fill={item.favorite ? 'currentColor' : 'none'} /></button></div>
      <h2>{item.title}</h2><p>{item.description}</p>
      <p className="icon-text"><Clock3 size={17} />{formatDate(item.date)} · {item.start}–{item.end}</p>
      <a href={'#app/campus/' + encodeURIComponent(item.location)} className="text-link"><MapPin size={17} />{item.location}<ExternalLink size={13} /></a>
      {!!item.conflicts.length && <span className="lesson-change"><TriangleAlert size={16} />Пересекается с занятием: {item.conflicts.join(', ')}</span>}
    </article>)}</div>
  </Section>
}
