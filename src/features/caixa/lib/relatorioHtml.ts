import { EMPRESA, LARGURA_CUPOM_MM, linhasEmpresa } from '@/features/loja/lib/empresa'
import type { Relatorio } from '../types'
import { dataHora, FORMA_ROTULO, hora, reais } from './formatar'

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ORDEM = ['dinheiro', 'pix', 'debito', 'credito', 'credito_cliente', 'pendencia']
const SEMPRE = ['dinheiro', 'pix', 'debito', 'credito']

function formasDe(rel: Relatorio) {
  return ORDEM.map((id) => ({
    id,
    rotulo: FORMA_ROTULO[id],
    quantidade: rel.formas[id]?.quantidade ?? 0,
    valor: rel.formas[id]?.valor ?? 0,
  })).filter((f) => f.valor > 0 || SEMPRE.includes(f.id))
}

const titulo = (parcial: boolean) => (parcial ? 'RELATÓRIO PARCIAL' : 'FECHAMENTO DE CAIXA')
const sinal = (v: number) => (v > 0 ? `+ ${reais(v)}` : v < 0 ? `- ${reais(Math.abs(v))}` : reais(0))

// linhas do quadro de dinheiro, na ordem em que a conta é feita
function quadroDinheiro(rel: Relatorio, parcial: boolean): [string, string][] {
  const l: [string, string][] = [
    ['Troco inicial', reais(rel.sessao.troco_inicial)],
    ['Vendas em dinheiro', `+ ${reais(rel.dinheiro_vendas)}`],
    ['Suprimentos', `+ ${reais(rel.suprimentos)}`],
  ]
  if (rel.pendencias_dinheiro > 0) l.push(['Pendências recebidas', `+ ${reais(rel.pendencias_dinheiro)}`])
  l.push(['Sangrias', `- ${reais(rel.sangrias)}`])
  l.push(['Dinheiro esperado', reais(rel.dinheiro_esperado)])
  if (!parcial && rel.sessao.dinheiro_contado !== null) {
    l.push(['Dinheiro contado', reais(rel.sessao.dinheiro_contado)])
    l.push(['Diferença', sinal(rel.sessao.diferenca ?? 0)])
  }
  return l
}

// ---------- cupom de 80 mm ----------

