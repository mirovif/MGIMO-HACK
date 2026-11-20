'use client'

import { useCallback, useEffect, useState } from 'react'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch('/api' + path, { ...init, headers, cache: 'no-store', credentials: 'same-origin' })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    throw new ApiError(0, 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 && path !== '/auth/login' && path !== '/profile') {
      window.dispatchEvent(new Event('campus-session-expired'))
    }
    const message = typeof data.detail === 'string' ? data.detail
      : response.status === 422 ? 'Проверьте заполненные поля.'
      : 'Сервис временно недоступен. Попробуйте ещё раз.'
    throw new ApiError(response.status, message)
  }
  return response.status === 204 ? undefined as T : response.json()
}

export function useResource<T>(url: string | null) {
  const [state, setState] = useState<{ url: string; data?: T; error?: string }>()
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => { setState(undefined); setVersion(value => value + 1) }, [])
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    api<T>(url, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ url, data })
    }).catch(err => {
      if (!controller.signal.aborted) setState({ url, error: errorText(err) })
    })
    return () => controller.abort()
  }, [url, version])
  const active = url && state?.url === url ? state : undefined
  return { data: active?.data, error: active?.error, loading: !!url && !active, reload }
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Что-то пошло не так. Попробуйте ещё раз.'
}

export type Profile = {
  id: number; login: string; name: string; role: 'student' | 'staff'
  display_name?: string | null
  faculty: string | null; program: string | null; year: number | null; group: string | null
}
export type Lesson = {
  id: string; date: string; start: string; end: string; subject: string
  kind: string; teacher: string | null; room: string | null; change: string | null
}
export type Schedule = { source: 'demo' | 'rea'; start: string; end: string; group: string; lessons: Lesson[] }
export type Grade = { subject: string; kind: string; result: string | null; exam_date: string | null }
export type Notice = {
  id: number; kind: 'request' | 'schedule' | 'announcement'; title: string; message: string
  request_id: string | null; created_at: string; read_at: string | null
}
export const scenarioNames = { illness: 'Я заболел', retake: 'Мне нужна пересдача', certificate: 'Мне нужна справка', other: 'Не знаю, куда обратиться' }
export const statuses = { submitted: 'Получено', review: 'На рассмотрении', clarification: 'Нужно уточнение', resolved: 'Решено', rejected: 'Отклонено' }
export const certificates = { study: 'Справка об обучении', scholarship: 'Справка о стипендии', session: 'Справка о результатах сессии' }
export const caseCategories = { study: 'Учёба', documents: 'Документы', campus: 'Кампус', other: 'Другое' }
export type Scenario = keyof typeof scenarioNames
export type Status = keyof typeof statuses
export type CaseSummary = {
  id: string; number: string; student: string; scenario: Scenario; status: Status
  version: number; created_at: string; updated_at: string
}
export type CaseDetail = CaseSummary & {
  attachment: string | null
  details: { comment?: string; start_date?: string; end_date?: string; missed_lessons?: Lesson[]; subject?: string
    certificate_type?: keyof typeof certificates; category?: keyof typeof caseCategories; profile?: Profile }
  history: { id: number; actor: string; role: Profile['role']; status: Status; action: string; message: string | null; created_at: string }[]
}

export function moscowToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function shiftDate(date: string, offset: number) {
  const value = new Date(date + 'T12:00:00Z')
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}
export function formatDate(date: string, weekday = false) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: weekday ? 'long' : undefined, timeZone: 'Europe/Moscow' })
    .format(new Date(date.length === 10 ? date + 'T12:00:00Z' : date))
}
export function formatTime(date: string) {
  return formatDate(date) + ' · ' + new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(date))
}
