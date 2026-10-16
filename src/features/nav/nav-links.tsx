'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { hrefAtivo, linksPorGrupo, type GrupoId } from './links'

// guarda quais seções a pessoa deixou fechadas
const CHAVE = 'menu-grupos-fechados'

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
  const [fechados, setFechados] = useState<GrupoId[]>([])

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE)
      if (!salvo) return
      const lista = JSON.parse(salvo)
      if (Array.isArray(lista)) setFechados(lista)
    } catch {
      // sem armazenamento: o menu simplesmente começa aberto
    }
  }, [])

  const alternar = (id: GrupoId) => {
    const novo = fechados.includes(id) ? fechados.filter((g) => g !== id) : [...fechados, id]
    setFechados(novo)
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo))
    } catch {
      // ignora
    }
  }

  return (
    <nav aria-label="Menu" className={`flex flex-col gap-1 ${className}`}>
      {grupos.map(({ id, label, links }) => {
        const temAtivo = links.some((l) => l.href === ativoHref)
        // a seção da página atual nunca fica escondida
        const aberto = temAtivo || !fechados.includes(id)
        const painelId = `menu-grupo-${id}`

        return (
          <div key={id} role="group" aria-label={label} className="py-0.5">
            <button
              type="button"
              onClick={() => alternar(id)}
              aria-expanded={aberto}
              aria-controls={painelId}
              disabled={temAtivo}
              className="group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 transition-colors enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:cursor-default"
            >
              <span>{label}</span>
              <span className="flex items-center gap-1.5">
                {!aberto && (
                  <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-500">
                    {links.length}
                  </span>
                )}
                {!temAtivo && (
                  <ChevronDown
                    className={`size-3.5 transition-transform duration-200 ${
                      aberto ? '' : '-rotate-90'
                    }`}
                  />
                )}
              </span>
            </button>

            <div
              id={painelId}
              className={`grid transition-[grid-template-rows,visibility] duration-200 motion-reduce:transition-none ${
                aberto ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
              }`}
            >
              <ul className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                {links.map(({ href, label: texto, icon: Icon }) => {
                  const ativo = href === ativoHref

                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={ativo ? 'page' : undefined}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
