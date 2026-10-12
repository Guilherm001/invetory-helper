import type { DocumentoResumo, ItemDocumento } from '../services/documentosService'
import { EMPRESA, LARGURA_CUPOM_MM, linhasEmpresa } from './empresa'
import { dataCurta, dataHora, numeroTexto, reais } from './formatar'

export type FormatoImpressao = 'cupom' | 'a4'

// Largura do papel da térmica (ex.: 80 mm) e área realmente imprimível (~72 mm).
// Se o texto sair cortado, diminua o 72; se sobrar espaço, aumente.
const AREA_CUPOM_MM = Math.min(LARGURA_CUPOM_MM, 72)

const esc = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const enderecoDe = (d: DocumentoResumo) =>
  [d.endereco, d.bairro, d.cidade, d.complemento]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')

const tituloDe = (d: DocumentoResumo) => (d.documento === 'orcamento' ? 'ORÇAMENTO' : 'PEDIDO')

const qtdTexto = (i: ItemDocumento) =>
  `${numeroTexto(i.quantidade)}${i.unidade ? ` ${i.unidade}` : ''}`

// ---------- cupom (impressora térmica de 80 mm) ----------

export function htmlCupom(doc: DocumentoResumo, itens: ItemDocumento[]): string {
  const orc = doc.documento === 'orcamento'
  const end = enderecoDe(doc)

  const linhasItens = itens
    .map(
      (i) => `
    <div class="item">
      <div class="nome">${esc(i.produto_nome)}</div>
      <div class="linha"><span>${esc(qtdTexto(i))} x ${reais(i.preco_unitario)}</span><span>${reais(i.subtotal)}</span></div>
      ${i.produto_codigo ? `<div class="peq">Cód. ${esc(i.produto_codigo)}</div>` : ''}
      ${i.observacao?.trim() ? `<div class="peq">obs: ${esc(i.observacao.trim())}</div>` : ''}
    </div>`
    )
    .join('')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${tituloDe(doc)} ${doc.numero}</title>
<style>
  @page { size: 80mm size: 80mm 297mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
    body { width: ${AREA_CUPOM_MM}mm; padding: 3mm 2mm 14mm 5mm; color: #000;
      font-family: "Courier New", Courier, monospace; font-size: 12px; font-weight: 700;
      line-height: 1.3; }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .marca { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
  .peq { font-size: 10px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .linha { display: flex; justify-content: space-between; gap: 6px; }
  .item { margin: 5px 0; }
  .nome { font-weight: 700; word-break: break-word; }
  .total { font-size: 16px; font-weight: 700; }
  .txt { white-space: pre-wrap; word-break: break-word; }
  .rodape { text-align: center; font-size: 10px; margin-top: 8px; }
</style></head>
<body>
  <div class="c marca">GROWLIM</div>
  ${linhasEmpresa().map((l) => `<div class="c peq">${esc(l)}</div>`).join('')}
  <hr>
  <div class="c b" style="font-size:15px">${tituloDe(doc)} Nº ${doc.numero}</div>
  <div class="c">${esc(dataHora(doc.criado_em))}</div>
  ${orc && doc.validade ? `<div class="c b">Válido até ${dataCurta(doc.validade)}</div>` : ''}
  ${doc.orcamento_numero !== null ? `<div class="c peq">Origem: orçamento nº ${doc.orcamento_numero}</div>` : ''}
  <hr>
  <div><span class="b">Cliente:</span> ${esc(doc.cliente_nome) || 'Não informado'}</div>
  ${doc.cliente_telefone ? `<div><span class="b">Tel:</span> ${esc(doc.cliente_telefone)}</div>` : ''}
  <div class="b" style="margin-top:4px">${doc.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA NA LOJA'}</div>
  ${doc.tipo === 'entrega' ? `<div class="txt">${esc(end) || 'Endereço não informado'}</div>` : ''}
  <hr>
  <div class="b">ITENS (${itens.length})</div>
  ${linhasItens}
  <hr>
  <div class="linha total"><span>TOTAL</span><span>${reais(doc.total)}</span></div>
  ${doc.pagamento ? `<div style="margin-top:4px"><span class="b">Pagamento:</span> ${esc(doc.pagamento)}</div>` : ''}
  ${doc.observacao?.trim() ? `<div style="margin-top:4px"><span class="b">Obs:</span> <span class="txt">${esc(doc.observacao.trim())}</span></div>` : ''}
  <hr>
  ${doc.vendedor_nome ? `<div class="peq">Atendente: ${esc(doc.vendedor_nome)}</div>` : ''}
  <div class="rodape">Documento sem valor fiscal.${EMPRESA.rodape ? `<br>${esc(EMPRESA.rodape)}` : ''}</div>
</body></html>`
}

// ---------- A4 ----------

export function htmlA4(doc: DocumentoResumo, itens: ItemDocumento[]): string {
  const orc = doc.documento === 'orcamento'
  const end = enderecoDe(doc)

  const linhas = itens
    .map(
      (i) => `
      <tr>
        <td><strong>${esc(qtdTexto(i))}</strong></td>
        <td>${esc(i.produto_nome)}
          ${i.produto_codigo ? `<div class="cod">Cód. ${esc(i.produto_codigo)}</div>` : ''}
          ${i.observacao?.trim() ? `<div class="obsi">obs: ${esc(i.observacao.trim())}</div>` : ''}
        </td>
        <td class="r">${reais(i.preco_unitario)}</td>
        <td class="r"><strong>${reais(i.subtotal)}</strong></td>
      </tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${tituloDe(doc)} ${doc.numero}</title>
<style>
  @page { size: A4; margin: 20mm 14mm 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #1e293b; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end;
          padding-bottom: 8px; border-bottom: 3px solid #079C9C; }
  .marca { font-size: 30px; font-weight: 800; line-height: 1; }
  .g { color: #079C9C; } .l { color: #6b7280; }
  .empresa { margin-top: 4px; font-size: 10px; color: #64748b; }
  .doc { text-align: right; }
  .doc .t { font-size: 18px; font-weight: 700; }
  .doc .s { color: #64748b; margin-top: 2px; }
  .blocos { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 14px 0 10px; }
  .rotulo { margin-bottom: 3px; font-size: 10px; font-weight: 700; letter-spacing: .06em;
            text-transform: uppercase; color: #94a3b8; }
  .nome { font-size: 14px; font-weight: 700; }
  table { width: 100%; margin-top: 6px; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { padding: 7px 8px; background: #f1f5f9; color: #64748b; font-size: 10px; text-align: left;
       text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .r { text-align: right; }
  .cod { margin-top: 2px; font-size: 10px; color: #94a3b8; }
  .obsi { margin-top: 2px; font-size: 11px; font-style: italic; color: #64748b; }
  .total { display: flex; justify-content: space-between; align-items: center; width: 270px;
           margin: 14px 0 0 auto; padding: 10px 14px; border-radius: 6px;
           background: #079C9C; color: #fff; page-break-inside: avoid; }
  .total .v { font-size: 20px; font-weight: 800; }
  .caixa { margin-top: 14px; page-break-inside: avoid; }
  .txt { white-space: pre-wrap; }
  .rodape { margin-top: 26px; padding-top: 8px; border-top: 1px solid #e2e8f0;
            display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
</style></head>
<body>
  <div class="topo">
    <div>
      <div class="marca"><span class="g">GROW</span><span class="l">LIM</span></div>
      ${linhasEmpresa().map((l) => `<div class="empresa">${esc(l)}</div>`).join('')}
    </div>
    <div class="doc">
      <div class="t">${tituloDe(doc)} Nº ${doc.numero}</div>
      <div class="s">${esc(dataHora(doc.criado_em))}</div>
      ${orc && doc.validade ? `<div class="s">Válido até ${dataCurta(doc.validade)}</div>` : ''}
      ${doc.orcamento_numero !== null ? `<div class="s">Origem: orçamento nº ${doc.orcamento_numero}</div>` : ''}
    </div>
  </div>

  <div class="blocos">
    <div>
      <div class="rotulo">Cliente</div>
      <div class="nome">${esc(doc.cliente_nome) || 'Não informado'}</div>
      ${doc.cliente_telefone ? `<div>${esc(doc.cliente_telefone)}</div>` : ''}
    </div>
    <div>
      <div class="rotulo">${doc.tipo === 'entrega' ? 'Entrega' : 'Retirada'}</div>
      ${doc.tipo === 'entrega'
      ? `<div class="txt">${esc(end) || 'Endereço não informado'}</div>`
      : '<div>Retirada na loja</div>'
    }
    </div>
  </div>

  <table>
    <thead><tr><th style="width:80px">Qtd</th><th>Produto</th><th class="r" style="width:100px">Preço un.</th><th class="r" style="width:110px">Subtotal</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <div class="total"><span>Total</span><span class="v">${reais(doc.total)}</span></div>

  ${doc.pagamento ? `<div class="caixa"><div class="rotulo">Pagamento</div><div>${esc(doc.pagamento)}</div></div>` : ''}
  ${doc.observacao?.trim() ? `<div class="caixa"><div class="rotulo">Observação</div><div class="txt">${esc(doc.observacao.trim())}</div></div>` : ''}

  <div class="rodape">
    <span>Documento sem valor fiscal.${doc.vendedor_nome ? ` Atendido por ${esc(doc.vendedor_nome)}.` : ''}</span>
    <span>${EMPRESA.rodape ? esc(EMPRESA.rodape) : ''}</span>
  </div>
</body></html>`
}

// ---------- impressão pelo navegador ----------

// imprime o HTML num quadro escondido, sem abrir outra aba
export function imprimirHtml(html: string) {
  const quadro = document.createElement('iframe')
  quadro.setAttribute('aria-hidden', 'true')
  // fora da tela, mas com tamanho real (um iframe 0x0 pode imprimir em branco)
  quadro.style.cssText =
    'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0'
  document.body.appendChild(quadro)

  const janela = quadro.contentWindow
  const documento = quadro.contentDocument
  if (!janela || !documento) {
    quadro.remove()
    throw new Error('Não foi possível preparar a impressão neste navegador.')
  }

  documento.open()
  documento.write(html)
  documento.close()

  const limpar = () => {
    quadro.remove()
    window.focus()
  }
  janela.onafterprint = () => setTimeout(limpar, 500)

  // dá um instante para o conteúdo ser desenhado antes de imprimir
  setTimeout(() => {
    try {
      janela.focus()
      janela.print()
    } finally {
      setTimeout(limpar, 500)
    }
  }, 250)
}

export function imprimirDocumento(
  doc: DocumentoResumo,
  itens: ItemDocumento[],
  formato: FormatoImpressao
) {
  imprimirHtml(formato === 'cupom' ? htmlCupom(doc, itens) : htmlA4(doc, itens))
}