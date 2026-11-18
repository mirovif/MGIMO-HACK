'use client'

import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, ClipboardCheck, Download, FileText, HeartPulse, NotebookPen, RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  api, ApiError, caseCategories, certificates, errorText, formatDate, formatTime, moscowToday, scenarioNames,
  statuses, useResource, type CaseDetail, type CaseSummary, type Grade, type Lesson, type Profile, type Scenario, type Status,
} from './lib'
import { Busy, Empty, Problem, ProfileFacts, Section, StatusBadge } from './ui'

const scenarios = {
  illness: { icon: HeartPulse, caption: 'Сообщить о пропуске занятий', steps: ['Период отсутствия', 'Пропущенные пары', 'Комментарий и документ', 'Проверка данных'] },
  retake: { icon: RotateCcw, caption: 'Уточнить возможность пересдачи', steps: ['Дисциплина', 'Описание проблемы', 'Проверка данных'] },
  certificate: { icon: FileText, caption: 'Запросить документ в деканате', steps: ['Тип документа', 'Данные профиля', 'Проверка данных'] },
  other: { icon: CircleHelp, caption: 'Направить вопрос сотруднику', steps: ['Категория', 'Описание вопроса', 'Проверка данных'] },
}
type Draft = {
  scenario: Scenario; step: number; key: string; start: string; end: string; missed: string[]
  subject: string; certificate: keyof typeof certificates | ''; category: keyof typeof caseCategories | ''; comment: string
  attachmentName?: string
}

function makeDraft(scenario: Scenario): Draft {
  return { scenario, step: 0, key: crypto.randomUUID(), start: moscowToday(), end: moscowToday(),
    missed: [], subject: '', certificate: '', category: '', comment: '' }
}

function loadDraft(storageKey: string): Draft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    if (value && Object.hasOwn(scenarios, value.scenario) && typeof value.key === 'string') return value
  } catch {}
  return null
}

function DatePeriod({ start, end }: { start?: string; end?: string }) {
  if (!start || !end) return null
  return <>{formatDate(start)}{start !== end && <> — {formatDate(end)}</>}</>
}

