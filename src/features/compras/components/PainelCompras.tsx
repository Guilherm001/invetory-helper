'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  ClipboardCopy,
  FileText,
  Loader2,
  MessageCircle,
  Package,
  PackageCheck,
  RefreshCw,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { dataCurta, hoje, reais } from '@/features/loja/lib/formatar'
import {
  carregarPainel,
  dispensarNotas,
  dispensarTodasSemNota,
  type Painel,
} from '../services/painelService'
import { numeroPedido } from '../lib/compras'

const PERIODOS = [7, 30, 90]

const compacto = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

// "(11) 91234-5678" -> "5511912345678" (só se parecer um telefone)
function telefoneWhats(contato: string | null) {
  const d = (contato ?? '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return null
}

// ---------- peças ----------

type Tom = 'neutro' | 'alerta'

function Cartao({
  href,
  titulo,
  valor,
  detalhe,
  icone: Icone,
  tom = 'neutro',
}: {
  href: string
  titulo: string
  valor: string
  detalhe: React.ReactNode
  icone: LucideIcon
  tom?: Tom
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 shadow-sm transition hover:shadow-md ${
        tom === 'alerta'
          ? 'border-amber-300 bg-amber-50'
          : 'border-slate-200 bg-white hover:border-[#079C9C]/40'
      }`}
    >
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icone className="size-4 text-[#079C9C]" />
        {titulo}
      </div>
      <p
        className={`mt-1 text-2xl font-bold ${tom === 'alerta' ? 'text-amber-700' : 'text-slate-900'}`}
      >
        {valor}
      </p>
      <p className="text-xs text-slate-500">{detalhe}</p>
    </Link>
  )
}

function Bloco({
  titulo,
  icone: Icone,
  children,
  className = '',
}: {
  titulo: string
  icone: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icone className="size-4 text-[#079C9C]" />
        {titulo}
      </h4>
      {children}
    </section>
  )
}

function Cobrar({ contato, texto }: { contato: string | null; texto: string }) {
  const [copiado, setCopiado] = useState(false)
  const numero = telefoneWhats(contato)

  const estilo =
    'flex shrink-0 items-center gap-1.5 rounded-lg border border-[#079C9C] px-3 py-1.5 text-xs font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 active:scale-95'

  if (numero) {
    return (
      <a
        href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={estilo}
      >
        <MessageCircle className="size-3.5" />
        Cobrar
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        } catch {
          // sem permissão para copiar: nada a fazer
        }
      }}
      title="Sem telefone cadastrado para este fornecedor: copia a mensagem"
      className={estilo}
    >
      {copiado ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
      {copiado ? 'Copiado' : 'Copiar cobrança'}
    </button>
  )
}

function Meses({ meses }: { meses: Painel['meses'] }) {
  const max = Math.max(...meses.map((m) => m.total), 1)

  return (
    <div className="flex h-44 items-end gap-2">
      {meses.map((m) => {
        const altura = Math.max(m.total > 0 ? 4 : 1, (m.total / max) * 100)
        const rotulo = new Date(`${m.mes}-01T12:00:00`)
          .toLocaleDateString('pt-BR', { month: 'short' })
          .replace('.', '')
        return (
          <div
            key={m.mes}
            title={`${rotulo}: ${reais(m.total)} em ${plural(m.n, 'pedido', 'pedidos')}`}
            className="flex h-full min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span className="h-4 text-[11px] font-semibold text-slate-600">
              {m.total > 0 ? compacto.format(m.total) : ''}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-[#079C9C]/70"
                style={{ height: `${altura}%` }}
              />
            </div>
            <span className="text-xs capitalize text-slate-500">{rotulo}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- página ----------

export default function PainelCompras() {
  const [dias, setDias] = useState(30)
  const [versao, setVersao] = useState(0)
  const [res, setRes] = useState<{ chave: string; painel: Painel } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [dispensando, setDispensando] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')

  const chave = `${dias}|${versao}`

  useEffect(() => {
    let cancelado = false
    carregarPainel(dias)
      .then((painel) => {
        if (cancelado) return
        setRes({ chave, painel })
        setErro(null)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao carregar o painel')
      })
    return () => {
      cancelado = true
    }
  }, [chave, dias])

  const d = res?.painel ?? null
  const atualizando = res !== null && res.chave !== chave

  const hojeIso = hoje()

  const variacao =
    d && d.comprado.anterior > 0
      ? ((d.comprado.total - d.comprado.anterior) / d.comprado.anterior) * 100
      : null

  const nada =
    d !== null &&
    d.atrasados.n === 0 &&
    d.faltas.sem_etapa === 0 &&
    d.rascunhos.parados === 0 &&
    d.parciais === 0 &&
    d.divergentes.n === 0 &&
    d.sem_nota.n === 0

  const maiorFornecedor = d ? Math.max(...d.fornecedores.map((f) => f.total), 1) : 1

  const dispensar = async (id: string) => {
    setDispensando(id)
    setErroAcao('')
    try {
      await dispensarNotas([id], true)
      setVersao((v) => v + 1)
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível alterar o pedido')
    } finally {
      setDispensando(null)
    }
  }

  const dispensarTodos = async () => {
    if (!d) return
    if (
      !window.confirm(
        `Marcar os ${d.sem_nota.n} pedidos recebidos nos últimos ${d.dias} dias como "sem nota fiscal"? Eles saem deste alerta. Dá para desfazer, um a um, dentro de cada pedido.`
      )
    )
      return
    setDispensando('todos')
    setErroAcao('')
    try {
      await dispensarTodasSemNota(d.dias)
      setVersao((v) => v + 1)
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível alterar os pedidos')
    } finally {
      setDispensando(null)
    }
  }

  return (
    <div className="w-full pb-16">
      <div className="mt-7 flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-2xl font-bold md:text-3xl">Painel de compras</h3>
          <p className="text-sm text-gray-400">
            O que comprar, o que está a caminho e o que precisa de atenção.
          </p>
        </article>

        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Período"
            className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm"
          >
            {PERIODOS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={dias === p}
                onClick={() => setDias(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  dias === p ? 'bg-[#079C9C] text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p} dias
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setVersao((v) => v + 1)}
            aria-label="Atualizar"
            title="Atualizar"
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:text-[#079C9C]"
          >
            <RefreshCw className={`size-4 ${atualizando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {erro && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}

      {!d ? (
        !erro && (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Carregando...
          </p>
        )
      ) : (
        <div className={`space-y-5 ${atualizando ? 'opacity-60' : ''}`}>
          {/* indicadores */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Cartao
              href="/pedidos-compra"
              icone={ClipboardCheck}
              titulo={`Comprado em ${d.dias} dias`}
              valor={reais(d.comprado.total)}
              detalhe={
                <>
                  {plural(d.comprado.n, 'pedido', 'pedidos')}
                  {variacao !== null && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 font-semibold text-slate-600">
                      {variacao >= 0 ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {Math.abs(variacao).toFixed(0)}% vs. período anterior
                    </span>
                  )}
                </>
              }
            />
            <Cartao
              href="/pedidos-compra?filtro=andamento"
              icone={Truck}
              titulo="Pedidos em aberto"
              valor={String(d.abertos.n)}
              detalhe={reais(d.abertos.total)}
            />
            <Cartao
              href="/pedidos-compra?filtro=atrasado"
              icone={AlertTriangle}
              titulo="Atrasados"
              valor={String(d.atrasados.n)}
              detalhe={reais(d.atrasados.total)}
              tom={d.atrasados.n > 0 ? 'alerta' : 'neutro'}
            />
            <Cartao
              href="/recebimento"
              icone={PackageCheck}
              titulo="Chegam hoje"
              valor={String(d.hoje.n)}
              detalhe={`${plural(d.semana.n, 'pedido', 'pedidos')} nos próximos 7 dias`}
            />
            <Cartao
              href="/dashboard"
              icone={Package}
              titulo="Produtos em falta"
              valor={String(d.faltas.abertas)}
              detalhe={`${d.faltas.alta} de alta prioridade · ${d.faltas.sem_etapa} sem cotação ou pedido`}
            />
            <Cartao
              href="/pedidos-compra?filtro=rascunho"
              icone={FileText}
              titulo="Rascunhos"
              valor={String(d.rascunhos.n)}
              detalhe={
                d.rascunhos.parados > 0
                  ? `${d.rascunhos.parados} parados há mais de 3 dias`
                  : reais(d.rascunhos.total)
              }
              tom={d.rascunhos.parados > 0 ? 'alerta' : 'neutro'}
            />
          </div>

          {/* ação agora */}
          <Bloco titulo="Precisa de ação agora" icone={AlertTriangle}>
            {erroAcao && (
              <p
                role="alert"
                className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
              >
                {erroAcao}
              </p>
            )}

            {nada ? (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Check className="size-4" />
                Tudo em dia: nada atrasado, parado, sem nota ou com valor diferente.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.lista_atrasados.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link
                      href={`/pedidos-compra?abrir=${a.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {numeroPedido(a.numero)} · {a.fornecedor_nome}
                      </span>
                      <span className="block text-xs text-amber-700">
                        Atrasado {plural(a.dias, 'dia', 'dias')} (previsto{' '}
                        {dataCurta(a.previsao_entrega)}) · {reais(a.total)}
                      </span>
                    </Link>
                    <Cobrar
                      contato={a.fornecedor_contato}
                      texto={`Olá! Tudo bem? Estou acompanhando o nosso pedido ${numeroPedido(a.numero)}, que estava previsto para ${dataCurta(a.previsao_entrega)}. Vocês conseguem me passar uma nova previsão de entrega?`}
                    />
                  </li>
                ))}

                {d.atrasados.n > d.lista_atrasados.length && (
                  <li className="py-2.5 text-sm">
                    <Link
                      href="/pedidos-compra?filtro=atrasado"
                      className="font-semibold text-[#079C9C] hover:underline"
                    >
                      Ver os outros {d.atrasados.n - d.lista_atrasados.length} atrasados
                    </Link>
                  </li>
                )}

                {d.faltas.sem_etapa > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-sm text-slate-700">
                      <strong>{plural(d.faltas.sem_etapa, 'produto', 'produtos')}</strong> em falta
                      sem cotação nem pedido
                    </span>
                    <Link
                      href="/dashboard"
                      className="shrink-0 rounded-lg border border-[#079C9C] px-3 py-1.5 text-xs font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10"
                    >
                      Ver faltas
                    </Link>
                  </li>
                )}

                {d.lista_rascunhos.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <Link href={`/pedidos-compra?abrir=${r.id}`} className="block hover:underline">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {numeroPedido(r.numero)} · {r.fornecedor_nome}
                      </span>
                      <span className="block text-xs text-slate-500">
                        Rascunho parado desde {new Date(r.criado_em).toLocaleDateString('pt-BR')} ·{' '}
                        {reais(r.total)}
                      </span>
                    </Link>
                  </li>
                ))}

                {d.parciais > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-sm text-slate-700">
                      <strong>{plural(d.parciais, 'pedido', 'pedidos')}</strong> com entrega parcial,
                      esperando o resto
                    </span>
                    <Link
                      href="/recebimento"
                      className="shrink-0 rounded-lg border border-[#079C9C] px-3 py-1.5 text-xs font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10"
                    >
                      Ver recebimento
                    </Link>
                  </li>
                )}

                {d.lista_divergentes.map((v) => (
                  <li key={v.id} className="py-2.5">
                    <Link href={`/pedidos-compra?abrir=${v.id}`} className="block hover:underline">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {numeroPedido(v.numero)} · {v.fornecedor_nome}
                      </span>
                      <span className="block text-xs text-amber-700">
                        Nota fiscal {reais(v.notas)} contra {reais(v.esperado)} esperados (
                        {v.dif > 0 ? '+' : '-'}
                        {reais(Math.abs(v.dif))})
                      </span>
                    </Link>
                  </li>
                ))}

                {d.divergentes.n > d.lista_divergentes.length && (
                  <li className="py-2.5 text-sm text-slate-500">
                    E mais {d.divergentes.n - d.lista_divergentes.length} com valor de nota
                    diferente.
                  </li>
                )}

                {d.sem_nota.n > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-sm text-slate-700">
                      <strong>{plural(d.sem_nota.n, 'pedido recebido', 'pedidos recebidos')}</strong>{' '}
                      sem nota fiscal registrada
                    </span>
                    <button
                      type="button"
                      onClick={dispensarTodos}
                      disabled={dispensando !== null}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {dispensando === 'todos' && <Loader2 className="size-3.5 animate-spin" />}
                      Marcar todos como sem nota
                    </button>
                  </li>
                )}

                {d.lista_sem_nota.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link
                      href={`/pedidos-compra?abrir=${s.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {numeroPedido(s.numero)} · {s.fornecedor_nome}
                      </span>
                      <span className="block text-xs text-slate-500">
                        Recebido em {new Date(s.recebido_em).toLocaleDateString('pt-BR')} ·{' '}
                        {reais(s.total)}
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/pedidos-compra?abrir=${s.id}`}
                        className="rounded-lg border border-[#079C9C] px-3 py-1.5 text-xs font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10"
                      >
                        Registrar nota
                      </Link>
                      <button
                        type="button"
                        onClick={() => dispensar(s.id)}
                        disabled={dispensando !== null}
                        title="Este pedido não tem nota fiscal (compra à vista, por exemplo)"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {dispensando === s.id && <Loader2 className="size-3.5 animate-spin" />}
                        Sem nota
                      </button>
                    </div>
                  </li>
                ))}

                {d.sem_nota.n > d.lista_sem_nota.length && (
                  <li className="py-2.5 text-sm text-slate-500">
                    E mais {d.sem_nota.n - d.lista_sem_nota.length} sem nota.
                  </li>
                )}
              </ul>
            )}
          </Bloco>

          <div className="grid gap-5 lg:grid-cols-2">
            <Bloco titulo="Chegando nos próximos 7 dias" icone={PackageCheck}>
              {d.lista_chegando.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma entrega prevista nos próximos dias.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {d.lista_chegando.map((c) => (
                    <li key={c.id}>
                      <Link
                        href="/recebimento"
                        className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {numeroPedido(c.numero)} · {c.fornecedor_nome}
                          </span>
                          {c.recebido_parcial && (
                            <span className="text-xs font-medium text-orange-600">
                              Recebido parcial
                            </span>
                          )}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            c.previsao_entrega === hojeIso
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.previsao_entrega === hojeIso ? 'Hoje' : dataCurta(c.previsao_entrega)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>

            <Bloco titulo="Entregas no período" icone={Truck}>
              {d.entregas.recebidos === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum pedido recebido nos últimos {d.dias} dias.
                </p>
              ) : (
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-slate-500">Pedidos recebidos</dt>
                    <dd className="text-2xl font-bold text-slate-900">{d.entregas.recebidos}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Entregues no prazo</dt>
                    <dd className="text-2xl font-bold text-slate-900">
                      {d.entregas.com_previsao > 0
                        ? `${Math.round((d.entregas.no_prazo / d.entregas.com_previsao) * 100)}%`
                        : '—'}
                    </dd>
                    {d.entregas.com_previsao > 0 && (
                      <dd className="text-xs text-slate-500">
                        {d.entregas.no_prazo} de {d.entregas.com_previsao} com previsão
                      </dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Prazo médio de entrega</dt>
                    <dd className="text-2xl font-bold text-slate-900">
                      {d.entregas.prazo_medio !== null
                        ? `${String(d.entregas.prazo_medio).replace('.', ',')} dias`
                        : '—'}
                    </dd>
                    <dd className="text-xs text-slate-500">do envio até o recebimento</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Cotações feitas</dt>
                    <dd className="text-2xl font-bold text-slate-900">{d.cotacoes}</dd>
                  </div>
                </dl>
              )}
            </Bloco>
          </div>

          <Bloco
            titulo={`Vencimentos das notas (próximos ${d.vencimentos.dias} dias)`}
            icone={CalendarClock}
          >
            {d.lista_vencimentos.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum vencimento nos próximos {d.vencimentos.dias} dias. Só as notas importadas por
                XML trazem os vencimentos.
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  <strong>{plural(d.vencimentos.n, 'vencimento', 'vencimentos')}</strong> somando{' '}
                  <strong>{reais(d.vencimentos.total)}</strong>
                </p>
                <ul className="divide-y divide-slate-100">
                  {d.lista_vencimentos.map((v, i) => (
                    <li key={`${v.pedido_id}-${v.vencimento}-${i}`}>
                      <Link
                        href={`/pedidos-compra?abrir=${v.pedido_id}`}
                        className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={`w-16 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${
                              v.vencimento === hojeIso
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {v.vencimento === hojeIso ? 'Hoje' : dataCurta(v.vencimento).slice(0, 5)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {v.fornecedor_nome}
                            </span>
                            <span className="block text-xs text-slate-500">
                              NF {v.nf} · {numeroPedido(v.pedido_numero)}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-slate-900">
                          {reais(v.valor)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {d.vencimentos.n > d.lista_vencimentos.length && (
                  <p className="mt-1 text-xs text-slate-400">
                    E mais {d.vencimentos.n - d.lista_vencimentos.length} vencimentos no período.
                  </p>
                )}
              </>
            )}
            <p className="mt-2 text-xs text-slate-400">
              O sistema ainda não controla o que já foi pago: a lista mostra todos os vencimentos
              das notas, pagos ou não.
            </p>
          </Bloco>

          <div className="grid gap-5 lg:grid-cols-2">
            <Bloco titulo="Compras por mês" icone={ClipboardCheck}>
              <Meses meses={d.meses} />
              <p className="mt-2 text-xs text-slate-400">
                Soma dos pedidos enviados, confirmados e recebidos.
              </p>
            </Bloco>

            <Bloco titulo={`Principais fornecedores (${d.dias} dias)`} icone={Truck}>
              {d.fornecedores.length === 0 ? (
                <p className="text-sm text-slate-500">Sem compras no período.</p>
              ) : (
                <ul className="space-y-3">
                  {d.fornecedores.map((f, i) => (
                    <li key={`${f.nome}-${i}`}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-slate-800">{f.nome}</span>
                        <span className="shrink-0 font-semibold text-slate-900">
                          {reais(f.total)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#079C9C]/60"
                          style={{ width: `${Math.max(4, (f.total / maiorFornecedor) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {plural(f.n, 'pedido', 'pedidos')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
          </div>

          <Bloco titulo="Maiores altas de preço (última compra contra a anterior)" icone={TrendingUp}>
            {d.altas.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum produto subiu 5% ou mais entre as duas últimas compras.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.altas.map((a, i) => (
                  <li
                    key={`${a.nome}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {a.nome}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {reais(a.anterior)} → {reais(a.atual)} · {a.fornecedor} ·{' '}
                        {new Date(a.em).toLocaleDateString('pt-BR')}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                      +{String(a.variacao).replace('.', ',')}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      )}
    </div>
  )
}