export function htmlRelatorioCupom(rel: Relatorio, parcial: boolean): string {
  const par = (a: string, b: string) => `<div class="l"><span>${esc(a)}</span><span>${esc(b)}</span></div>`

  const formas = formasDe(rel)
    .map((f) => par(`${f.rotulo}${f.quantidade ? ` (${f.quantidade})` : ''}`, reais(f.valor)))
    .join('')

  const parcelas = rel.parcelas_credito
    .map((p) => par(`  ${p.parcelas}x (${p.quantidade})`, reais(p.valor)))
    .join('')

  const movs = rel.movimentos
    .map(
      (m) =>
        par(
          `${hora(m.criado_em)} ${m.tipo === 'sangria' ? 'Sangria' : m.tipo === 'suprimento' ? 'Suprimento' : 'Pendência'}`,
          `${m.tipo === 'sangria' ? '-' : '+'} ${reais(m.valor)}`
        ) + `<div class="p">${esc(m.motivo ?? m.cliente_nome ?? '')} · ${esc(m.feito_por)}</div>`
    )
    .join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo(parcial)}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${LARGURA_CUPOM_MM}mm; padding: 2mm 1mm 14mm; color: #000;
         font-family: "Courier New", Courier, monospace; font-size: 12px; line-height: 1.3; }
  .c { text-align: center; } .b { font-weight: 700; } .p { font-size: 10px; margin-bottom: 3px; }
  .m { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .l { display: flex; justify-content: space-between; gap: 6px; }
  .t { font-weight: 700; margin-top: 4px; }
</style></head><body>
  <div class="c m">GROWLIM</div>
  ${linhasEmpresa().map((x) => `<div class="c p">${esc(x)}</div>`).join('')}
  <hr>
  <div class="c b" style="font-size:14px">${titulo(parcial)}</div>
  <div class="p">Aberto por ${esc(rel.sessao.aberto_por)} em ${esc(dataHora(rel.sessao.aberto_em))}</div>
  ${rel.sessao.fechado_em ? `<div class="p">Fechado por ${esc(rel.sessao.fechado_por)} em ${esc(dataHora(rel.sessao.fechado_em))}</div>` : `<div class="p">Emitido em ${esc(dataHora(new Date().toISOString()))}</div>`}
  <hr>
  <div class="t">VENDAS (${rel.vendas.quantidade} pedidos)</div>
  ${par('Total dos pedidos', reais(rel.vendas.bruto))}
  ${par('Descontos', `- ${reais(rel.vendas.descontos)}`)}
  <div class="l b"><span>Total recebido</span><span>${reais(rel.vendas.liquido)}</span></div>
  <hr>
  <div class="t">FORMAS DE PAGAMENTO</div>
  ${formas}
    ${parcelas ? `<div class="p">Crédito parcelado:</div>${parcelas}` : ''}
  ${rel.pendencias_recebidas.total > 0 ? `<hr><div class="t">PENDÊNCIAS RECEBIDAS</div>${Object.entries(rel.pendencias_recebidas.formas).map(([f, v]) => par(FORMA_ROTULO[f] ?? f, reais(v))).join('')}${par('Total', reais(rel.pendencias_recebidas.total))}` : ''}
  ${rel.devolucoes.quantidade > 0 ? `<hr><div class="t">DEVOLUÇÕES</div>${par(`Crédito lançado (${rel.devolucoes.quantidade})`, reais(rel.devolucoes.total))}` : ''}
  <hr>
  <div class="t">DINHEIRO EM CAIXA</div>
  ${quadroDinheiro(rel, parcial).map(([a, b]) => par(a, b)).join('')}
  ${movs ? `<hr><div class="t">MOVIMENTOS</div>${movs}` : ''}
  <hr>
  ${par('Cupom fiscal emitido', String(rel.vendas.fiscal_emitidos))}
  ${par('Sem cupom fiscal', String(rel.vendas.sem_fiscal))}
  ${rel.sessao.observacao ? `<hr><div class="p">Obs: ${esc(rel.sessao.observacao)}</div>` : ''}
  <hr><div class="c p">Documento de conferência interna${EMPRESA.rodape ? '' : ''}</div>
</body></html>`
}

// ---------- A4 ----------

export function htmlRelatorioA4(rel: Relatorio, parcial: boolean): string {
  const formas = formasDe(rel)
    .map(
      (f) =>
        `<tr><td>${esc(f.rotulo)}</td><td class="r">${f.quantidade}</td><td class="r">${reais(f.valor)}</td></tr>`
    )
    .join('')

  const parcelas = rel.parcelas_credito
    .map(
      (p) =>
        `<tr class="sub"><td>&nbsp;&nbsp;Crédito em ${p.parcelas}x</td><td class="r">${p.quantidade}</td><td class="r">${reais(p.valor)}</td></tr>`
    )
    .join('')

  const dinheiro = quadroDinheiro(rel, parcial)
    .map(([a, b], i, arr) => {
      const forte = a === 'Dinheiro esperado' || a === 'Diferença'
      return `<tr${forte ? ' class="forte"' : ''}><td>${esc(a)}</td><td class="r">${esc(b)}</td></tr>`
    })
    .join('')

  const movs = rel.movimentos
    .map(
      (m) =>
        `<tr><td>${esc(hora(m.criado_em))}</td><td>${m.tipo === 'sangria' ? 'Sangria' : m.tipo === 'suprimento' ? 'Suprimento' : 'Pendência'}</td><td>${esc(m.motivo ?? m.cliente_nome ?? '')}</td><td>${esc(m.feito_por)}</td><td class="r">${m.tipo === 'sangria' ? '-' : '+'} ${reais(m.valor)}</td></tr>`
    )
    .join('')

  const pedidos = rel.pedidos
    .map(
      (p) =>
        `<tr><td>${p.numero}</td><td>${esc(hora(p.fechado_em))}</td><td>${esc(p.cliente_nome) || '—'}</td><td>${esc(p.pagamento)}</td><td>${p.fiscal_status === 'emitido' ? 'Fiscal' : '—'}</td><td class="r">${p.desconto > 0 ? `- ${reais(p.desconto)}` : ''}</td><td class="r">${reais(p.total_liquido)}</td></tr>`
    )
    .join('')

  const dif = rel.sessao.diferenca

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo(parcial)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; padding: 0 14mm; color: #1e293b; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
  .pagina { width: 100%; border-collapse: collapse; }
  .pagina > thead > tr > td, .pagina > tbody > tr > td, .pagina > tfoot > tr > td { padding: 0; border: 0; }
  .pagina > thead { display: table-header-group; } .pagina > tfoot { display: table-footer-group; }
  .topo-esp { height: 14mm; } .base-esp { height: 16mm; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 8px; border-bottom: 3px solid #079C9C; }
  .marca { font-size: 28px; font-weight: 800; line-height: 1; } .g { color: #079C9C; } .l { color: #6b7280; }
  .doc { text-align: right; } .doc .t { font-size: 17px; font-weight: 700; } .doc .s { color: #64748b; margin-top: 2px; }
  h3 { margin: 18px 0 6px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
  table.tab { width: 100%; border-collapse: collapse; }
  .tab th { padding: 6px 8px; background: #f1f5f9; color: #64748b; font-size: 10px; text-align: left; text-transform: uppercase; }
  .tab td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  .tab tr { page-break-inside: avoid; } .r { text-align: right; } .sub td { color: #64748b; font-size: 11px; }
  .forte td { font-weight: 700; background: #f8fafc; }
  .cards { display: flex; gap: 10px; margin-top: 14px; }
  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .card .k { font-size: 10px; text-transform: uppercase; color: #64748b; } .card .v { font-size: 18px; font-weight: 800; margin-top: 2px; }
  .ok { color: #047857; } .ruim { color: #b91c1c; }
  .rodape { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
</style></head><body>
<table class="pagina">
  <thead><tr><td><div class="topo-esp"></div></td></tr></thead>
  <tfoot><tr><td><div class="base-esp"></div></td></tr></tfoot>
  <tbody><tr><td>
    <div class="topo">
      <div>
        <div class="marca"><span class="g">GROW</span><span class="l">LIM</span></div>
        ${linhasEmpresa().map((x) => `<div style="font-size:10px;color:#64748b;margin-top:3px">${esc(x)}</div>`).join('')}
      </div>
      <div class="doc">
        <div class="t">${titulo(parcial)}</div>
        <div class="s">Aberto por ${esc(rel.sessao.aberto_por)} em ${esc(dataHora(rel.sessao.aberto_em))}</div>
        <div class="s">${rel.sessao.fechado_em ? `Fechado por ${esc(rel.sessao.fechado_por)} em ${esc(dataHora(rel.sessao.fechado_em))}` : `Emitido em ${esc(dataHora(new Date().toISOString()))}`}</div>
      </div>
    </div>

    <div class="cards">
      <div class="card"><div class="k">Pedidos fechados</div><div class="v">${rel.vendas.quantidade}</div></div>
      <div class="card"><div class="k">Total dos pedidos</div><div class="v">${reais(rel.vendas.bruto)}</div></div>
      <div class="card"><div class="k">Descontos</div><div class="v">- ${reais(rel.vendas.descontos)}</div></div>
      <div class="card"><div class="k">Total vendido</div><div class="v">${reais(rel.vendas.liquido)}</div></div>
    </div>

    <h3>Formas de pagamento</h3>
    <table class="tab"><thead><tr><th>Forma</th><th class="r">Pedidos</th><th class="r">Valor</th></tr></thead>
      <tbody>${formas}${parcelas}</tbody></table>

          ${rel.pendencias_recebidas.total > 0 ? `<h3>Pendências recebidas</h3><table class="tab"><tbody>${Object.entries(rel.pendencias_recebidas.formas).map(([f, v]) => `<tr><td>${esc(FORMA_ROTULO[f] ?? f)}</td><td class="r">${reais(v)}</td></tr>`).join('')}<tr class="forte"><td>Total</td><td class="r">${reais(rel.pendencias_recebidas.total)}</td></tr></tbody></table>` : ''}
    ${rel.devolucoes.quantidade > 0 ? `<h3>Devoluções</h3><table class="tab"><tbody><tr><td>Crédito lançado (${rel.devolucoes.quantidade})</td><td class="r">${reais(rel.devolucoes.total)}</td></tr></tbody></table>` : ''}
    <h3>Dinheiro em caixa</h3>
    <table class="tab"><tbody>${dinheiro}</tbody></table>
    ${!parcial && dif !== null ? `<p class="${dif === 0 ? 'ok' : 'ruim'}" style="font-weight:700;margin:8px 0 0">${dif === 0 ? 'Caixa conferido, sem diferença.' : dif > 0 ? `Sobra de ${reais(dif)} no caixa.` : `Falta de ${reais(Math.abs(dif))} no caixa.`}</p>` : ''}

    ${movs ? `<h3>Sangrias e suprimentos</h3><table class="tab"><thead><tr><th>Hora</th><th>Tipo</th><th>Motivo</th><th>Por</th><th class="r">Valor</th></tr></thead><tbody>${movs}</tbody></table>` : ''}

    <h3>Fiscal</h3>
    <table class="tab"><tbody>
      <tr><td>Pedidos com cupom fiscal</td><td class="r">${rel.vendas.fiscal_emitidos}</td></tr>
      <tr><td>Pedidos fechados sem cupom fiscal</td><td class="r">${rel.vendas.sem_fiscal}</td></tr>
    </tbody></table>

    ${pedidos ? `<h3>Pedidos fechados</h3><table class="tab"><thead><tr><th>Nº</th><th>Hora</th><th>Cliente</th><th>Pagamento</th><th>Fiscal</th><th class="r">Desconto</th><th class="r">Total</th></tr></thead><tbody>${pedidos}</tbody></table>` : ''}

    ${rel.sessao.observacao ? `<h3>Observação</h3><div>${esc(rel.sessao.observacao)}</div>` : ''}

    <div class="rodape">Documento de conferência interna, sem valor fiscal.</div>
  </td></tr></tbody>
</table>
</body></html>`
}