import { AlertCircle, ArrowUpRight, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { statuses, type Profile, type Status } from './lib'

export function Busy({ text = 'Загружаем…' }: { text?: string }) {
  return <div className="feedback" role="status"><LoaderCircle className="spinner" size={20} />{text}</div>
}

export function Problem({ text, retry }: { text: string; retry?: () => void }) {
  return <div className="feedback problem" role="alert"><AlertCircle size={20} /><span>{text}</span>
    {retry && <button className="text-button" onClick={retry}>Повторить</button>}
  </div>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children && <div>{children}</div>}</div>
}

export function Section({ title, text, action, children, className }: { title: string; text?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={className ? 'section ' + className : 'section'}><header className="section-head"><div><h1>{title}</h1>{text && <p>{text}</p>}</div>{action}</header>{children}</section>
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={'badge status-' + status}>{statuses[status]}</span>
}

export function External({ href, children, className = 'text-link' }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}<ArrowUpRight size={16} aria-hidden="true" /></a>
}

export function ProfileFacts({ profile, showName = true }: {
  profile: Pick<Profile, 'name' | 'faculty' | 'program' | 'year' | 'group'>; showName?: boolean
}) {
  const fields = [['ФИО', showName ? profile.name : null], ['Факультет / школа', profile.faculty], ['Направление', profile.program], ['Курс', profile.year], ['Группа', profile.group]]
    .filter(([, value]) => value != null)
  if (!fields.length) return null
  return <dl className="facts">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
