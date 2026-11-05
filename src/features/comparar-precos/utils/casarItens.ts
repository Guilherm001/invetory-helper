import type { ItemComparacao } from '../types'

export const IGNORAR = '__ignorar'

// ---------- normalização ----------

const ROMANOS: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
}

// palavras que não ajudam a identificar o produto (unidades, embalagem, marcas).
// Pode acrescentar marcas e termos do seu dia a dia aqui.
const RUIDO = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'em',
  'blister', 'caixa', 'cx', 'unidade', 'unidades', 'und', 'un', 'unid',
  'uv', 'br', 'pc', 'pcs', 'peca', 'pecas', 'pct', 'pacote', 'ref',
  'mm', 'cm', 'mt', 'mts', 'kg', 'ml', 'pol',
  // marcas
  'atlas', 'tigre', 'vonder', 'pitbull', 'almaflex', 'hydra', 'tramontina', 'stanley',
])

export const ehNumero = (t: string) => /^\d/.test(t)
const singular = (t: string) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)

// palavras e medidas do nome, sem acento, maiúscula, pontuação, unidades e códigos.
// "CP2" e "CP-II" -> "cp" "2"; "4,0x40", "4.0 x 40" e "4x40" -> "4" "40";
// "0,40MMX100M" -> "0.4" "100"; códigos de produto (5+ dígitos) são descartados.
export function termosDe(s: string): string[] {
  const t = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\b\d+\s*(?:pecas?|pcs?|pc|unidades?|unid|und|un)\b/g, ' ')
    .replace(/(mm|cm|ml|kg|m|g|l)x(?=\d)/g, '$1 x ')

  const saida: string[] = []
  for (const b of t.match(/\d+(?:\.\d+)?|[a-z]+/g) ?? []) {
    if (/^\d/.test(b)) {
      if (b.replace('.', '').length >= 5) continue // código/referência
      saida.push(String(Number(b)))
    } else {
      if (b.length === 1 || RUIDO.has(b)) continue
      saida.push(ROMANOS[b] ?? singular(b))
    }
  }
  return saida
}

// só para a caixa de pesquisa do seletor: não descarta nada
export function normalizarBusca(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export const chaveDe = (nome: string) => termosDe(nome).join(' ')

// ---------- semelhança entre palavras ----------

function distancia(a: string, b: string): number {
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let anterior = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = guardado
    }
  }
  return d[b.length]
}

// 1 = iguais, 0 = diferentes
function parecenca(a: string, b: string): number {
  if (a === b) return 1
  // números só valem se forem iguais ("brita 1" não é "brita 2")
  if (ehNumero(a) || ehNumero(b)) return 0

  const sa = singular(a)
  const sb = singular(b)
  if (sa === sb) return 1

  // abreviação: "cim" -> "cimento"
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.9

  // erro de digitação: "cimneto" -> "cimento"
  if (sa.length >= 4 && sb.length >= 4) {
    const limite = Math.max(sa.length, sb.length) >= 7 ? 2 : 1
    if (distancia(sa, sb) <= limite) return 0.85
  }
  return 0
}

// ---------- índice dos itens da comparação ----------

export interface ItemNorm {
  item: ItemComparacao
  termos: string[]
  chave: string
}

export interface Indice {
  itens: ItemNorm[]
  peso: Map<string, number> // palavra rara pesa mais que palavra comum
}

export function montarIndice(itens: ItemComparacao[]): Indice {
  const norm: ItemNorm[] = itens.map((item) => {
    const termos = termosDe(item.name)
    return { item, termos, chave: termos.join(' ') }
  })

  const df = new Map<string, number>()
  for (const n of norm) for (const t of new Set(n.termos)) df.set(t, (df.get(t) ?? 0) + 1)

  const N = norm.length
  const peso = new Map<string, number>()
  df.forEach((c, t) => {
    const base = 1 + Math.log((N + 1) / (c + 1))
    peso.set(t, ehNumero(t) ? base * 1.5 : base) // medida identifica mais que palavra
  })
  return { itens: norm, peso }
}

// ---------- pontuação ----------

interface Nota {
  nota: number
  exato: boolean // todas as palavras do item casaram por igualdade
  cobLinha: number
}

const ZERO: Nota = { nota: 0, exato: false, cobLinha: 0 }

