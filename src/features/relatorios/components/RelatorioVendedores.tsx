'use client'

import { Download } from 'lucide-react'
import type { Intervalo } from '../lib/periodo'
import { arred2, baixarCsv, pct, reais } from '../lib/relatorioUtils'
import { vendasPorVendedor, type VendedorVenda } from '../services/relatoriosVendasService'
import { Barra, Cartao, Estado, TD, TDD, TH, THD, useCarregar, Variacao } from './pecasRelatorio'

const soma = (l: VendedorVenda[], f: (v: VendedorVenda) => number) =>
  l.reduce((s, v) => s + f(v), 0)

export default function RelatorioVendedores({
  atual,
  anterior,
}: {
  atual: Intervalo
  anterior: Intervalo
}) {
  const { dados, erro, carregando } = useCarregar(
    async () => {
      const [a, b] = await Promise.all([vendasPorVendedor(atual), vendasPorVendedor(anterior)])
      return { a, b }
    },
    `${atual.ini}|${atual.fim}|${anterior.ini}|${anterior.fim}`
  )

  const lista = dados?.a ?? []
  const antes = dados?.b ?? []
  const anteriorDe = new Map(antes.map((v) => [v.vendedor, v]))

  const total = soma(lista, (v) => v.total)
  const pedidos = soma(lista, (v) => v.pedidos)
  const totalAnt = soma(antes, (v) => v.total)
  const pedidosAnt = soma(antes, (v) => v.pedidos)
  const ticket = pedidos ? total / pedidos : 0
  const ticketAnt = pedidosAnt ? totalAnt / pedidosAnt : 0

  const exportar = () =>
    baixarCsv(
      `vendas-por-vendedor-${atual.ini}-a-${atual.fim}`,
      ['Vendedor', 'Pedidos', 'Faturamento', 'Ticket médio', 'Maior venda', '% do total', '% entregas'],
      lista.map((v) => [
        v.vendedor,
        v.pedidos,
        arred2(v.total),
        arred2(v.pedidos ? v.total / v.pedidos : 0),
        arred2(v.maiorPedido),
        arred2(total ? (v.total / total) * 100 : 0),
        arred2(v.pedidos ? (v.entregas / v.pedidos) * 100 : 0),
      ])
    )

  const pronto = !carregando && !erro && lista.length > 0

  return (
    <div className="space-y-4">
      <Estado
        carregando={carregando}
        erro={erro}
        vazio={!carregando && !erro && lista.length === 0}
        textoVazio="Nenhum pedido neste período."
      />

      {pronto && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cartao rotulo="Faturamento" valor={reais(total)}>
              <Variacao atual={total} anterior={totalAnt} />
            </Cartao>
            <Cartao rotulo="Pedidos" valor={String(pedidos)}>
              <Variacao atual={pedidos} anterior={pedidosAnt} />
            </Cartao>
            <Cartao rotulo="Ticket médio" valor={reais(ticket)}>
              <Variacao atual={ticket} anterior={ticketAnt} />
            </Cartao>
            <Cartao rotulo="Vendedores ativos" valor={String(lista.length)} />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={exportar}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Download className="size-4" />
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={TH}>#</th>
                  <th className={TH}>Vendedor</th>
                  <th className={`${TH} w-56`}>Faturamento</th>
                  <th className={THD}>Pedidos</th>
                  <th className={THD}>Ticket médio</th>
                  <th className={THD}>Maior venda</th>
                  <th className={THD}>Entregas</th>
                  <th className={TH}>Evolução</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((v, i) => {
                  const parte = total ? (v.total / total) * 100 : 0
                  return (
                    <tr key={v.vendedor}>
                      <td className={`${TD} text-slate-400`}>{i + 1}º</td>
                      <td className={`${TD} font-semibold text-slate-900`}>{v.vendedor}</td>
                      <td className={TD}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">{reais(v.total)}</span>
                          <span className="text-xs text-slate-400">{pct(parte)}</span>
                        </div>
                        <Barra valor={parte} />
                      </td>
                      <td className={TDD}>{v.pedidos}</td>
                      <td className={TDD}>{reais(v.pedidos ? v.total / v.pedidos : 0)}</td>
                      <td className={TDD}>{reais(v.maiorPedido)}</td>
                      <td className={TDD}>{pct(v.pedidos ? (v.entregas / v.pedidos) * 100 : 0, 0)}</td>
                      <td className={TD}>
                        <Variacao
                          atual={v.total}
                          anterior={anteriorDe.get(v.vendedor)?.total ?? 0}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">
            Conta pedidos não cancelados, pelo vendedor que fechou a venda.
          </p>
        </>
      )}
    </div>
  )
}