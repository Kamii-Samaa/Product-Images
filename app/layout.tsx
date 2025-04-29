import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Product Images',
  description: 'Product Images',
  generator: 'Kamiii Samaaa',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
