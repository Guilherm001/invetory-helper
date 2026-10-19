'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Receipt,
  LayoutDashboard,
  Undo2,
  Wallet,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { useCaixa } from '../hooks/useCaixa'
import { relatorioDaSessao, sessoesRecentes } from '../services/caixaService'
import type { Relatorio, ResultadoFechamento, SessaoResumo } from '../types'
import { dataHora, reais } from '../lib/formatar'
import AbrirCaixa from './AbrirCaixa'
import DevolucaoDialog from './DevolucaoDialog'
import FecharCaixaDialog from './FecharCaixaDialog'
import ListaPedidosCaixa from './ListaPedidosCaixa'
import MovimentoDialog from './MovimentoDialog'
import PainelRecebimento from './PainelRecebimento'
import PedidoFechado from './PedidoFechado'
import ReceberPendenciaDialog from './ReceberPendenciaDialog'
import RelatorioDialog from './RelatorioCaixa'

type Relatorio_ = { rel: Relatorio; parcial: boolean }

// lista dos últimos turnos, para rever e reimprimir
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
      <h4 className="text-sm font-semibold text-slate-700">Últimos caixas</h4>
      <ul className="space-y-2">
        {lista.slice(0, 8).map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{dataHora(s.aberto_em)}</p>
              <p className="text-xs text-slate-500">
                {s.aberto_por}
                {s.liquido !== null ? ` · ${reais(s.liquido)}` : ''}
                {s.diferenca !== null && s.diferenca !== 0
                  ? ` · ${s.diferenca > 0 ? 'sobra' : 'falta'} ${reais(Math.abs(s.diferenca))}`
                  : ''}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onVer(s.id)} className="gap-1.5">
              <FileText className="size-4" />
              Relatório
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function CaixaPage({ onTrocarLayout }: { onTrocarLayout?: () => void }) {
  const c = useCaixa()

  const [ampliado, setAmpliado] = useState(false)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoFechamento | null>(null)
  const [busca, setBusca] = useState('')
  const [foco, setFoco] = useState(0)
  const [movimento, setMovimento] = useState<'sangria' | 'suprimento' | null>(null)
  const [pendenciaAberta, setPendenciaAberta] = useState(false)
  const [devolucaoAberta, setDevolucaoAberta] = useState(false)
  const [fechandoCaixa, setFechandoCaixa] = useState(false)
  const [relatorio, setRelatorio] = useState<Relatorio_ | null>(null)
  const [carregandoRel, setCarregandoRel] = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  // a página de trás não rola enquanto o caixa está ampliado
  useEffect(() => {
    if (!ampliado) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [ampliado])

  // Esc (ou o botão do navegador) sai da tela cheia: a aba volta ao normal junto
  useEffect(() => {
    const aoMudar = () => {
      if (!document.fullscreenElement) setAmpliado(false)
    }
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  // se a pessoa sair da página ampliada, não deixa o navegador preso em tela cheia
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { })
    },
    []
  )

  const alternarTelaCheia = async () => {
    if (!ampliado) {
      setAmpliado(true)
      try {
        // tira a barra do navegador também; se não der (ex.: iPhone), segue só com a aba ampliada
        await document.documentElement.requestFullscreen?.()
      } catch {
        /* sem tela cheia do navegador */
      }
    } else {
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
    setFoco((f) => f + 1)
  }

  const estado = c.estado

  return (
    <div
      className={
        ampliado ? 'fixed inset-0 z-50 flex flex-col bg-white px-4 pb-4 md:px-6' : 'w-full pb-16'
      }
    >
      {/* topo: no modo ampliado fica fixo e o resto rola por baixo */}
      <div className={ampliado ? 'shrink-0' : ''}>
        <div
          className={`flex flex-wrap items-end justify-between gap-3 ${ampliado ? 'py-3' : 'mt-7 py-4'
            }`}
        >
          <div>
            <h3 className="text-2xl font-bold md:text-3xl">Caixa</h3>
            <p className="text-sm text-gray-400">Receba os pedidos em aberto e feche o dia.</p>
          </div>

          <div className="flex flex-wrap gap-2">
  {onTrocarLayout && (
    <Button type="button" variant="outline" size="sm" onClick={onTrocarLayout} className="gap-1.5">
      <LayoutDashboard className="size-4" />
      Testar layout PDV
    </Button>
  )}
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={alternarTelaCheia}
    aria-pressed={ampliado}
    title={ampliado ? 'Voltar ao tamanho normal' : 'Ocupar a tela inteira'}
    className="gap-1.5"
  >
    {ampliado ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    {ampliado ? 'Sair da tela cheia' : 'Tela cheia'}
  </Button>
</div>
        </div>

        {(c.erro || erroAcao) && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {c.erro || erroAcao}
          </p>
        )}

        {estado?.aberto && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-2 font-semibold text-emerald-700">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                Caixa aberto
              </span>
              <span className="text-slate-500">
                {estado.resumo.sessao.aberto_por} · desde {dataHora(estado.resumo.sessao.aberto_em)}
              </span>
              <span className="text-slate-700">
                <strong>{estado.resumo.vendas.quantidade}</strong> pedidos ·{' '}
                <strong>{reais(estado.resumo.vendas.liquido)}</strong>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMovimento('sangria')} className="gap-1.5">
                <ArrowUpFromLine className="size-4" />
                Sangria
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setMovimento('suprimento')} className="gap-1.5">
                <ArrowDownToLine className="size-4" />
                Suprimento
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPendenciaAberta(true)} className="gap-1.5">
                <Wallet className="size-4" />
                Pendência
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDevolucaoAberta(true)} className="gap-1.5">
                <Undo2 className="size-4" />
                Devolução
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={carregandoRel}
                onClick={() => verRelatorio(estado.resumo.sessao.id, true)}
                className="gap-1.5"
              >
                {carregandoRel ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
                Parcial
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setFechandoCaixa(true)}
                className="gap-1.5 bg-slate-800 text-white hover:bg-slate-700"
              >
                <Lock className="size-4" />
                Fechar caixa
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* corpo */}
      {estado === null ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Carregando caixa...
        </p>
      ) : !estado.aberto ? (
        <div className={ampliado ? 'min-h-0 flex-1 overflow-y-auto pb-6' : ''}>
          <AbrirCaixa
            ocupadoPor={estado.ocupado_por}
            ocupadoDesde={estado.ocupado_desde}
            onAberto={c.recarregar}
          />
          <SessoesRecentes onVer={(id) => verRelatorio(id, false)} />
        </div>
      ) : (
        <div
          className={`grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] ${ampliado ? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)]' : ''
            }`}
        >
          <ListaPedidosCaixa
            pedidos={c.pedidos}
            selecionado={selecionado}
            onSelecionar={(id) => {
              setResultado(null)
              setSelecionado(id)
            }}
            busca={busca}
            onBusca={setBusca}
            foco={foco}
          />

          {/* no celular o painel cobre a tela; no computador fica ao lado da lista */}
          <div
            className={
              selecionado || resultado
                ? `fixed inset-0 z-40 overflow-y-auto bg-white p-4 lg:static lg:z-auto lg:bg-transparent lg:p-0 ${ampliado ? 'lg:min-h-0 lg:overflow-y-auto' : 'lg:overflow-visible'
                }`
                : 'hidden lg:block'
            }
          >
            {resultado ? (
              <PedidoFechado resultado={resultado} onProximo={proximo} />
            ) : selecionado ? (
              <PainelRecebimento
                key={selecionado}
                pedidoId={selecionado}
                onVoltar={() => setSelecionado(null)}
                onFechado={(r) => {
                  setResultado(r)
                  setSelecionado(null)
                  c.recarregar()
                }}
              />
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                Escolha um pedido da lista para receber.
              </div>
            )}
          </div>
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