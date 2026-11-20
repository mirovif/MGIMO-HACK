'use client'

import { MessageCircle, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, errorText, type Profile } from './lib'
import { Busy, External, Problem, Section } from './ui'

type Turn = { role: 'user' | 'assistant'; content: string; demo?: boolean; sources?: { url: string; title: string; excerpt: string }[] }
type Answer = { message: string; demo: boolean; sources: NonNullable<Turn['sources']> }
const prompts = ['Как получить справку?', 'Как запросить пересдачу?', 'Где посмотреть расписание?']

export function AssistantPage({ user }: { user: Profile }) {
  const storageKey = 'campus-chat-' + user.id
  const [turns, setTurns] = useState<Turn[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const running = useRef(false)

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(turns.slice(-30))) } catch {}
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [turns, storageKey, pending])

  async function send(text: string) {
    const content = text.trim()
    if (!content || running.current) return
    running.current = true
    setPending(true); setError(''); setInput('')
    const conversation: Turn[] = [...turns, { role: 'user', content }]
    setTurns(conversation)
    try {
      const answer = await api<Answer>('/assistant/messages', { method: 'POST', body: JSON.stringify({
        message: content, history: turns.slice(-12).map(turn => ({ role: turn.role, content: turn.content.slice(0, 2000) })),
      }) })
      setTurns([...conversation, { role: 'assistant', content: answer.message, demo: answer.demo, sources: answer.sources }])
    } catch (err) { setTurns(turns); setInput(content); setError(errorText(err)) }
    finally { setPending(false); running.current = false }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(input) }

  return <Section title="Комета" text="Помощник по расписанию, справкам и вопросам деканата.">
    <div className="panel chat">
      <div className="chat-log" role="log" aria-label="История чата" ref={log}>
        {!turns.length && <div className="chat-intro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="chat-mascot" src="/assets/kameta.webp" alt="" width={1122} height={1402} />
          <div><h2>Чем помочь?</h2><p>К ответам по материалам РЭУ прикрепляю источник.</p></div>
          <div className="button-group">{prompts.map(prompt => <button type="button" key={prompt} className="button secondary" onClick={() => void send(prompt)}>{prompt}</button>)}</div>
        </div>}
        {turns.map((turn, index) => <article className={'chat-turn ' + turn.role} key={index}>
          <div className="chat-author"><strong>{turn.role === 'user' ? 'Вы' : 'Комета'}</strong>{turn.demo && !turn.sources?.length && <span className="badge">Демонстрационный ответ</span>}</div>
          <p className="pre-line">{turn.content}</p>
          {!!turn.sources?.length && <div className="chat-sources"><strong>Источники</strong>{turn.sources.map(source => <div key={source.url}>
            <External href={source.url}>{source.title}</External><p className="muted small">{source.excerpt}</p></div>)}</div>}
        </article>)}
        {pending && <Busy text="Готовим ответ…" />}
      </div>
      {error && <Problem text={error} />}
      <form className="chat-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="question">Ваш вопрос</label>
        <textarea id="question" value={input} onChange={event => setInput(event.target.value)} placeholder="Напишите ваш вопрос" rows={2} maxLength={2000} />
        <button className="button primary" aria-label="Отправить сообщение" disabled={pending || !input.trim()}><Send size={20} /></button>
      </form>
    </div>
    <p className="muted small icon-text"><MessageCircle size={15} /> Официальные правила сверяйте с документами РЭУ.</p>
  </Section>
}
