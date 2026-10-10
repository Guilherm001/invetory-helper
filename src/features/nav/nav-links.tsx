'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Library } from 'lucide-react'

const LINKS = [
  { href: '/dashboard', label: 'Produtos' },
  { href: '/calculator', label: 'Calculadora' },
  { href: '/catalogo', label: 'Catálogo', icon: Library }
]

export function NavLinks({ className = '' }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={`flex ${className}`}>
      {LINKS.map(({ href, label }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? 'page' : undefined}
            className={`relative flex flex-1 items-center justify-center
              px-6 py-3 text-sm font-medium transition-colors duration-200
              md:py-4 md:text-base
              ${
                ativo
                  ? `text-[#079C9C]
                     after:absolute after:bottom-0 after:left-0
                     after:h-[3px] after:w-full
                     after:rounded-t-full after:bg-[#079C9C]`
                  : 'text-slate-500 hover:bg-slate-50 hover:text-[#079C9C]'
              }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}