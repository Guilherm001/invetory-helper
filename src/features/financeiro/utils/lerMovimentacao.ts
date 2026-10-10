import { arredondar, decodificarWindows1252, lerNumero } from './decodificar'
import type { ItemMovimento, ResultadoMovimentacao } from './tipos'

// CSV com ";" e aspas ("" dentro de aspas = uma aspa)
function dividirLinha(linha: string): string[] {
  const campos: string[] = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (aspas) {
      if (ch === '"' && linha[i + 1] === '"') {
        atual += '"'
        i++
      } else if (ch === '"') aspas = false
      else atual += ch
    } else if (ch === '"') aspas = true
    else if (ch === ';') {
      campos.push(atual)
      atual = ''
    } else atual += ch
  }
  campos.push(atual)
  return campos
}

export function lerMovimentacao(buffer: ArrayBuffer): ResultadoMovimentacao {
  const linhas = decodificarWindows1252(buffer).split(/\r?\n/).filter((l) => l.trim() !== '')
  const avisos: string[] = []

  const cab = (linhas[0] ?? '').toUpperCase()
  if (!cab.startsWith('CODIGO;DESCRICAO;ENTRADA;SAIDA')) {
    throw new Error('Este arquivo não parece ser o relatório de movimentação (CODIGO;DESCRICAO;ENTRADA;SAIDA...).')
  }

  const porCodigo = new Map<string, ItemMovimento>()

  for (const linha of linhas.slice(1)) {
    const c = dividirLinha(linha)
    if (c.length < 7) {
      avisos.push(`Linha ignorada (formato inesperado): ${linha.slice(0, 50)}`)
      continue
    }
    const codigo = c[0].trim()
    const [entrada, saida, , custoMedio] = [c[2], c[3], c[4], c[5]].map(lerNumero)
    if (!codigo || [entrada, saida, custoMedio].some(Number.isNaN)) {
      avisos.push(`Linha ignorada (valores inválidos): ${linha.slice(0, 50)}`)
      continue
    }
    if (entrada === 0 && saida === 0) continue

    const existente = porCodigo.get(codigo)
    if (existente) {
      existente.entrada += entrada
      existente.saida += saida
      avisos.push(`Código ${codigo} aparece mais de uma vez. As quantidades foram somadas.`)
    } else {
      porCodigo.set(codigo, {
        codigo,
        descricao: c[1].trim(),
        entrada,
        saida,
        custoMedio,
      })
    }
  }

  const itens = [...porCodigo.values()]
  if (itens.length === 0) throw new Error('Nenhuma movimentação encontrada no arquivo.')

  return {
    itens,
    custoSaidas: arredondar(itens.reduce((s, i) => s + i.saida * i.custoMedio, 0)),
    custoEntradas: arredondar(itens.reduce((s, i) => s + i.entrada * i.custoMedio, 0)),
    unidadesSaidas: arredondar(itens.reduce((s, i) => s + i.saida, 0)),
    avisos,
  }
}