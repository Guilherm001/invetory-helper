'use client'

import { Download } from 'lucide-react'
import type { Intervalo } from '../lib/periodo'
import { arred2, baixarCsv, pct, reais } from '../lib/relatorioUtils'
import {
  orcamentosPorVendedor,
  type OrcamentoVendedor,
} from '../services/relatoriosVendasService'
import { Barra, Cartao, Estado, TD, TDD, TH, THD, useCarregar } from './pecasRelatorio'

const soma = (l: OrcamentoVendedor[], f: (v: OrcamentoVendedor) => number) =>
  l.reduce((s, v) => s + f(v), 0)

export default function RelatorioOrcamentos({
  atual,
  anterior,
}: {
  atual: Intervalo
  anterior: Intervalo
}) {
  const { dados, erro, carregando } = useCarregar(
    async () => {
      const [a, b] = await Promise.all([
        orcamentosPorVendedor(atual),
        orcamentosPorVendedor(anterior),
      ])
      return { a, b }
    },
    `${atual.ini}|${atual.fim}|${anterior.ini}|${anterior.fim}`
  )

  const lista = dados?.a ?? []
  const antes = dados?.b ?? []

  const feitos = soma(lista, (v) => v.feitos)
  const convertidos = soma(lista, (v) => v.convertidos)
  const emAberto = soma(lista, (v) => v.emAberto)
  const vencidos = soma(lista, (v) => v.vencidos)
  const recusados = soma(lista, (v) => v.recusados)
  const outros = Math.max(0, feitos - convertidos - emAberto - vencidos - recusados)

  const valorFeito = soma(lista, (v) => v.valorFeito)
  const valorConvertido = soma(lista, (v) => v.valorConvertido)
  const valorAberto = soma(lista, (v) => v.valorAberto)
  const valorVencido = soma(lista, (v) => v.valorVencido)

  const taxa = feitos ? (convertidos / feitos) * 100 : 0
  const taxaValor = valorFeito ? (valorConvertido / valorFeito) * 100 : 0

  const feitosAnt = soma(antes, (v) => v.feitos)
  const taxaAnt = feitosAnt ? (soma(antes, (v) => v.convertidos) / feitosAnt) * 100 : null
  const difPontos = taxaAnt === null ? null : taxa - taxaAnt

  const dias = convertidos
    ? soma(lista, (v) => (v.diasMedio ?? 0) * v.convertidos) / convertidos
    : null

  const partes: [string, number, string][] = [
    ['Convertidos', convertidos, 'bg-emerald-500'],
    ['Em aberto', emAberto, 'bg-sky-500'],
    ['Vencidos', vencidos, 'bg-amber-500'],
    ['Recusados', recusados, 'bg-red-500'],
    ['Outros', outros, 'bg-slate-300'],
  ]

  const exportar = () =>
    baixarCsv(
      `orcamentos-${atual.ini}-a-${atual.fim}`,
      [
        'Vendedor', 'Feitos', 'Valor feito', 'Convertidos', 'Valor convertido', 'Taxa de conversão %',
        'Em aberto', 'Valor em aberto', 'Vencidos', 'Valor vencido', 'Recusados', 'Valor recusado',
        'Dias médios para fechar',
      ],
      lista.map((v) => [
        v.vendedor, v.feitos, arred2(v.valorFeito), v.convertidos, arred2(v.valorConvertido),
        arred2(v.feitos ? (v.convertidos / v.feitos) * 100 : 0),
        v.emAberto, arred2(v.valorAberto), v.vencidos, arred2(v.valorVencido),
        v.recusados, arred2(v.valorRecusado), v.diasMedio === null ? '' : arred2(v.diasMedio),
      ])
    )

  const pronto = !carregando && !erro && lista.length > 0

  return (
    <div className="space-y-4">
      <Estado
        carregando={carregando}
        erro={erro}
        vazio={!carregando && !erro && lista.length === 0}
        textoVazio="Nenhum orçamento neste período."
      />

      {pronto && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Cartao rotulo="Orçamentos feitos" valor={String(feitos)}>
              {reais(valorFeito)}
            </Cartao>
            <Cartao rotulo="Convertidos em pedido" valor={String(convertidos)}>
              {reais(valorConvertido)}
            </Cartao>
            <Cartao rotulo="Taxa de conversão" valor={pct(taxa)}>
              em valor: {pct(taxaValor)}
              {difPontos !== null && Math.abs(difPontos) >= 0.05 && (
                <span className={difPontos > 0 ? ' text-emerald-600' : ' text-red-600'}>
                  {' · '}
                  {difPontos > 0 ? '▲' : '▼'} {pct(Math.abs(difPontos))} p.p.
                </span>
              )}
            </Cartao>
            <Cartao
              rotulo="Prazo médio p/ fechar"
              valor={dias === null ? '—' : `${dias.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`}
            />
            <Cartao rotulo="Ainda na mesa" valor={reais(valorAberto)}>
              {emAberto} em aberto · {reais(valorVencido)} vencido
            </Cartao>
          </div>

          {/* funil */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-700">Destino dos orçamentos</p>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {partes
                .filter(([, q]) => q > 0)
                .map(([nome, q, cor]) => (
                  <div
                    key={nome}
                    className={cor}
                    style={{ width: `${(q / feitos) * 100}%` }}
                    title={`${nome}: ${q}`}
                  />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {partes
                .filter(([, q]) => q > 0)
                .map(([nome, q, cor]) => (
                  <span key={nome} className="flex items-center gap-1.5">
                    <span className={`size-2.5 rounded-full ${cor}`} />
                    {nome}: <strong>{q}</strong> ({pct((q / feitos) * 100, 0)})
                  </span>
                ))}
            </div>
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
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={TH}>Vendedor</th>
                  <th className={THD}>Feitos</th>
                  <th className={THD}>Convertidos</th>
                  <th className={`${TH} w-40`}>Taxa</th>
                  <th className={THD}>Valor convertido</th>
                  <th className={THD}>Em aberto</th>
                  <th className={THD}>Vencidos</th>
                  <th className={THD}>Recusados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((v) => {
                  const t = v.feitos ? (v.convertidos / v.feitos) * 100 : 0
                  return (
                    <tr key={v.vendedor}>
                      <td className={`${TD} font-semibold text-slate-900`}>{v.vendedor}</td>
                      <td className={TDD}>{v.feitos}</td>
                      <td className={TDD}>{v.convertidos}</td>
                      <td className={TD}>
                        <span className="text-xs font-semibold">{pct(t)}</span>
                        <Barra valor={t} cor="bg-emerald-500" />
                      </td>
                      <td className={TDD}>{reais(v.valorConvertido)}</td>
                      <td className={TDD}>{v.emAberto}</td>
                      <td className={TDD}>{v.vencidos}</td>
                      <td className={TDD}>{v.recusados}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">
            O período vale pela data em que o orçamento foi feito. Convertido = virou pedido. Em
            aberto = ainda dentro da validade e pode converter. A taxa é sobre todos os orçamentos
            feitos, por isso sobe conforme os em aberto fecham.
          </p>
        </>
      )}
    </div>
  )
}