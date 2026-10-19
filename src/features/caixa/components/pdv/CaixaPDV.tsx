'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  LayoutDashboard,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Receipt,
  Undo2,
  Wallet,
} from 'lucide-react'
import { useCaixa } from '../../hooks/useCaixa'
import { relatorioDaSessao, sessoesRecentes } from '../../services/caixaService'
import type { Relatorio, ResultadoFechamento, SessaoResumo } from '../../types'
import type { Forma } from '../../lib/calculos'
import { dataHora, reais } from '../../lib/formatar'
import AbrirCaixa from '../AbrirCaixa'
import DevolucaoDialog from '../DevolucaoDialog'
import FecharCaixaDialog from '../FecharCaixaDialog'
import MovimentoDialog from '../MovimentoDialog'
import ReceberPendenciaDialog from '../ReceberPendenciaDialog'
import RelatorioDialog from '../RelatorioCaixa'
import ListaPDV from './ListaPDV'
import PainelPDV from './PainelPDV'
import PedidoFechadoPDV from './PedidoFechadoPDV'

type Relatorio_ = { rel: Relatorio; parcial: boolean }

// o Chrome reserva o Esc para sair da tela cheia; o bloqueio de teclado entrega o Esc ao caixa
type TecladoNav = { lock?: (teclas: string[]) => Promise<void>; unlock?: () => void }

function travarEsc(travar: boolean) {
  const kb = (navigator as Navigator & { keyboard?: TecladoNav }).keyboard
  if (!kb) return
  if (travar) kb.lock?.(['Escape']).catch(() => {})
  else kb.unlock?.()
}