export function Wizard({ user }: { user: Profile }) {
  const storageKey = 'campus-draft-' + user.id
  const [draft, setDraft] = useState(() => loadDraft(storageKey))
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [created, setCreated] = useState<CaseDetail>()
  const [choosing, setChoosing] = useState(false)
  const submission = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const grades = useResource<Grade[]>(draft?.scenario === 'retake' ? '/grades' : null)
  const missed = useResource<Lesson[]>(draft?.scenario === 'illness' && draft.step > 0
    ? '/schedule/missed?' + new URLSearchParams({ start: draft.start, end: draft.end }) : null)
  useEffect(() => {
    try { if (draft) sessionStorage.setItem(storageKey, JSON.stringify(draft)); else sessionStorage.removeItem(storageKey) } catch {}
  }, [draft, storageKey])
  useEffect(() => { heading.current?.focus() }, [draft?.step, draft?.scenario])

  function update(values: Partial<Draft>, changeContent = true) {
    setError('')
    setDraft(current => current && { ...current, ...values, key: changeContent ? crypto.randomUUID() : current.key })
  }
  function choose(scenario: Scenario) {
    if (draft?.scenario !== scenario) { setDraft(makeDraft(scenario)); setFile(undefined) }
    setError(''); setChoosing(false)
  }
  if (created) return <Section title="Обращение отправлено">
    <div className="panel success-panel"><div className="success-icon"><Check size={29} /></div><div>
      <h2>{created.number}</h2><p>{scenarioNames[created.scenario]}</p><StatusBadge status={created.status} />
    </div><div className="button-group">
      <a className="button primary" href={'#app/requests/' + created.id}>Открыть обращение <ArrowRight size={19} /></a>
      <button className="button secondary" onClick={() => setCreated(undefined)}>Создать ещё обращение</button>
    </div></div>
  </Section>
  if (!draft || choosing) return <Section title="Что случилось?" text="Выберите ситуацию. Подскажем, какие данные нужны деканату."
    action={<a className="button secondary" href="#app/requests">Мои обращения</a>}>
    <div className="scenario-grid">{Object.entries(scenarios).map(([key, item]) => <button type="button" className="scenario-card" key={key} onClick={() => choose(key as Scenario)}>
      <span className="scenario-icon"><item.icon size={25} /></span><span><strong>{scenarioNames[key as Scenario]}</strong><small>{item.caption}</small></span>
      <ChevronRight size={20} className="scenario-arrow" />
    </button>)}</div>
  </Section>

  const current = draft
  const plan = scenarios[draft.scenario].steps
  const last = plan.length - 1
  const { scenario, step } = draft

  async function next(event: FormEvent) {
    event.preventDefault()
    if (submission.current) return
    setError('')
    if (scenario === 'illness' && step === 0) {
      const days = (Date.parse(current.end) - Date.parse(current.start)) / 86_400_000
      if (!Number.isFinite(days) || days < 0 || days > 30) { setError('Укажите период от 1 до 31 дня и проверьте порядок дат.'); return }
    }
    if ((scenario === 'other' || scenario === 'retake') && step === 1 && current.comment.trim().length < 3) {
      setError('Добавьте описание из трёх или более символов.'); return
    }
    if (step < last) { update({ step: step + 1 }, false); return }
    submission.current = true
    setSending(true)
    const details = scenario === 'illness' ? { start_date: current.start, end_date: current.end, missed_ids: current.missed, comment: current.comment }
      : scenario === 'retake' ? { subject: current.subject, comment: current.comment }
      : scenario === 'certificate' ? { certificate_type: current.certificate, comment: current.comment }
      : { category: current.category, comment: current.comment }
    const json = JSON.stringify({ scenario, details })
    const multipart = file ? new FormData() : null
    if (multipart && file) { multipart.set('payload', json); multipart.set('file', file) }
    try {
      const response = await api<CaseDetail>('/requests', { method: 'POST', headers: { 'Idempotency-Key': current.key }, body: multipart || json })
      setDraft(null); setFile(undefined); setCreated(response)
    } catch (err) { setError(errorText(err)) }
    finally { submission.current = false; setSending(false) }
  }

  return <Section title={scenarioNames[scenario]} action={<a className="button secondary" href="#app/requests">Мои обращения</a>}>
    <ol className="progress" aria-label="Шаги обращения">
      {plan.map((title, index) => <li key={title} aria-current={step === index ? 'step' : undefined} className={index < step ? 'complete' : ''}>
        <span>{index < step ? <Check size={14} /> : index + 1}</span><b>{title}</b>
      </li>)}
    </ol>
    <form className="panel wizard" onSubmit={next}>
      <p className="muted small">Шаг {step + 1} из {plan.length}</p>
      <h2 tabIndex={-1} ref={heading}>{plan[step]}</h2>
      <div className="stack form-body">
        {scenario === 'illness' && step === 0 && <div className="form-grid">
          <label>Первый день<input type="date" required value={draft.start} onChange={event => update({ start: event.target.value, missed: [] })} /></label>
          <label>Последний день<input type="date" required value={draft.end} onChange={event => update({ end: event.target.value, missed: [] })} /></label>
        </div>}
        {scenario === 'illness' && step === 1 && <>
          <p className="muted">Отметьте пропущенные занятия за выбранный период. Пары взяты из демонстрационного расписания.</p>
          {missed.loading && <Busy />}
          {missed.error && <Problem text={missed.error} retry={missed.reload} />}
          {missed.data?.length === 0 && <Empty title="В этот период занятий нет">Можно перейти дальше.</Empty>}
          {missed.data?.map(lesson => <label className="check-row" key={lesson.id}><input type="checkbox" checked={draft.missed.includes(lesson.id)} onChange={event => update({
            missed: event.target.checked ? [...draft.missed, lesson.id] : draft.missed.filter(id => id !== lesson.id),
          })} /><span><strong>{lesson.subject}</strong><small>{formatDate(lesson.date)} · {lesson.start}</small></span></label>)}
        </>}
        {scenario === 'illness' && step === 2 && <>
          <label>Комментарий <small>Необязательно</small><textarea value={draft.comment} maxLength={2000} onChange={event => update({ comment: event.target.value })} rows={4} /></label>
          <label>Демонстрационный документ <small>PDF, PNG или JPEG до 3 МБ. Выберите файл без реальных персональных данных.</small>
            <input type="file" accept=".pdf,.png,.jpeg,.jpg,application/pdf,image/png,image/jpeg" onChange={event => {
              const selected = event.target.files?.[0]
              if (selected && selected.size > 3 * 1024 * 1024) {
                event.target.value = ''; setError('Выберите файл размером до 3 МБ.')
              } else { setFile(selected); update({ attachmentName: selected?.name }, selected?.name !== draft.attachmentName) }
            }} />
          </label>
          {draft.attachmentName && <div className="attachment-line"><FileText size={18} /><span>{draft.attachmentName}</span><button className="text-button" type="button" onClick={() => {
            setFile(undefined); update({ attachmentName: undefined })
            const control = document.querySelector<HTMLInputElement>('input[type=file]')
            if (control) control.value = ''
          }}>Убрать</button></div>}
        </>}
        {scenario === 'retake' && step === 0 && <>
          {grades.loading && <Busy />}{grades.error && <Problem text={grades.error} retry={grades.reload} />}
          {grades.data?.length === 0 && <Empty title="Дисциплины пока не появились" />}
          {!!grades.data?.length && <label>Выберите дисциплину<select required value={draft.subject} onChange={event => update({ subject: event.target.value })}>
            <option value="">Выбрать</option>{[...new Set(grades.data.map(item => item.subject))].map(subject => <option key={subject}>{subject}</option>)}
          </select></label>}
        </>}
        {scenario === 'certificate' && step === 0 && <label>Какой документ вам нужен?<select required value={draft.certificate} onChange={event => update({ certificate: event.target.value as Draft['certificate'] })}>
          <option value="">Выбрать тип</option>{Object.entries(certificates).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>}
        {scenario === 'certificate' && step === 1 && <><p className="muted">Данные подставлены из вашего профиля.</p><ProfileFacts profile={user} /></>}
        {scenario === 'other' && step === 0 && <label>О чём ваш вопрос?<select required value={draft.category} onChange={event => update({ category: event.target.value as Draft['category'] })}>
          <option value="">Выбрать категорию</option>{Object.entries(caseCategories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>}
        {(scenario === 'retake' || scenario === 'other') && step === 1 && <label>{scenario === 'retake' ? 'Что произошло?' : 'Опишите вопрос'}
          <textarea required minLength={3} maxLength={2000} rows={5} value={draft.comment} onChange={event => update({ comment: event.target.value })} />
        </label>}
        {scenario === 'illness' && step === last && missed.loading && <Busy />}
        {scenario === 'illness' && step === last && missed.error && <Problem text={missed.error} retry={missed.reload} />}
        {scenario === 'illness' && step >= 2 && draft.attachmentName && !file && <Problem text="Выберите файл снова на шаге «Комментарий и документ» или уберите его из черновика." />}
        {step === last && <CaseFacts attachment={draft.attachmentName} details={{
          ...(scenario === 'illness' ? { start_date: draft.start, end_date: draft.end, missed_lessons: missed.data?.filter(item => draft.missed.includes(item.id)) } : {}),
          ...(scenario === 'retake' ? { subject: draft.subject } : {}),
          ...(draft.certificate ? { certificate_type: draft.certificate, profile: user } : {}),
          ...(draft.category ? { category: draft.category } : {}), comment: draft.comment,
        }} />}
        {error && <Problem text={error} />}
      </div>
      <div className="wizard-actions">
        <button type="button" className="button secondary" disabled={sending} onClick={() => step ? update({ step: step - 1 }, false) : setChoosing(true)}><ArrowLeft size={18} /> Назад</button>
        <button className="button primary" disabled={sending || (scenario === 'retake' && step === 0 && !grades.data?.length) ||
          (scenario === 'illness' && ((step === 1 || step === last) && !missed.data || step >= 2 && !!draft.attachmentName && !file))}>
          {sending ? 'Отправляем…' : step === last ? 'Отправить обращение' : 'Далее'}{step === last ? <ClipboardCheck size={18} /> : <ArrowRight size={18} />}
        </button>
      </div>
    </form>
  </Section>
}

function CaseFacts({ details, attachment, download }: { details: CaseDetail['details']; attachment?: string | null; download?: string }) {
  return <div className="case-facts">
    {details.start_date && <div><b>Период отсутствия</b><p><DatePeriod start={details.start_date} end={details.end_date} /></p></div>}
    {details.missed_lessons && <div><b>Пропущенные пары</b>{details.missed_lessons.length
      ? <ul>{details.missed_lessons.map(item => <li key={item.id}>{formatDate(item.date)} · {item.start} · {item.subject}</li>)}</ul>
      : <p>Пары не отмечены.</p>}</div>}
    {details.subject && <div><b>Дисциплина</b><p>{details.subject}</p></div>}
    {details.category && <div><b>Категория</b><p>{caseCategories[details.category]}</p></div>}
    {details.certificate_type && <div><b>Тип документа</b><p>{certificates[details.certificate_type]}</p></div>}
    {details.comment && <div><b>Комментарий</b><p className="pre-line">{details.comment}</p></div>}
    {details.profile && <ProfileFacts profile={details.profile} />}
    {attachment && <div><b>Вложение</b><p>{download ? <a href={download} className="text-link"><Download size={18} /> {attachment}</a> : attachment}</p></div>}
  </div>
}

export function CaseList({ staff }: { staff: boolean }) {
  const resource = useResource<CaseSummary[]>('/requests')
  const [status, setStatus] = useState<Status | ''>('')
  const items = resource.data?.filter(item => !status || item.status === status)
  return <Section title={staff ? 'Заявки студентов' : 'Мои обращения'} text={staff ? 'Отслеживайте новые заявки и отвечайте студентам.' : 'Здесь сохраняются номера, статусы и ответы деканата.'}
    action={staff ? <button className="button secondary" onClick={resource.reload}><RefreshCw size={16} /> Обновить</button>
      : <a href="#app/new" className="button primary"><NotebookPen size={18} /> Новое обращение</a>}>
    <label className="filter">Статус<select value={status} onChange={event => setStatus(event.target.value as Status | '')}><option value="">Все статусы</option>
      {Object.entries(statuses).map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></label>
    {resource.loading && <Busy />}
    {resource.error && <Problem text={resource.error} retry={resource.reload} />}
    {items?.length === 0 && <Empty title={status ? 'По этому статусу обращений нет' : 'Пока нет обращений'} />}
    <div className="stack">{items?.map(item => <a href={'#app/requests/' + item.id} className="panel case-row" key={item.id}>
      <div><p className="muted small">{item.number} · {formatDate(item.created_at)}</p><h2>{scenarioNames[item.scenario]}</h2>{staff && <p>{item.student}</p>}</div>
      <StatusBadge status={item.status} /><ChevronRight size={21} className="case-chevron" />
    </a>)}</div>
  </Section>
}

const staffTransitions: Record<Status, Status[]> = { submitted: ['review', 'clarification', 'rejected'],
  review: ['clarification', 'resolved', 'rejected'], clarification: ['review', 'rejected'], resolved: [], rejected: [] }
const historyActions: Record<string, string> = { created: 'Обращение отправлено', reply: 'Студент ответил', comment: 'Комментарий сотрудника' }

export function CaseDetails({ id, staff, onChange }: { id: string; staff: boolean; onChange: () => void }) {
  const path = '/requests/' + encodeURIComponent(id)
  const resource = useResource<CaseDetail>(path)
  const [local, setLocal] = useState<CaseDetail>()
  const [choice, setChoice] = useState<Status | ''>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const request = local && (!resource.data || local.version >= resource.data.version) ? local : resource.data
  function refresh() { setLocal(undefined); resource.reload() }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!request || pending) return
    if ((!staff || !choice || ['clarification', 'rejected'].includes(choice)) && message.trim().length < 3) {
      setError('Добавьте сообщение из трёх или более символов.'); return
    }
    setPending(true); setError(''); setSaved(false)
    try {
      setLocal(await api<CaseDetail>(path + (staff ? '/staff' : '/reply'), { method: 'POST',
        body: JSON.stringify({ version: request.version, message, ...(staff ? { status: choice || null } : {}) }) }))
      setChoice(''); setMessage(''); setSaved(true); onChange()
    } catch (err) {
      setError(errorText(err))
      if (err instanceof ApiError && err.status === 409) { setChoice(''); refresh() }
    } finally { setPending(false) }
  }
  return <Section title={request ? scenarioNames[request.scenario] : 'Обращение'} text={request ? request.number + (staff ? ' · ' + request.student : '') : undefined}
    action={<a className="button secondary" href="#app/requests"><ArrowLeft size={18} /> К списку</a>}>
    {error && <Problem text={error} />}
    {resource.loading && !request && <Busy />}
    {resource.error && <Problem text={resource.error} retry={refresh} />}
    {request && <div className="detail-grid">
      <div className="stack"><div className="panel">
        <header className="panel-head"><h2>Данные обращения</h2><StatusBadge status={request.status} /></header>
        <CaseFacts details={request.details} attachment={request.attachment} download={'/api' + path + '/attachment'} />
      </div>
      {(staff || request.status === 'clarification') && <form className="panel stack" onSubmit={submit}>
        <h2>{staff ? 'Ответ деканата' : 'Ответ на уточнение'}</h2>
        {staff && <label>Действие<select value={choice} onChange={event => setChoice(event.target.value as Status | '')}>
          <option value="">Оставить комментарий</option>
          {staffTransitions[request.status].map(key => <option key={key} value={key}>{statuses[key]}</option>)}
        </select></label>}
        <label>{staff ? 'Комментарий' : 'Ваш ответ'}<textarea value={message} maxLength={2000} rows={4} onChange={event => setMessage(event.target.value)} /></label>
        <button className="button primary" disabled={pending}>{pending ? 'Сохраняем…' : staff ? 'Сохранить' : 'Отправить ответ'}</button>
      </form>}
      {saved && <div className="feedback success" role="status"><Check size={19} /> Изменения сохранены</div>}
      </div>
      <div className="panel history"><header className="panel-head"><h2>История</h2><button type="button" className="icon-button" aria-label="Обновить историю" onClick={refresh}><RefreshCw size={18} /></button></header>
        <ol>{request.history.map(entry => <li key={entry.id}><p className="muted small">{formatTime(entry.created_at)} · {entry.actor}</p>
          <strong>{historyActions[entry.action] || statuses[entry.status]}</strong>{entry.message && <p className="pre-line">{entry.message}</p>}</li>)}</ol>
      </div>
    </div>}
  </Section>
}
