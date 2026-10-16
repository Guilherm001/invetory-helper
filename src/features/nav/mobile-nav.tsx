'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Search, X } from 'lucide-react'
import { GRUPOS, hrefAtivo, linksVisiveis } from './links'

// quantos atalhos cabem na barra de baixo, sem contar o "Mais"
const MAX_BARRA = 4
// quanto precisa arrastar a gaveta para baixo para ela fechar
const ARRASTO_FECHAR = 90
// a busca só aparece quando o menu tem coisa suficiente para procurar
const MIN_LINKS_BUSCA = 6

// sem acento, minúsculo
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function MobileNav({
  logout,
  ehDono = false,
  nome = '',
}: {
  logout: React.ReactNode
  ehDono?: boolean
  nome?: string
}) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [arrasto, setArrasto] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const inicioY = useRef<number | null>(null)

  const links = linksVisiveis(ehDono)

  const principais = links
    .filter((l) => l.principal)
    .sort((a, b) => (a.ordemBarra ?? 99) - (b.ordemBarra ?? 99))
    .slice(0, MAX_BARRA)
  const secundarios = links.filter((l) => !principais.includes(l))

  // só o link mais específico fica marcado
  const ativoHref = hrefAtivo(pathname, ehDono)
  const maisAtivo = secundarios.some((l) => l.href === ativoHref)

  // procurando, vale o menu inteiro (vira um "ir para" rápido); senão, só o que está no "Mais"
  const termo = normalizar(busca.trim())
  const base = termo ? links : secundarios
  const grupos = GRUPOS.map((g) => ({
    ...g,
    links: base.filter(
      (l) =>
        l.grupo === g.id && (!termo || normalizar(`${l.label} ${l.curto ?? ''}`).includes(termo))
    ),
  })).filter((g) => g.links.length > 0)

  const fechar = () => {
    setAberto(false)
    setBusca('')
    setArrasto(0)
    setArrastando(false)
    inicioY.current = null
  }

  // Esc fecha a gaveta
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  // arrastar a gaveta para baixo fecha (puxador e título)
  const iniciarArrasto = (e: React.PointerEvent<HTMLDivElement>) => {
    inicioY.current = e.clientY
    setArrastando(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const moverArrasto = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inicioY.current === null) return
    setArrasto(Math.max(0, e.clientY - inicioY.current))
  }
  const soltarArrasto = () => {
    if (inicioY.current === null) return
    const passou = arrasto > ARRASTO_FECHAR
    inicioY.current = null
    setArrastando(false)
    if (passou) fechar()
    else setArrasto(0)
  }

  const itemClass = (ativo: boolean) =>
    `relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:bg-slate-50 ${
      ativo ? 'text-[#079C9C]' : 'text-slate-500'
    }`

  const inicial = nome.trim().charAt(0).toUpperCase()
  const mostrarBusca = links.length > MIN_LINKS_BUSCA

  return (
    <>
      {/* Barra de baixo */}
      <nav
        aria-label="Menu principal"
        className="z-30 shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${principais.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {principais.map(({ href, label, curto, icon: Icon }) => {
            const ativo = href === ativoHref
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
                <span className="max-w-full truncate px-1">{curto ?? label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={aberto}
            aria-label={maisAtivo ? 'Mais opções (você está em uma delas)' : 'Mais opções'}
            className={itemClass(maisAtivo || aberto)}
          >
            {(maisAtivo || aberto) && (
              <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[#079C9C]" />
            )}
            <span className="relative">
              <LayoutGrid className="size-6" strokeWidth={maisAtivo || aberto ? 2.4 : 1.8} />
              {maisAtivo && (
                <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-[#079C9C] ring-2 ring-white" />
              )}
            </span>
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
          onClick={fechar}
          style={{ opacity: aberto ? Math.max(0, 1 - arrasto / 320) : 0 }}
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] motion-reduce:transition-none ${
            arrastando ? '' : 'transition-opacity duration-300'
          }`}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mais opções"
          style={{ transform: aberto ? `translateY(${arrasto}px)` : 'translateY(100%)' }}
          className={`absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl motion-reduce:transition-none ${
            arrastando ? '' : 'transition-transform duration-300 ease-out'
          }`}
        >
          {/* puxador + cabeçalho: dá para arrastar para fechar */}
          <div
            onPointerDown={iniciarArrasto}
            onPointerMove={moverArrasto}
            onPointerUp={soltarArrasto}
            onPointerCancel={soltarArrasto}
            className="shrink-0 cursor-grab touch-none select-none px-5 pb-2 pt-3"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />

            <div className="flex items-center gap-3">
              {inicial && (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#079C9C] text-base font-bold text-white">
                  {inicial}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-slate-900">
                  {nome ? `Olá, ${nome}` : 'Menu'}
                </p>
                <p className="text-xs text-slate-500">Para onde vamos?</p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={fechar}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90 active:bg-slate-200"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* busca */}
          {mostrarBusca && (
            <div className="shrink-0 px-5 pb-2 pt-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Buscar no menu"
                  aria-label="Buscar no menu"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-base outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:bg-white focus:ring-2 focus:ring-[#079C9C]/20"
                />
                {busca && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => setBusca('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 active:bg-slate-100"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* atalhos em blocos, agrupados */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
            {grupos.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Nada encontrado para &ldquo;{busca.trim()}&rdquo;.
              </p>
            ) : (
              grupos.map(({ id, label, links: itens }) => (
                <div key={id} role="group" aria-label={label} className="mb-3">
                  <p className="pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {itens.map(({ href, label: texto, icon: Icon }) => {
                      const ativo = href === ativoHref
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={fechar}
                            aria-current={ativo ? 'page' : undefined}
                            className={`flex h-full flex-col items-center gap-2 rounded-2xl border p-3 text-center transition active:scale-95 ${
                              ativo
                                ? 'border-[#079C9C]/30 bg-[#079C9C]/10 text-[#079C9C]'
                                : 'border-transparent bg-slate-50 text-slate-700 active:bg-slate-100'
                            }`}
                          >
                            <span
                              className={`flex size-11 items-center justify-center rounded-xl ${
                                ativo
                                  ? 'bg-[#079C9C] text-white'
                                  : 'bg-white text-[#079C9C] shadow-sm'
                              }`}
                            >
                              <Icon className="size-5" />
                            </span>
                            <span className="text-[12px] font-medium leading-tight">{texto}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* conta */}
          <div className="shrink-0 border-t border-slate-100 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
            <div className="[&>*]:w-full">{logout}</div>
          </div>
        </div>
      </div>
    </>
  )
}