function BtnBarra({
  onClick,
  disabled,
  children,
  forte = false,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  forte?: boolean
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium outline-none transition disabled:opacity-50 ${
        forte
          ? 'border-slate-600 bg-slate-100 text-slate-900 hover:bg-white'
          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function SessoesRecentes({ onVer }: { onVer: (id: string) => void }) {
  const [lista, setLista] = useState<SessaoResumo[] | null>(null)

  useEffect(() => {
    let cancelado = false
    sessoesRecentes()
      .then((l) => {
        if (!cancelado) setLista(l)
      })
      .catch(() => {
        if (!cancelado) setLista([])
      })
    return () => {
      cancelado = true
    }
  }, [])

  if (!lista || lista.length === 0) return null

  return (
    <section className="mx-auto mt-8 w-full max-w-md space-y-2">
      <h4 className="text-xs uppercase tracking-widest text-slate-500">Últimos caixas</h4>
      <ul className="space-y-2">
        {lista.slice(0, 8).map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900 px-3 py-2.5"
          >
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-100">{dataHora(s.aberto_em)}</p>
              <p className="text-xs text-slate-400">
                {s.aberto_por}
                {s.liquido !== null ? ` · ${reais(s.liquido)}` : ''}
                {s.diferenca !== null && s.diferenca !== 0
                  ? ` · ${s.diferenca > 0 ? 'sobra' : 'falta'} ${reais(Math.abs(s.diferenca))}`
                  : ''}
              </p>
            </div>
            <BtnBarra onClick={() => onVer(s.id)}>
              <FileText className="size-4" />
              Relatório
            </BtnBarra>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function CaixaPDV({ onTrocarLayout }: { onTrocarLayout?: () => void }) {
  const c = useCaixa()

  const [ampliado, setAmpliado] = useState(true)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoFechamento | null>(null)
  const [busca, setBusca] = useState('')
  const [foco, setFoco] = useState(0)
  const [ultimaForma, setUltimaForma] = useState<Forma>('dinheiro')
  const [movimento, setMovimento] = useState<'sangria' | 'suprimento' | null>(null)
  const [pendenciaAberta, setPendenciaAberta] = useState(false)
  const [devolucaoAberta, setDevolucaoAberta] = useState(false)
  const [fechandoCaixa, setFechandoCaixa] = useState(false)
  const [relatorio, setRelatorio] = useState<Relatorio_ | null>(null)
  const [carregandoRel, setCarregandoRel] = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  const algumaJanela =
    movimento !== null || pendenciaAberta || devolucaoAberta || fechandoCaixa || relatorio !== null

  // a página de trás não rola enquanto o caixa cobre a tela
  useEffect(() => {
    if (!ampliado) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [ampliado])

  // sair da tela cheia do navegador desfaz a ampliação
  useEffect(() => {
    const aoMudar = () => {
      if (!document.fullscreenElement) setAmpliado(false)
    }
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  // chegou já em tela cheia (vindo do layout clássico): trava o Esc também
  useEffect(() => {
    if (document.fullscreenElement) travarEsc(true)
    return () => travarEsc(false)
  }, [])

  // o pedido aberto ou a tela de "fechado" ficam com o teclado: tira o cursor da busca
  useEffect(() => {
    if (selecionado || resultado) (document.activeElement as HTMLElement | null)?.blur?.()
  }, [selecionado, resultado])

  // voltou para a lista (ou fechou uma janela): o cursor volta para a busca
  useEffect(() => {
    if (!algumaJanela && !selecionado && !resultado) setFoco((f) => f + 1)
  }, [algumaJanela, selecionado, resultado])

  const alternarTelaCheia = async () => {
    if (!ampliado) {
      setAmpliado(true)
      try {
        await document.documentElement.requestFullscreen?.()
        travarEsc(true)
      } catch {
        /* sem tela cheia do navegador */
      }
    } else {
      travarEsc(false)
      setAmpliado(false)
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen()
        } catch {
          /* já saiu */
        }
      }
    }
  }

  const verRelatorio = async (id: string, parcial: boolean) => {
    setCarregandoRel(true)
    setErroAcao('')
    try {
      setRelatorio({ rel: await relatorioDaSessao(id), parcial })
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível abrir o relatório')
    } finally {
      setCarregandoRel(false)
    }
  }

  const proximo = () => {
    setResultado(null)
    setSelecionado(null)
    setBusca('')
  }

  const estado = c.estado

  return (
    <div
      className={
        ampliado
          ? 'fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100'
          : 'flex min-h-[80dvh] flex-col rounded-xl bg-slate-950 text-slate-100'
      }
    >
      {/* barra do terminal */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-100">Caixa</span>

          {estado?.aberto ? (
            <>
              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500" />
                ABERTO
              </span>
              <span className="text-sm text-slate-400">
                {estado.resumo.sessao.aberto_por} · desde {dataHora(estado.resumo.sessao.aberto_em)}
              </span>
              <span className="font-mono text-sm tabular-nums text-slate-200">
                {estado.resumo.vendas.quantidade} pedidos · {reais(estado.resumo.vendas.liquido)}
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-500">FECHADO</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {estado?.aberto && (
            <>
              <BtnBarra onClick={() => setMovimento('sangria')}>
                <ArrowUpFromLine className="size-4" />
                Sangria
              </BtnBarra>
              <BtnBarra onClick={() => setMovimento('suprimento')}>
                <ArrowDownToLine className="size-4" />
                Suprimento
              </BtnBarra>
              <BtnBarra onClick={() => setPendenciaAberta(true)}>
                <Wallet className="size-4" />
                Pendência
              </BtnBarra>
              <BtnBarra onClick={() => setDevolucaoAberta(true)}>
                <Undo2 className="size-4" />
                Devolução
              </BtnBarra>
              <BtnBarra disabled={carregandoRel} onClick={() => verRelatorio(estado.resumo.sessao.id, true)}>
                {carregandoRel ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
                Parcial
              </BtnBarra>
              <BtnBarra forte onClick={() => setFechandoCaixa(true)}>
                <Lock className="size-4" />
                Fechar caixa
              </BtnBarra>
              <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
            </>
          )}

          <BtnBarra onClick={alternarTelaCheia}>
            {ampliado ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {ampliado ? 'Sair da tela cheia' : 'Tela cheia'}
          </BtnBarra>

          {onTrocarLayout && (
            <BtnBarra onClick={onTrocarLayout}>
              <LayoutDashboard className="size-4" />
              Layout clássico
            </BtnBarra>
          )}
        </div>
      </header>

      {(c.erro || erroAcao) && (
        <p className="m-3 shrink-0 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
          {c.erro || erroAcao}
        </p>
      )}

      {/* corpo */}
      {estado === null ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando caixa...
        </p>
      ) : !estado.aberto ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <AbrirCaixa
            ocupadoPor={estado.ocupado_por}
            ocupadoDesde={estado.ocupado_desde}
            onAberto={c.recarregar}
          />
          <SessoesRecentes onVer={(id) => verRelatorio(id, false)} />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[30rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col border-slate-800 p-3 lg:border-r">
            <ListaPDV
              pedidos={c.pedidos}
              selecionado={selecionado}
              onSelecionar={(id) => {
                setResultado(null)
                setSelecionado(id)
              }}
              busca={busca}
              onBusca={setBusca}
              foco={foco}
              ativo={!selecionado && !resultado && !algumaJanela}
            />
          </section>

          {/* no celular o painel cobre a tela; no computador fica ao lado da lista */}
          <section
            className={
              selecionado || resultado
                ? 'fixed inset-0 z-[60] overflow-y-auto bg-slate-950 p-4 lg:static lg:z-auto lg:min-h-0 lg:overflow-y-auto'
                : 'hidden min-h-0 p-4 lg:block'
            }
          >
            {resultado ? (
              <PedidoFechadoPDV resultado={resultado} onProximo={proximo} />
            ) : selecionado ? (
              <PainelPDV
                key={selecionado}
                pedidoId={selecionado}
                formaInicial={ultimaForma}
                onForma={setUltimaForma}
                onVoltar={() => setSelecionado(null)}
                onFechado={(r) => {
                  setResultado(r)
                  setSelecionado(null)
                  c.recarregar()
                }}
              />
            ) : (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-800 text-sm text-slate-500">
                <p>Escolha um pedido da lista para receber.</p>
                <p className="text-xs">↑ ↓ para escolher, Enter para abrir.</p>
              </div>
            )}
          </section>
        </div>
      )}

      <MovimentoDialog tipo={movimento} onClose={() => setMovimento(null)} onFeito={c.recarregar} />

      <ReceberPendenciaDialog
        aberto={pendenciaAberta}
        onClose={() => setPendenciaAberta(false)}
        onFeito={c.recarregar}
      />

      <DevolucaoDialog
        aberto={devolucaoAberta}
        onClose={() => setDevolucaoAberta(false)}
        onFeito={c.recarregar}
      />

      <FecharCaixaDialog
        aberto={fechandoCaixa}
        onClose={() => {
          setFechandoCaixa(false)
          c.recarregar()
        }}
      />

      <RelatorioDialog aberto={relatorio} onClose={() => setRelatorio(null)} />
    </div>
  )
}