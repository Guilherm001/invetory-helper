'use client'

import { Printer, Receipt } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { imprimirHtml } from '@/features/loja/lib/impressao'
import type { Relatorio } from '../types'
import { htmlRelatorioA4, htmlRelatorioCupom } from '../lib/relatorioHtml'
import { dataHora, FORMA_ROTULO, hora, reais } from '../lib/formatar'

const Linha = ({ a, b, forte = false }: { a: string; b: string; forte?: boolean }) => (
  <div className={`flex items-center justify-between gap-3 py-1.5 text-sm ${forte ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
    <span>{a}</span>
    <span>{b}</span>
  </div>
)

const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4">
    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</h4>
    <div className="divide-y divide-slate-100">{children}</div>
  </section>
)

export function RelatorioConteudo({ rel, parcial }: { rel: Relatorio; parcial: boolean }) {
  const dif = rel.sessao.diferenca
  const formas = ['dinheiro', 'pix', 'debito', 'credito', 'credito_cliente', 'pendencia'].filter(
    (f) => ['dinheiro', 'pix', 'debito', 'credito'].includes(f) || (rel.formas[f]?.valor ?? 0) > 0
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Aberto por <strong>{rel.sessao.aberto_por}</strong> em {dataHora(rel.sessao.aberto_em)}
        {rel.sessao.fechado_em && (
          <>
            {' '}
            · fechado por <strong>{rel.sessao.fechado_por}</strong> em {dataHora(rel.sessao.fechado_em)}
          </>
        )}
      </p>

      {!parcial && dif !== null && (
        <div
          className={`rounded-xl border px-4 py-3 text-center ${
            dif === 0
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className="text-sm font-semibold">
            {dif === 0 ? 'Caixa conferido' : dif > 0 ? 'Sobra no caixa' : 'Falta no caixa'}
          </p>
          {dif !== 0 && <p className="text-3xl font-bold">{reais(Math.abs(dif))}</p>}
        </div>
      )}

      <Secao titulo={`Vendas · ${rel.vendas.quantidade} pedidos`}>
        <Linha a="Total dos pedidos" b={reais(rel.vendas.bruto)} />
        <Linha a="Descontos" b={`- ${reais(rel.vendas.descontos)}`} />
        <Linha a="Total recebido" b={reais(rel.vendas.liquido)} forte />
      </Secao>

      <Secao titulo="Formas de pagamento">
        {formas.map((f) => (
          <Linha
            key={f}
            a={`${FORMA_ROTULO[f]}${rel.formas[f]?.quantidade ? ` (${rel.formas[f].quantidade})` : ''}`}
            b={reais(rel.formas[f]?.valor ?? 0)}
          />
        ))}
        {rel.parcelas_credito.map((p) => (
          <div key={p.parcelas} className="flex justify-between py-1 pl-4 text-xs text-slate-500">
            <span>
              Crédito em {p.parcelas}x ({p.quantidade})
            </span>
            <span>{reais(p.valor)}</span>
          </div>
        ))}
      </Secao>

      <Secao titulo="Dinheiro em caixa">
        <Linha a="Troco inicial" b={reais(rel.sessao.troco_inicial)} />
        <Linha a="Vendas em dinheiro" b={`+ ${reais(rel.dinheiro_vendas)}`} />
        <Linha a="Suprimentos" b={`+ ${reais(rel.suprimentos)}`} />
        {rel.pendencias_dinheiro > 0 && (
          <Linha a="Pendências recebidas" b={`+ ${reais(rel.pendencias_dinheiro)}`} />
        )}
        <Linha a="Sangrias" b={`- ${reais(rel.sangrias)}`} />
        <Linha a="Dinheiro esperado" b={reais(rel.dinheiro_esperado)} forte />
        {!parcial && rel.sessao.dinheiro_contado !== null && (
          <Linha a="Dinheiro contado" b={reais(rel.sessao.dinheiro_contado)} forte />
        )}
      </Secao>

      {rel.movimentos.length > 0 && (
        <Secao titulo="Sangrias e suprimentos">
          {rel.movimentos.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 text-slate-700">
                {hora(m.criado_em)} · {m.tipo === 'sangria' ? 'Sangria' : m.tipo === 'suprimento' ? 'Suprimento' : 'Pendência'}
                <span className="block text-xs text-slate-500">
                  {m.motivo ?? m.cliente_nome} · {m.feito_por}
                </span>
              </span>
              <span className="shrink-0 font-medium">
                {m.tipo === 'sangria' ? '-' : '+'} {reais(m.valor)}
              </span>
            </div>
          ))}
        </Secao>
      )}

      <Secao titulo="Fiscal">
        <Linha a="Pedidos com cupom fiscal" b={String(rel.vendas.fiscal_emitidos)} />
        <Linha a="Pedidos fechados sem cupom fiscal" b={String(rel.vendas.sem_fiscal)} />
      </Secao>

      {rel.sessao.observacao && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <strong>Observação:</strong> {rel.sessao.observacao}
        </p>
      )}
    </div>
  )
}

export function BotoesRelatorio({ rel, parcial }: { rel: Relatorio; parcial: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => imprimirHtml(htmlRelatorioA4(rel, parcial))}
        className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
      >
        <Printer className="size-4" />
        Imprimir A4
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => imprimirHtml(htmlRelatorioCupom(rel, parcial))}
        className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
      >
        <Receipt className="size-4" />
        Imprimir cupom (80 mm)
      </Button>
    </div>
  )
}

export default function RelatorioDialog({
  aberto,
  onClose,
}: {
  aberto: { rel: Relatorio; parcial: boolean } | null
  onClose: () => void
}) {
  return (
    <Dialog open={aberto !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[640px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-white">
            {aberto?.parcial ? 'Relatório parcial' : 'Fechamento de caixa'}
          </DialogTitle>
          <DialogDescription className="text-sm text-white/80">
            {aberto?.parcial ? 'O caixa continua aberto' : 'Relatório do turno'}
          </DialogDescription>
        </DialogHeader>
        {aberto && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <RelatorioConteudo rel={aberto.rel} parcial={aberto.parcial} />
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <BotoesRelatorio rel={aberto.rel} parcial={aberto.parcial} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}