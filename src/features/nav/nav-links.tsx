'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calculator, Library, Package, Scale } from 'lucide-react'

const LINKS = [
  { href: '/dashboard', label: 'Produtos', icon: Package },
  { href: '/comparar-precos', label: 'Comparar preços', icon: Scale },
  { href: '/catalogo', label: 'Catálogo', icon: Library },
  { href: '/calculator', label: 'Calculadora', icon: Calculator },
]

export function NavLinks({ className = '' }: { className?: string }) {
  const pathname = usePathname()

  // na sidebar o layout passa flex-col: links empilhados com ícone
  const vertical = className.includes('flex-col')

  return (
    <nav className={`flex ${className}`}>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const ativo = pathname === href || pathname.startsWith(`${href}/`)

        if (vertical) {
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                ativo
                  ? 'bg-[#079C9C]/10 text-[#079C9C]'
                  : 'text-slate-600 hover:bg-white hover:text-[#079C9C]'
              }`}
            >
              {ativo && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#079C9C]" />
              )}
              <Icon className="size-[18px] shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          )
        }

        // abas do celular (como antes)
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? 'page' : undefined}
            className={`relative flex flex-1 items-center justify-center
              px-3 py-3 text-sm font-medium transition-colors duration-200
              md:px-6 md:py-4 md:text-base
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