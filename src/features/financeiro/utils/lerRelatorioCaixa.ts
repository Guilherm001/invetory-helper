import { arredondar, decodificarCp850, lerNumero } from './decodificar'
import type { DiaCaixa, ResultadoCaixa } from './tipos'

const LINHA_PEDIDO = /^\s*(\d{4}-\d{3})\s*\|(\d{2})\/(\d{2})\/(\d{4})\|(\w+)\|(.+)$/
const VALOR = /\d{1,3}(?:\.\d{3})*,\d{2}/g

export function lerRelatorioCaixa(buffer: ArrayBuffer): ResultadoCaixa {
  const linhas = decodificarCp850(buffer).split(/\r?\n/)
  const avisos: string[] = []
  const porDia = new Map<string, DiaCaixa>()
  const vistos = new Set<string>()

  if (!linhas.some((l) => l.includes('RELATORIO DO CAIXA'))) {
    throw new Error('Este arquivo não parece ser o Relatório do Caixa (pedidos fechados).')
  }

  let totalRodape: number | null = null
  let totalPendencia: number | null = null
  let clientesEmAberto = 0
  let naPendencia = false

  for (const linha of linhas) {
    // ---------- pedidos ----------
    const m = LINHA_PEDIDO.exec(linha)
    if (m && !naPendencia) {
      const [, pedido, d, mes, a, origem, resto] = m
      if (vistos.has(pedido)) {
        avisos.push(`Pedido ${pedido} aparece duas vezes. Só a primeira foi contada.`)
        continue
      }
      vistos.add(pedido)

      const c = resto.split('|').map((x) => x.trim())
      const [din, pix, chq, dup, car, tot, dc] = c.slice(0, 7).map(lerNumero)
      if ([din, pix, chq, dup, car, tot, dc].some(Number.isNaN)) {
        avisos.push(`Pedido ${pedido}: não consegui ler os valores. Ignorado.`)
        continue
      }

      const dia = `${a}-${mes}-${d}`
      const atual = porDia.get(dia) ?? {
        dia, dinheiro: 0, pix: 0, cheque: 0, duplicata: 0, cartao: 0,
        creditoConta: 0, totalCaixa: 0, pedidos: 0, maiorPedido: 0,
        pendenciasPagas: 0, pedidosPendencia: 0, pendencia: null,
      }
      atual.dinheiro += din
      atual.pix += pix
      atual.cheque += chq
      atual.duplicata += dup
      atual.cartao += car
      atual.creditoConta += dc
      atual.totalCaixa += tot

      if (origem === 'PDC') {
        // pagamento de fiado de outros dias: entra no caixa, mas não é venda de hoje
        atual.pendenciasPagas += tot
        atual.pedidosPendencia += 1
      } else {
        if (origem !== 'RES') {
          avisos.push(`Pedido ${pedido}: origem "${origem}" desconhecida. Contado como venda.`)
        }
        atual.pedidos += 1
        atual.maiorPedido = Math.max(atual.maiorPedido, tot)
      }
      porDia.set(dia, atual)
      continue
    }

    // ---------- total do rodapé (sete valores seguidos) ----------
    if (!naPendencia && totalRodape === null && !linha.includes('|')) {
      const v = linha.match(VALOR)
      if (v && v.length >= 6 && linha.trim().replace(VALOR, '').trim() === '') {
        totalRodape = lerNumero(v[5])
        continue
      }
    }

    // ---------- pendências (fiado feito no período) ----------
    if (linha.includes('PENDENCIA DO PERIODO')) {
      naPendencia = true
      continue
    }
    if (naPendencia) {
      if (/TOTAL PENDENCIA/.test(linha)) {
        const v = linha.match(VALOR)
        if (v) totalPendencia = lerNumero(v[0])
      } else if (/^\s*\d+\|.+\|\s*[\d.]+,\d{2}\|/.test(linha)) {
        clientesEmAberto++
      }
    }
  }

  const dias = [...porDia.values()]
    .map((d) => ({
      ...d,
      dinheiro: arredondar(d.dinheiro),
      pix: arredondar(d.pix),
      cheque: arredondar(d.cheque),
      duplicata: arredondar(d.duplicata),
      cartao: arredondar(d.cartao),
      creditoConta: arredondar(d.creditoConta),
      totalCaixa: arredondar(d.totalCaixa),
      pendenciasPagas: arredondar(d.pendenciasPagas),
      maiorPedido: arredondar(d.maiorPedido),
    }))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  if (dias.length === 0) throw new Error('Nenhum pedido encontrado no arquivo.')

  // o rodapé do relatório precisa bater com a soma que eu fiz
  const soma = arredondar(dias.reduce((s, d) => s + d.totalCaixa, 0))
  if (totalRodape !== null && Math.abs(soma - totalRodape) > 0.01) {
    avisos.push(
      `A soma dos pedidos (${soma.toFixed(2)}) não bate com o total do relatório (${totalRodape.toFixed(2)}). Confira o arquivo.`
    )
  }

  // a pendência não vem separada por dia: só dá para atribuir se o relatório for de um dia
  if (totalPendencia !== null) {
    if (dias.length === 1) dias[0].pendencia = arredondar(totalPendencia)
    else
      avisos.push(
        'O relatório cobre mais de um dia, então o fiado feito no período não foi atribuído a nenhum deles. Importe dia a dia.'
      )
  }

  return { dias, clientesEmAberto, avisos }
}