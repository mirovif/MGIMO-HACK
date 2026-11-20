'use client'

import { Pencil, UserRound } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { api, errorText, useResource, type Profile } from './lib'
import { Busy, Problem, Section } from './ui'
import styles from './account-profile.module.css'

type ProfileDetails = {
  full_name: string | null
  email: string | null
  phone: string | null
  specialization: string | null
  education_level: string | null
  study_mode: string | null
  study_basis: string | null
}

export function AccountProfile({ user, action, onProfileChange }: {
  user: Profile; action: ReactNode; onProfileChange: (profile: Profile) => void
}) {
  const profile = useResource<ProfileDetails>('/profile/details')
  const details = profile.data
  const student = user.role === 'student'

  return (
    <Section
      title="Профиль"
      text={student ? 'Тестовая учётная запись студента' : 'Тестовая учётная запись сотрудника'}
      action={action}
    >
      <section className={'panel ' + styles.identity} aria-labelledby="profile-name">
        <div className={styles.avatar} role="img" aria-label="Фото профиля не загружено">
          <UserRound aria-hidden="true" strokeWidth={1.25} />
        </div>
        <div className={styles.identityHeading}>
          <h2 id="profile-name" className={styles.name}>{details?.full_name || user.name}</h2>
          <DisplayNameEditor user={user} onProfileChange={onProfileChange} />
        </div>
        <div className={styles.contacts}>
          <h3>Контакты</h3>
          {profile.loading && <Busy text="Загружаем контакты…" />}
          {profile.error && <Problem text={profile.error} retry={profile.reload} />}
          {details && <ProfileFields fields={[
            ['Мобильный телефон', details.phone ?? 'Не указан'],
            ['Email', details.email ?? 'Не указан'],
            ['Подразделение', student ? null : user.faculty],
          ]} />}
        </div>
      </section>
      {student && (
        <section className={'panel ' + styles.study} aria-labelledby="profile-study">
          <h2 id="profile-study">Моё обучение</h2>
          <div className={styles.studyContent}>
            <div className={styles.studyInfo}>
              <h3>{user.faculty || 'Сведения об обучении'}</h3>
              <ProfileFields fields={[
                ['Направление', user.program],
                ['Профиль', details?.specialization],
                ['Уровень подготовки', details?.education_level],
                ['Форма обучения', details?.study_mode],
                ['Основа обучения', details?.study_basis],
              ]} />
            </div>
            {(user.year || user.group) && <div className={styles.enrollment}>
              {user.year && <strong>{user.year}-й курс</strong>}
              {user.group && <span>Группа {user.group}</span>}
            </div>}
          </div>
        </section>
      )}
    </Section>
  )
}

function DisplayNameEditor({ user, onProfileChange }: {
  user: Profile; onProfileChange: (profile: Profile) => void
}) {
  const name = user.display_name ?? user.name.split(' ')[0]
  const [draft, setDraft] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save(displayName: string | null) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const profile = await api<Profile>('/profile/display-name', {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName }),
      })
      onProfileChange(profile)
      setDraft(null)
      setSaved(true)
    } catch (error) {
      setError(errorText(error))
    } finally {
      setPending(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (draft?.trim()) void save(draft)
  }

  if (draft !== null) return <form className={'stack ' + styles.nameForm} onSubmit={submit}>
    <label>Имя в кабинете
      <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={40}
        autoComplete="nickname" autoFocus required disabled={pending} />
    </label>
    {error && <Problem text={error} />}
    <div className="button-group">
      <button className="button primary" disabled={pending || !draft.trim()}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>
      <button type="button" className="button secondary" disabled={pending} onClick={() => setDraft(null)}>Отмена</button>
    </div>
    {user.display_name && <button type="button" className="text-button" disabled={pending} onClick={() => void save(null)}>
      Вернуть исходное имя
    </button>}
  </form>

  return <div className={styles.displayName}>
    <p className="muted small">Имя в кабинете — {name}</p>
    <button type="button" className="text-button" onClick={() => { setSaved(false); setError(''); setDraft(name) }}>
      <Pencil size={16} aria-hidden="true" /> Изменить имя
    </button>
    {saved && <p role="status" className="small">Имя сохранено</p>}
  </div>
}

function ProfileFields({ fields }: { fields: [string, string | null | undefined][] }) {
  return <dl className="facts">
    {fields.filter(([, value]) => value != null).map(([label, value]) => (
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
    ))}
  </dl>
}
