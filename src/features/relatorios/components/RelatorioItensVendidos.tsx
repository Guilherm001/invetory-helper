'use client'

import { useState, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import type { Intervalo } from '../lib/periodo'
import { arred2, baixarCsv, inteiro, pct, reais } from '../lib/relatorioUtils'
import { itensMaisVendidos } from '../services/relatoriosVendasService'
import { Barra, Cartao, Dado, Estado, TD, TDD, TH, THD, useCarregar } from './pecasRelatorio'

const COR_CLASSE = {
  A: 'bg-emerald-50 text-emerald-700',
  B: 'bg-amber-50 text-amber-700',
  C: 'bg-slate-100 text-slate-600',
} as const

function Opcao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        ativo
          ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

export default function RelatorioItensVendidos({
  atual,
}: {
  atual: Intervalo
  anterior: Intervalo
}) {
  const [ordem, setOrdem] = useState<'valor' | 'quantidade'>('quantidade')
  const [limite, setLimite] = useState(30)

  const { dados, erro, carregando } = useCarregar(
    () => itensMaisVendidos(atual, ordem, limite),
    `${atual.ini}|${atual.fim}|${ordem}|${limite}`
  )

  const lista = dados ?? []
  const base = lista.length ? (ordem === 'valor' ? lista[0].valor : lista[0].quantidade) : 0

  const exportar = () =>
    baixarCsv(
      `itens-mais-vendidos-${atual.ini}-a-${atual.fim}`,
      ['Código', 'Produto', 'Unidade', 'Quantidade', 'Valor vendido', 'Pedidos', 'Preço médio', '% do total', '% acumulado', 'Classe ABC'],
      lista.map((i) => [
        i.codigo, i.nome, i.unidade, i.quantidade, arred2(i.valor), i.pedidos,
        arred2(i.precoMedio), i.participacao, i.acumulado, i.classe,
      ])
    )

  const pronto = !carregando && !erro && lista.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Opcao ativo={ordem === 'quantidade'} onClick={() => setOrdem('quantidade')}>
          Por quantidade
        </Opcao>
        <Opcao ativo={ordem === 'valor'} onClick={() => setOrdem('valor')}>
          Por valor vendido
        </Opcao>
        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        {[20, 50, 100].map((n) => (
          <Opcao key={n} ativo={limite === n} onClick={() => setLimite(n)}>
            Top {n}
          </Opcao>
        ))}
      </div>

      <Estado
        carregando={carregando}
        erro={erro}
        vazio={!carregando && !erro && lista.length === 0}
        textoVazio="Nenhum item vendido neste período."
      />

      {pronto && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Cartao rotulo="Itens diferentes" valor={String(lista[0].itensDistintos)} />
            <Cartao rotulo="Unidades vendidas" valor={inteiro(lista[0].quantidadeGeral)} />
            <Cartao
              rotulo="Vendido em itens"
              valor={reais(lista[0].totalGeral)}
              className="col-span-2 sm:col-span-1"
            />
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

          {/* celular: um cartão por item */}
          <ul className="grid gap-2 md:grid-cols-2 xl:hidden">
            {lista.map((i, idx) => (
              <li
                key={`${i.codigo}-${i.nome}`}
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      <span className="mr-1.5 text-slate-400">{idx + 1}º</span>
                      {i.nome}
                    </p>
                    <p className="text-xs text-slate-400">
                      {i.codigo ? `Cód. ${i.codigo}` : 'Sem código'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${COR_CLASSE[i.classe]}`}
                  >
                    {i.classe}
                  </span>
                </div>

                <Barra valor={base ? ((ordem === 'valor' ? i.valor : i.quantidade) / base) * 100 : 0} />

                <div className="grid grid-cols-3 gap-2">
                  <Dado rotulo="Quantidade" valor={`${inteiro(i.quantidade)}${i.unidade ? ` ${i.unidade}` : ''}`} />
                  <Dado rotulo="Valor vendido" valor={reais(i.valor)} />
                  <Dado rotulo="Pedidos" valor={String(i.pedidos)} />
                  <Dado rotulo="Preço médio" valor={reais(i.precoMedio)} />
                  <Dado rotulo="% do total" valor={pct(i.participacao)} />
                </div>
              </li>
            ))}
          </ul>

          {/* PC e tablet: tabela */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm xl:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={TH}>#</th>
                  <th className={`${TH} w-72`}>Produto</th>
                  <th className={THD}>Qtd.</th>
                  <th className={THD}>Valor vendido</th>
                  <th className={THD}>Pedidos</th>
                  <th className={THD}>Preço médio</th>
                  <th className={THD}>% do total</th>
                  <th className={TH}>ABC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((i, idx) => (
                  <tr key={`${i.codigo}-${i.nome}`}>
                    <td className={`${TD} text-slate-400`}>{idx + 1}º</td>
                    <td className={TD}>
                      <p className="font-semibold text-slate-900">{i.nome}</p>
                      <p className="mb-1 text-xs text-slate-400">
                        {i.codigo ? `Cód. ${i.codigo}` : 'Sem código'}
                      </p>
                      <Barra valor={base ? ((ordem === 'valor' ? i.valor : i.quantidade) / base) * 100 : 0} />
                    </td>
                    <td className={TDD}>
                      {inteiro(i.quantidade)}
                      {i.unidade ? ` ${i.unidade}` : ''}
                    </td>
                    <td className={`${TDD} font-semibold`}>{reais(i.valor)}</td>
                    <td className={TDD}>{i.pedidos}</td>
                    <td className={TDD}>{reais(i.precoMedio)}</td>
                    <td className={TDD}>{pct(i.participacao)}</td>
                    <td className={TD}>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COR_CLASSE[i.classe]}`}>
                        {i.classe}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">
            Curva ABC pelo valor vendido: A = itens que somam até 80% do faturamento, B = até 95%,
            C = o restante. A classe considera todos os itens do período, não só os listados.
          </p>
        </>
      )}
    </div>
  )
}