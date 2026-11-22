'use client'

import {
  ArrowUpRight, Bell, BookOpen, CalendarDays, ChartNoAxesColumn, ChevronRight, CircleUserRound, ClipboardList, GraduationCap, House,
  LogOut, MapPin, Menu, MessageCircle, MoveRight, NotebookPen, PartyPopper, RefreshCw, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { AccountProfile } from './account-profile'
import { api, errorText, formatDate, formatTime, moscowToday, useResource, type CaseSummary, type Notice, type Profile, type Schedule } from './lib'
import { AssistantPage } from './chat'
import { EducationCatalog, educationUniverseTitle } from './education-catalog'
import { CaseDetails, CaseList, Wizard } from './requests'
import { Campus, EventsPage, GradesPage, LessonList, RatingPage, SchedulePage } from './student'
import { Busy, Empty, Problem, Section, StatusBadge } from './ui'

const nav = [
  { id: 'home', label: 'Обзор', icon: House },
  { id: 'schedule', label: 'Расписание', icon: CalendarDays },
  { id: 'grades', label: 'Успеваемость', icon: GraduationCap },
  { id: 'rating', label: 'Рейтинг', icon: ChartNoAxesColumn },
  { id: 'new', label: 'Решить ситуацию', icon: NotebookPen },
  { id: 'requests', label: 'Мои обращения', icon: ClipboardList },
  { id: 'campus', label: 'Карта РЭУ', icon: MapPin },
  { id: 'catalog', label: educationUniverseTitle, icon: BookOpen },
  { id: 'events', label: 'Мероприятия', icon: PartyPopper },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'assistant', label: 'Комета', icon: MessageCircle },
  { id: 'profile', label: 'Профиль', icon: CircleUserRound },
]

const shortcuts = ['campus', 'catalog', 'rating', 'assistant'].flatMap(id => nav.filter(item => item.id === id))

