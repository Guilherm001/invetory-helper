'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { LINKS, estaAtivo } from './links'

const principais = LINKS.filter((l) => l.principal)
const secundarios = LINKS.filter((l) => !l.principal)

export function MobileNav({ logout }: { logout: React.ReactNode }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  // Esc fecha a gaveta
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  // "Mais" fica destacado quando a página atual está dentro dele
  const maisAtivo = secundarios.some((l) => estaAtivo(pathname, l.href))

  const itemClass = (ativo: boolean) =>
    `relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:bg-slate-50 ${
      ativo ? 'text-[#079C9C]' : 'text-slate-500'
    }`

  return (
    <>
      {/* Barra de baixo */}
      <nav
        aria-label="Menu principal"
        className="z-30 shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5">
          {principais.map(({ href, label, curto, icon: Icon }) => {
            const ativo = estaAtivo(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={ativo ? 'page' : undefined}
                className={itemClass(ativo)}
              >
                {ativo && (
                  <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[#079C9C]" />
                )}
                <Icon className="size-6" strokeWidth={ativo ? 2.4 : 1.8} />
                <span>{curto ?? label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={aberto}
            className={itemClass(maisAtivo)}
          >
            {maisAtivo && (
              <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[#079C9C]" />
            )}
            <Menu className="size-6" strokeWidth={maisAtivo ? 2.4 : 1.8} />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {/* Gaveta "Mais" */}
      <div
        className={`fixed inset-0 z-50 transition-[visibility] duration-300 md:hidden ${
          aberto ? 'visible' : 'invisible'
        }`}
        aria-hidden={!aberto}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Fechar"
          onClick={() => setAberto(false)}
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${
            aberto ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mais opções"
          className={`absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-300 ease-out ${
            aberto ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />

          <div className="mb-2 flex items-center justify-between">
            <p className="text-base font-bold text-slate-900">Mais opções</p>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setAberto(false)}
              className="rounded-lg p-2 text-slate-400 active:bg-slate-100"
            >
              <X className="size-5" />
            </button>
          </div>

          {secundarios.length > 0 && (
            <ul className="space-y-1">
              {secundarios.map(({ href, label, icon: Icon }) => {
                const ativo = estaAtivo(pathname, href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setAberto(false)}
                      aria-current={ativo ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3.5 text-base font-medium transition active:scale-[0.98] ${
                        ativo
                          ? 'bg-[#079C9C]/10 text-[#079C9C]'
                          : 'text-slate-700 active:bg-slate-50'
                      }`}
                    >
                      <Icon className="size-5 shrink-0" />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Conta
            </p>
            <div className="px-3 [&>*]:w-full">{logout}</div>
          </div>
        </div>
      </div>
    </>
  )
}