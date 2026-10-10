'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LINKS, estaAtivo } from './links'

export function NavLinks({ className = '' }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Menu" className={`flex flex-col items-stretch gap-1 ${className}`}>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const ativo = estaAtivo(pathname, href)

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
      })}
    </nav>
  )
}