'use client'

import { useEffect, useRef, useState } from 'react'
import { educationUniverseMarkup } from '../../campus-os-design-exploration/education-universe/markup.mjs'
import { Problem, Section } from './ui'

const catalogModule = '/education-universe/universe.mjs'

export function EducationCatalog() {
  const host = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const section = host.current?.querySelector('[data-education-universe]')
    if (!section) return
    let active = true
    let dispose: (() => void) | undefined
    void import(/* webpackIgnore: true */ /* turbopackIgnore: true */ catalogModule).then(module => {
      if (active) dispose = module.mountEducationUniverse(section)
    }).catch(() => {
      if (active) setUnavailable(true)
    })
    return () => { active = false; dispose?.() }
  }, [])

  return <Section title="Каталог">
    <link rel="stylesheet" href="/education-universe/universe.css" precedence="utret" />
    {unavailable
      ? <Problem text="Не удалось загрузить каталог." retry={() => window.location.reload()} />
      : <div className="account-catalog" ref={host} dangerouslySetInnerHTML={{ __html: educationUniverseMarkup }} />}
  </Section>
}
