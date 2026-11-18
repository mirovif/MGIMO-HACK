'use client'

import { useEffect } from 'react'

export function LegacyCabinetLink() {
  useEffect(() => {
    const { hash, search } = window.location
    if (hash === '#login') window.location.replace('/lks' + search)
    else if (hash.startsWith('#app/')) window.location.replace('/lks' + search + hash)
  }, [])

  return null
}
