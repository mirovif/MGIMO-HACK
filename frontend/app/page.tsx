import { ArrowDown, ArrowRight, CalendarDays, GraduationCap, MessageCircle, NotebookPen, Plus } from 'lucide-react'
import Link from 'next/link'
import { LegacyCabinetLink } from './legacy-cabinet-link'
import { SchedulePreview } from './schedule-preview'
import styles from './welcome.module.css'

const features = [
  { title: 'Расписание', icon: CalendarDays, description: 'Посмотрите пары на день или неделю, проверьте аудиторию и узнайте о переносах.' },
  { title: 'Успеваемость', icon: GraduationCap, description: 'Посмотрите оценки и зачёты по дисциплинам и узнайте даты предстоящих экзаменов.' },
  { title: 'Обращения', icon: NotebookPen, description: 'Закажите справку, сообщите о пропуске или задайте вопрос деканату. Ход рассмотрения и ответы сохраняются в истории.' },
  { title: 'ИИ-помощник', icon: MessageCircle, description: 'Спросите, как запросить пересдачу, найти аудиторию или проверить статус обращения. Ответы в прототипе демонстрационные.' },
]

export default function WelcomePage() {
  return (
    <div className={styles.landing}>
      <LegacyCabinetLink />
      <header className={styles.header}>
        <div className={styles.identity}>
          <strong>Campus <span>OS</span></strong>
          <span>РЭУ имени Г. В. Плеханова</span>
        </div>
        <Link href="/lks" prefetch={false} className={'button primary ' + styles.cabinetLink}>
          LKS <ArrowRight size={19} aria-hidden="true" />
        </Link>
      </header>
      <main>
        <section className={styles.hero} aria-labelledby="intro-title">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Цифровой деканат РЭУ</p>
            <h1 id="intro-title">Деканат <em>между<br /> парами.</em></h1>
            <p className={styles.description}>Расписание, оценки и связь с деканатом в одном кабинете.</p>
            <a href="#possibilities" className={styles.explore}>Посмотреть возможности <ArrowDown size={20} aria-hidden="true" /></a>
          </div>
          <SchedulePreview />
        </section>
        <section className={styles.features} id="possibilities" aria-labelledby="features-title">
          <h2 id="features-title">Возможности кабинета</h2>
          <div className={styles.featureGrid}>
            {features.map(({ title, icon: Icon, description }) => (
              <details className={styles.feature} key={title}>
                <summary>
                  <span className={styles.featureIcon}><Icon size={23} aria-hidden="true" /></span>
                  <strong>{title}</strong>
                  <Plus className={styles.featureToggle} size={22} aria-hidden="true" />
                </summary>
                <p>{description}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className={styles.footer}>Campus OS · Неофициальный конкурсный прототип</footer>
    </div>
  )
}