export function Workspace({ user, route, onProfileChange, onLogout }: {
  user: Profile; route: string; onProfileChange: (profile: Profile) => void; onLogout: () => void
}) {
  const staff = user.role === 'staff'
  const headerName = user.name
  const allowed = staff ? nav.filter(item => ['requests', 'notifications', 'profile'].includes(item.id)) : nav
  const [, section, remainder] = route.split('/')
  const destination = section === 'ticket' && !staff ? 'profile' : section
  const page = allowed.some(item => item.id === destination) ? destination : staff ? 'requests' : 'home'
  const retakeSubject = remainder?.startsWith('retake?') ? new URLSearchParams(remainder.slice(7)).get('subject') ?? undefined : undefined
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')
  const notices = useResource<Notice[]>('/notifications')
  const { reload } = notices
  useEffect(() => {
    reload()
    const interval = window.setInterval(reload, 30_000)
    return () => window.clearInterval(interval)
  }, [route, reload])
  useEffect(() => {
    const close = () => setOpen(false)
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') close() }
    window.addEventListener('hashchange', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('hashchange', close); window.removeEventListener('keydown', escape) }
  }, [])
  const unread = notices.data?.filter(item => !item.read_at).length || 0

  async function logout() {
    setLeaving(true)
    try { await api('/auth/logout', { method: 'POST' }); onLogout() }
    catch (err) { setError(errorText(err)) }
    finally { setLeaving(false) }
  }

  return <div className="workspace">
    <a className="skip" href="#content" onClick={event => { event.preventDefault(); document.getElementById('content')?.focus() }}>К содержанию</a>
    <header className="app-top">
      <a className="utret-brand" href="/" aria-label="UTRET, на главную">UTRET</a>
      <span className="app-role">{staff ? 'Кабинет сотрудника' : 'Личный кабинет'}</span>
      <div className="top-actions"><a className="icon-button notify-link" href="#app/notifications" aria-label={unread ? 'Уведомления, непрочитанных: ' + unread : 'Уведомления'}>
        <Bell size={21} />{unread > 0 && <i />}</a>
        <a href="#app/profile" className="profile-link" aria-label="Открыть профиль"><span>{headerName.split(' ').slice(0, 2).map(part => Array.from(part)[0]).join('')}</span><b>{headerName}</b></a>
        <button className="icon-button menu-button" aria-expanded={open} aria-controls="account-nav" aria-label={open ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </header>
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <nav id="account-nav" aria-label="Кабинет">
        {allowed.map(item => <a key={item.id} href={'#app/' + item.id} onClick={() => setOpen(false)} aria-current={page === item.id ? 'page' : undefined}>
          <item.icon size={19} />{staff && item.id === 'requests' ? 'Заявки студентов' : item.label}
          {item.id === 'notifications' && unread > 0 && <small>{unread}</small>}
        </a>)}
      </nav>
      <button className="text-button signout" disabled={leaving} onClick={logout}><LogOut size={18} />{leaving ? 'Выходим…' : 'Выйти'}</button>
      <p>Неофициальный конкурсный прототип</p>
    </aside>
    <main className="app-content" id="content" tabIndex={-1}>
      {error && <Problem text={error} />}
      {page === 'home' && <Home user={user} />}
      {page === 'schedule' && <SchedulePage />}
      {page === 'grades' && <GradesPage key={remainder ?? 'grades'} showSession={remainder === 'session'} />}
      {page === 'rating' && <RatingPage />}
      {page === 'new' && <Wizard key={retakeSubject ?? 'new'} user={user} retakeSubject={retakeSubject} />}
      {page === 'requests' && (remainder ? <CaseDetails key={remainder} id={remainder} staff={staff} onChange={reload} /> : <CaseList staff={staff} />)}
      {page === 'campus' && <Campus key={remainder} room={safeDecode(remainder)} />}
      {page === 'catalog' && <EducationCatalog />}
      {page === 'events' && <EventsPage />}
      {page === 'notifications' && <Notifications resource={notices} />}
      {page === 'assistant' && <AssistantPage user={user} />}
      {page === 'profile' && <AccountProfile
        user={user}
        onProfileChange={onProfileChange}
        action={<button className="button secondary" disabled={leaving} onClick={logout}><LogOut size={18} /> Выйти</button>}
      />}
    </main>
  </div>
}

function safeDecode(value?: string) {
  try { return decodeURIComponent(value || '') } catch { return '' }
}

function Home({ user }: { user: Profile }) {
  const timetable = useResource<Schedule>('/schedule')
  const cases = useResource<CaseSummary[]>('/requests')
  const nameParts = user.name.split(/\s+/)
  const greetingName = nameParts.length === 3 ? nameParts[1] : user.name
  return <Section title={'Привет, ' + greetingName} text={formatDate(moscowToday(), true)}>
    <div className="home-grid">
      <div className="home-hero">
        <div className="kicker"><NotebookPen size={19} /> Цифровой деканат</div>
        <h2>Решить<br /><em>ситуацию.</em></h2>
        <p>Запроси справку, сообщи о пропуске или задай вопрос деканату.</p>
        <a href="#app/new" className="button primary">Выбрать ситуацию <MoveRight size={21} /></a>
      </div>
      <div className="panel home-today">
        <header className="panel-head"><h2>Твой день</h2><a href="#app/schedule" className="text-link">Расписание <ChevronRight size={16} /></a></header>
        <p className="muted small">{['Демонстрационное расписание', user.group].filter(Boolean).join(' · ')}</p>
        {timetable.loading && <Busy />}
        {timetable.error && <Problem text={timetable.error} retry={timetable.reload} />}
        {timetable.data && <LessonList lessons={timetable.data.lessons} />}
      </div>
    </div>
    <nav className="home-shortcuts" aria-label="Быстрые ссылки">
      {shortcuts.map(({ id, label, icon: Icon }) => <a key={id} href={'#app/' + id}>
        <Icon size={20} aria-hidden="true" /><strong>{label}</strong><ArrowUpRight size={17} aria-hidden="true" />
      </a>)}
    </nav>
    <div className="panel home-requests"><header className="panel-head"><h2>Мои обращения</h2><a href="#app/requests" className="text-link">Все обращения <ChevronRight size={16} /></a></header>
      {cases.loading && <Busy />}
      {cases.error && <Problem text={cases.error} retry={cases.reload} />}
      {cases.data?.length === 0 && <Empty title="Пока нет обращений">Отправленные заявки появятся здесь.</Empty>}
      {cases.data?.slice(0, 3).map(item => <a key={item.id} href={'#app/requests/' + item.id} className="inline-case"><strong>{item.number}</strong><StatusBadge status={item.status} /></a>)}
    </div>
  </Section>
}

function Notifications({ resource }: { resource: ReturnType<typeof useResource<Notice[]>> }) {
  const [pending, setPending] = useState<number>()
  const [error, setError] = useState('')
  const [read, setRead] = useState<number[]>([])
  async function mark(id: number) {
    setError(''); setPending(id)
    try { await api('/notifications/' + id + '/read', { method: 'POST' }); setRead(values => [...values, id]); resource.reload() }
    catch (err) { setError(errorText(err)) }
    finally { setPending(undefined) }
  }
  return <Section title="Уведомления" text="Объявления, переносы занятий и новости по обращениям." action={<button className="button secondary" onClick={resource.reload}><RefreshCw size={16} /> Обновить</button>}>
    {error && <Problem text={error} />}
    {resource.loading && <Busy />}
    {resource.error && <Problem text={resource.error} retry={resource.reload} />}
    {resource.data?.length === 0 && <Empty title="Новых уведомлений пока нет" />}
    <div className="stack">{resource.data?.map(item => {
      const seen = item.read_at || read.includes(item.id)
      return <article className={'panel notice' + (seen ? '' : ' unread')} key={item.id}>
        <div><p className="muted small">{formatTime(item.created_at)}</p><h2>{item.title}</h2>
          {item.exam ? <p>{item.exam.subject} · {formatDate(item.exam.date)}</p> : <p>{item.message}</p>}
          {item.exam && <a className="text-link" href={item.exam.retake
            ? '#app/new/retake?' + new URLSearchParams({ subject: item.exam.subject })
            : '#app/grades/session'} onClick={() => { if (!seen) void mark(item.id) }}>
            {item.exam.retake ? 'Уточнить условия пересдачи' : 'Открыть сессию'} <ChevronRight size={16} />
          </a>}
          {item.request_id && <a className="text-link" href={'#app/requests/' + item.request_id} onClick={() => { if (!seen) void mark(item.id) }}>Открыть обращение <ChevronRight size={16} /></a>}</div>
        {!seen && <button className="button secondary" disabled={pending === item.id} onClick={() => void mark(item.id)}>Отметить прочитанным</button>}
      </article>
    })}</div>
  </Section>
}
