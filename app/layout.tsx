import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Daily Report Builder',
  description:
    'Formulaire Next.js pour structurer les rapports quotidiens du chantier Bondoukou - Bouna.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-slate-100 text-slate-900`}>{children}</body>
    </html>
  )
}
