'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { hrefAtivo, linksPorGrupo } from './links'

export function NavLinks({
  className = '',
  ehDono = false,
}: {
  className?: string
  ehDono?: boolean
}) {
  const pathname = usePathname()
  const grupos = linksPorGrupo(ehDono)
  const ativoHref = hrefAtivo(pathname, ehDono)

  return (
    <nav aria-label="Menu" className={`flex flex-col gap-5 ${className}`}>
      {grupos.map(({ id, label, links }) => (
        <div key={id} role="group" aria-label={label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>

          {links.map(({ href, label: texto, icon: Icon }) => {
            const ativo = href === ativoHref

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
                <span className="truncate">{texto}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}