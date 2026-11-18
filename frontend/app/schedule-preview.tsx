'use client'

import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import styles from './welcome.module.css'

const schedule = {
  day: [
    { time: '10:40', subject: 'Микроэкономика', detail: 'Корпус 1 · 305' },
    { time: '12:20', subject: 'Иностранный язык', detail: 'Корпус 3 · 412' },
  ],
  week: [
    { time: '10:40', subject: 'Микроэкономика', detail: 'Понедельник' },
    { time: '12:20', subject: 'Иностранный язык', detail: 'Среда' },
    { time: '14:00', subject: 'Статистика', detail: 'Пятница' },
  ],
}

export function SchedulePreview() {
  const [period, setPeriod] = useState<'day' | 'week'>('day')

  return (
    <section className={styles.preview} aria-labelledby="preview-title">
      <p className={styles.previewCaption}>Пример личного кабинета</p>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <h2 id="preview-title" aria-live="polite">{period === 'day' ? 'Твой день' : 'Твоя неделя'}</h2>
          <div className={styles.previewSwitch} role="group" aria-label="Период расписания">
            <button type="button" aria-pressed={period === 'day'} onClick={() => setPeriod('day')}>День</button>
            <button type="button" aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Неделя</button>
          </div>
        </div>
        <div className={styles.agenda}>
          <h3>Расписание</h3>
          <ul>
            {schedule[period].map(({ time, subject, detail }) => (
              <li key={time}>
                <time dateTime={time}>{time}</time>
                <span>{subject}</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.previewRequest}>
          <ClipboardList size={26} aria-hidden="true" />
          <div>
            <strong>Справка об обучении</strong>
            <span>На рассмотрении</span>
          </div>
        </div>
      </div>
    </section>
  )
}
