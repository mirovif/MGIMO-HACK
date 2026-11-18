'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError, errorText, type Profile } from '../lib'
import { Busy, Problem } from '../ui'
import { Workspace } from '../workspace'

export default function LksPage() {
  const router = useRouter()
  const [user, setUser] = useState<Profile | null>()
  const [route, setRoute] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const sync = () => {
      setRoute(window.location.hash.slice(1))
      window.scrollTo(0, 0)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    api<Profile>('/profile', { signal: controller.signal }).then(profile => {
      if (!controller.signal.aborted) setUser(profile)
    }).catch(err => {
      if (controller.signal.aborted) return
      if (err instanceof ApiError && err.status === 401) setUser(null)
      else setError(errorText(err))
    })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    function expired() { setUser(null) }
    window.addEventListener('campus-session-expired', expired)
    return () => window.removeEventListener('campus-session-expired', expired)
  }, [])

  if (user) return <Workspace key={user.id} user={user} route={route} onLogout={() => {
    setUser(null)
    router.replace('/')
  }} />

  if (user === undefined) return (
    <main className="lks-session">
      {error ? <Problem text={error} retry={() => { setError(''); setAttempt(value => value + 1) }} />
        : <Busy text="Проверяем сеанс…" />}
    </main>
  )

  return <Login onLogin={setUser} />
}

function Login({ onLogin }: { onLogin: (profile: Profile) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (loading) return
    setError(''); setLoading(true)
    try { onLogin(await api<Profile>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) })) }
    catch (err) { setError(errorText(err)) }
    finally { setLoading(false) }
  }
  return <main className="login-layout">
    <aside className="login-brand"><Link href="/" className="brand-inverse">Campus OS</Link><p>Деканат<br /><em>между парами.</em></p><span>РЭУ имени Г. В. Плеханова</span></aside>
    <div className="login-main"><Link href="/" className="text-link">На главную</Link>
      <h1>Войти в кабинет</h1><p>Используйте конкурсную учётную запись.</p>
      <form className="stack" onSubmit={submit}>
        <label>Логин<input autoComplete="username" value={login} onChange={event => setLogin(event.target.value)} required maxLength={64} /></label>
        <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={128} /></label>
        {error && <Problem text={error} />}
        <button className="button primary" disabled={loading}>{loading ? 'Входим…' : 'Войти'}</button>
        {loading && <div className="visually-hidden"><Busy text="Проверяем данные" /></div>}
      </form>
      <div className="demo-logins"><strong>Тестовые логины</strong><div>
        <button type="button" onClick={() => setLogin('student1')}>Студент 1</button>
        <button type="button" onClick={() => setLogin('student2')}>Студент 2</button>
        <button type="button" onClick={() => setLogin('staff')}>Сотрудник</button>
      </div><p>Пароль организатор выдаёт отдельно. Для локального запуска он указан в README.</p></div>
      <small>Неофициальный конкурсный прототип</small>
    </div>
  </main>
}
