import type { Metadata } from 'next'
import './style.css'

export const metadata: Metadata = {
  title: 'Личный кабинет UTRET',
  description: 'Неофициальный конкурсный прототип цифрового деканата РЭУ имени Г. В. Плеханова.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><head>
    <link rel="stylesheet" href="/fonts.css" />
    <link rel="stylesheet" href="/utret-theme.css" />
  </head><body>{children}</body></html>
}
