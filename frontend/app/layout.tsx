import type { Metadata } from 'next'
import './style.css'

export const metadata: Metadata = {
  title: 'Campus OS — Цифровой деканат',
  description: 'Неофициальный конкурсный прототип цифрового деканата РЭУ имени Г. В. Плеханова.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>
}