function pontuar(q: string[], itemTermos: string[], indice: Indice): Nota {
  if (q.length === 0 || itemTermos.length === 0) return ZERO

  // medidas não podem se contradizer: uma lista precisa estar dentro da outra
  const nq = q.filter(ehNumero)
  const ni = itemTermos.filter(ehNumero)
  if (nq.length > 0 && ni.length > 0) {
    const qDentro = nq.every((n) => ni.includes(n))
    const iDentro = ni.every((n) => nq.includes(n))
    if (!qDentro && !iDentro) return ZERO
  }

  const peso = (t: string) => indice.peso.get(t) ?? 1
  const melhor = (t: string, lista: string[]) => Math.max(...lista.map((x) => parecenca(t, x)))

  // quanto do ITEM está explicado pela linha (o fornecedor costuma descrever mais)
  let pItem = 0
  let eItem = 0
  let exato = true
  for (const t of itemTermos) {
    const w = peso(t)
    const s = melhor(t, q)
    pItem += w
    eItem += w * s
    if (s < 1) exato = false
  }

  // quanto da LINHA está explicado pelo item
  let pLinha = 0
  let eLinha = 0
  for (const t of q) {
    const w = peso(t)
    pLinha += w
    eLinha += w * melhor(t, itemTermos)
  }

  const cobItem = eItem / pItem
  const cobLinha = eLinha / pLinha

  // pelo menos uma palavra (não só número) precisa casar
  const temPalavra = itemTermos.some((t) => !ehNumero(t))
  if (temPalavra && !itemTermos.some((t) => !ehNumero(t) && melhor(t, q) >= 0.85)) return ZERO

  if (cobItem < 0.6 && cobLinha < 0.85) return ZERO

  const nota = cobItem * 0.75 + cobLinha * 0.25
  if (nota < 0.5) return ZERO
  return { nota, exato, cobLinha }
}

// ---------- resultado ----------

export interface Achado {
  candidatos: ItemComparacao[] // do mais ao menos provável
  auto: string // id escolhido sozinho; IGNORAR; '' = o usuário decide
  aproximado: boolean // casou por semelhança, vale conferir
  lembrado: boolean // veio de uma confirmação anterior
}

export const SEM_ACHADO: Achado = { candidatos: [], auto: '', aproximado: false, lembrado: false }

export function candidatosDe(
  nome: string,
  indice: Indice,
  vinculos: Record<string, string> = {}
): Achado {
  const q = termosDe(nome)
  if (q.length === 0) return SEM_ACHADO

  const pontuados = indice.itens
    .map((n) => ({ n, ...pontuar(q, n.termos, indice) }))
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota)

  const candidatos = pontuados.slice(0, 6).map((x) => x.n.item)

  // 1) o que você já confirmou antes para este fornecedor vale mais que a semelhança
  const lembrado = vinculos[q.join(' ')]
  if (lembrado === IGNORAR) {
    return { candidatos, auto: IGNORAR, aproximado: false, lembrado: true }
  }
  if (lembrado) {
    const alvo = indice.itens.find((n) => n.chave === lembrado)
    if (alvo) {
      return {
        candidatos: [alvo.item, ...candidatos.filter((c) => c.id !== alvo.item.id)].slice(0, 6),
        auto: alvo.item.id,
        aproximado: false,
        lembrado: true,
      }
    }
  }

  if (pontuados.length === 0) return SEM_ACHADO

  // 2) escolhe sozinho só quando o primeiro é bom e está bem à frente do segundo
  const [topo, segundo] = pontuados
  const claro = topo.nota >= 0.8 && (!segundo || topo.nota - segundo.nota >= 0.1)

  return {
    candidatos,
    auto: claro ? topo.n.item.id : '',
    aproximado: claro && (!topo.exato || topo.cobLinha < 0.5),
    lembrado: false,
  }
}

// ---------- aprendizado local (por fornecedor, neste navegador) ----------
// guarda "nome da linha -> nome do item" (não o id), então vale em outras comparações

const LS = 'comparar-precos:vinculos:v1'
type Vinculos = Record<string, Record<string, string>>

function lerTudo(): Vinculos {
  try {
    const bruto = typeof window === 'undefined' ? null : window.localStorage.getItem(LS)
    const dados = bruto ? JSON.parse(bruto) : {}
    return dados && typeof dados === 'object' ? dados : {}
  } catch {
    return {}
  }
}

export function carregarVinculos(fornecedorId: string): Record<string, string> {
  if (!fornecedorId) return {}
  return lerTudo()[fornecedorId] ?? {}
}

export function salvarVinculos(
  fornecedorId: string,
  itens: ItemComparacao[],
  pares: { nome: string; itemId: string }[]
) {
  if (!fornecedorId || pares.length === 0) return
  try {
    const tudo = lerTudo()
    const mapa = tudo[fornecedorId] ?? {}
    for (const p of pares) {
      const k = chaveDe(p.nome)
      if (!k) continue
      if (p.itemId === IGNORAR) {
        mapa[k] = IGNORAR
        continue
      }
      const item = itens.find((i) => i.id === p.itemId)
      const v = item ? chaveDe(item.name) : ''
      if (v) mapa[k] = v
    }
    tudo[fornecedorId] = mapa
    window.localStorage.setItem(LS, JSON.stringify(tudo))
  } catch {
    // sem localStorage (modo privado, cheio): só não aprende
  }
}