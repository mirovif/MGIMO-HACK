'use client'

import { useEffect, useRef, useState } from 'react'
import { educationUniverseTitle, renderEducationUniverse } from '../../campus-os-design-exploration/education-universe/markup.mjs'
import { Problem, Section } from './ui'

export { educationUniverseTitle }

const catalogModule = '/education-universe/universe.mjs'
const cabinetUniverseMarkup = renderEducationUniverse({ embedded: true })

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

  return <Section title={educationUniverseTitle}>
    <link rel="stylesheet" href="/education-universe/universe.css" precedence="utret" />
    {unavailable
      ? <Problem text="Не удалось загрузить образовательную вселенную." retry={() => window.location.reload()} />
      : <div className="account-catalog" ref={host} dangerouslySetInnerHTML={{ __html: cabinetUniverseMarkup }} />}
  </Section>
}
