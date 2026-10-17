'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Loader2,
  Lock,
  Receipt,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { useCaixa } from '../hooks/useCaixa'
import {
  relatorioDaSessao,
  sessoesRecentes,
} from '../services/caixaService'
import type { Relatorio, ResultadoFechamento, SessaoResumo } from '../types'
import { dataHora, reais } from '../lib/formatar'
import AbrirCaixa from './AbrirCaixa'
import FecharCaixaDialog from './FecharCaixaDialog'
import ListaPedidosCaixa from './ListaPedidosCaixa'
import MovimentoDialog from './MovimentoDialog'
import PainelRecebimento from './PainelRecebimento'
import PedidoFechado from './PedidoFechado'
import RelatorioDialog from './RelatorioCaixa'
import { Undo2, Wallet } from 'lucide-react'   // junto dos ícones que já existem
import DevolucaoDialog from './DevolucaoDialog'
import ReceberPendenciaDialog from './ReceberPendenciaDialog'

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

export default function CaixaPage() {
  const c = useCaixa()

  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoFechamento | null>(null)
  const [busca, setBusca] = useState('')
  const [foco, setFoco] = useState(0)
  const [movimento, setMovimento] = useState<'sangria' | 'suprimento' | null>(null)
  const [fechandoCaixa, setFechandoCaixa] = useState(false)
  const [relatorio, setRelatorio] = useState<Relatorio_ | null>(null)
  const [carregandoRel, setCarregandoRel] = useState(false)
  const [erroAcao, setErroAcao] = useState('')
  const [pendenciaAberta, setPendenciaAberta] = useState(false)
const [devolucaoAberta, setDevolucaoAberta] = useState(false)

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
    <div className="w-full pb-16">
      <div className="mt-7 py-4">
        <h3 className="text-2xl font-bold md:text-3xl">Caixa</h3>
        <p className="text-sm text-gray-400">Receba os pedidos em aberto e feche o dia.</p>
      </div>

      {(c.erro || erroAcao) && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {c.erro || erroAcao}
        </p>
      )}

      {estado === null ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin" />
          Carregando caixa...
        </p>
      ) : !estado.aberto ? (
        <>
          <AbrirCaixa
            ocupadoPor={estado.ocupado_por}
            ocupadoDesde={estado.ocupado_desde}
            onAberto={c.recarregar}
          />
          <SessoesRecentes onVer={(id) => verRelatorio(id, false)} />
        </>
      ) : (
        <>
          {/* barra do caixa */}
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

          <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
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
                  ? 'fixed inset-0 z-40 overflow-y-auto bg-white p-4 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0'
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
        </>
      )}

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

      <MovimentoDialog tipo={movimento} onClose={() => setMovimento(null)} onFeito={c.recarregar} />

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