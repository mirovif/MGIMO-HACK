'use client'

import { UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useResource, type Profile } from './lib'
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

export function AccountProfile({ user, action }: { user: Profile; action: ReactNode }) {
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
        <h2 id="profile-name" className={styles.name}>{details?.full_name || user.name}</h2>
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

function ProfileFields({ fields }: { fields: [string, string | null | undefined][] }) {
  return <dl className="facts">
    {fields.filter(([, value]) => value != null).map(([label, value]) => (
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
    ))}
  </dl>
}
