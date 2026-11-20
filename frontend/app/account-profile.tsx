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

type ProfileDraft = Record<'display_name' | 'full_name' | 'phone' | 'email', string>

export function AccountProfile({ user, action, onProfileChange }: {
  user: Profile; action: ReactNode; onProfileChange: (profile: Profile) => void
}) {
  const profile = useResource<ProfileDetails>('/profile/details')
  const [savedDetails, setSavedDetails] = useState<ProfileDetails>()
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const details = savedDetails ?? profile.data
  const student = user.role === 'student'
  const defaultName = user.name.split(' ')[0]
  const fullName = details?.full_name || user.name

  function edit() {
    setError('')
    setDraft({
      display_name: user.display_name ?? '',
      full_name: fullName,
      phone: details?.phone ?? '',
      email: details?.email ?? '',
    })
  }

  function change(field: keyof ProfileDraft, value: string) {
    setDraft(current => current && { ...current, [field]: value })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || pending) return
    setPending(true)
    setError('')
    try {
      const saved = await api<{ profile: Profile; details: ProfileDetails }>('/profile/details', {
        method: 'PUT',
        body: JSON.stringify({ ...draft, display_name: draft.display_name.trim() || null }),
      })
      setSavedDetails(saved.details)
      onProfileChange(saved.profile)
      setDraft(null)
    } catch (error) {
      setError(errorText(error))
    } finally {
      setPending(false)
    }
  }

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
          <h2 id="profile-name" className={styles.name}>{fullName}</h2>
          <p className={styles.displayName + ' muted small'}>Имя в кабинете — {user.display_name ?? defaultName}</p>
          {details && !draft && <div>
            <button type="button" className="text-button" onClick={edit}>
              <Pencil size={16} aria-hidden="true" /> Редактировать профиль
            </button>
          </div>}
        </div>
        {draft ? <form className={'stack ' + styles.editForm} onSubmit={save} aria-label="Редактирование профиля">
          <div className={styles.editFields}>
            <label>Имя в кабинете
              <input value={draft.display_name} onChange={event => change('display_name', event.target.value)}
                maxLength={40} autoComplete="nickname" autoFocus placeholder={defaultName} disabled={pending} />
            </label>
            <label>ФИО
              <input value={draft.full_name} onChange={event => change('full_name', event.target.value)}
                maxLength={160} autoComplete="name" required disabled={pending} />
            </label>
            <label>Мобильный телефон
              <input type="tel" value={draft.phone} onChange={event => change('phone', event.target.value)}
                maxLength={32} autoComplete="tel" disabled={pending} />
            </label>
            <label>Email
              <input type="email" value={draft.email} onChange={event => change('email', event.target.value)}
                maxLength={254} autoComplete="email" disabled={pending} />
            </label>
          </div>
          {error && <Problem text={error} />}
          <div className="button-group">
            <button className="button primary" disabled={pending || !draft.full_name.trim()}>
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button type="button" className="button secondary" disabled={pending} onClick={() => setDraft(null)}>Отмена</button>
          </div>
        </form> : <div className={styles.contacts}>
          {savedDetails && <p role="status" className="small">Профиль сохранён</p>}
          <h3>Контакты</h3>
          {profile.loading && <Busy text="Загружаем контакты…" />}
          {profile.error && <Problem text={profile.error} retry={profile.reload} />}
          {details && <ProfileFields fields={[
            ['Мобильный телефон', details.phone ?? 'Не указан'],
            ['Email', details.email ?? 'Не указан'],
            ['Подразделение', student ? null : user.faculty],
          ]} />}
        </div>}
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

function ProfileFields({ fields }: { fields: [string, string | null | undefined][] }) {
  return <dl className="facts">
    {fields.filter(([, value]) => value != null).map(([label, value]) => (
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
    ))}
  </dl>
}
