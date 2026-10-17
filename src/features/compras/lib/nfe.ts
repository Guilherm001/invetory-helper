// Chave de acesso (44 posições) e leitura do XML da NF-e.

export const limparChave = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 44)

// grupos de 4, sem espaço sobrando no fim (apagar continua funcionando)
export const formatarChave = (c: string) => c.replace(/(.{4})(?=.)/g, '$1 ')

const soAlfanum = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')

// 6 números (UF e ano/mês) + CNPJ de 14 (os 12 primeiros podem ter letras) + 24 números
const PADRAO_CHAVE = /^\d{6}[0-9A-Z]{12}\d{26}$/

// dígito verificador: módulo 11, pesos de 2 a 9 da direita para a esquerda.
// Cada caractere vale o código ASCII menos 48 (igual ao CNPJ novo).
export function chaveValida(chave: string) {
  if (!PADRAO_CHAVE.test(chave)) return false

  let soma = 0
  let peso = 2
  for (let i = 42; i >= 0; i--) {
    soma += (chave.charCodeAt(i) - 48) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  const dv = resto < 2 ? 0 : 11 - resto
  return dv === Number(chave[43])
}

export interface DadosDaChave {
  uf: string
  anoMes: string
  emitente: string
  modelo: string
  serie: number
  numero: number
}

export function lerChave(chave: string): DadosDaChave | null {
  if (!chaveValida(chave)) return null
  return {
    uf: chave.slice(0, 2),
    anoMes: chave.slice(2, 6),
    emitente: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    serie: Number(chave.slice(22, 25)),
    numero: Number(chave.slice(25, 34)),
  }
}

export const UF_POR_CODIGO: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

// "0805" (ano 08, mês 05) -> "05/2008"
export const mesAnoDaChave = (anoMes: string) => `${anoMes.slice(2)}/20${anoMes.slice(0, 2)}`

// ---------- XML ----------

export interface ItemNota {
  codigo: string
  ean: string
  nome: string
  unidade: string
  quantidade: number
  preco: number // unitário, já sem o desconto do item
  subtotal: number
}

export interface DuplicataNota {
  numero: string
  vencimento: string | null // AAAA-MM-DD
  valor: number
}

export interface NotaXml {
  chave: string
  numero: number
  serie: number
  emissao: string | null
  emitenteDoc: string
  emitenteNome: string
  valor: number
  duplicatas: DuplicataNota[]
  itens: ItemNota[]
  autorizada: boolean | null // null = o arquivo não traz o protocolo de autorização
}

type Raiz = Document | Element

const primeiro = (raiz: Raiz | null, nome: string): Element | null =>
  raiz ? (raiz.getElementsByTagNameNS('*', nome)[0] ?? null) : null

const valorDe = (raiz: Raiz | null, nome: string) =>
  primeiro(raiz, nome)?.textContent?.trim() ?? ''

const paraNumero = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const arred2 = (n: number) => Math.round(n * 100) / 100
const arred4 = (n: number) => Math.round(n * 10000) / 10000

export function lerXmlNfe(conteudo: string): NotaXml {
  const doc = new DOMParser().parseFromString(conteudo, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('O arquivo não é um XML válido.')
  }

  const inf = primeiro(doc, 'infNFe')
  if (!inf) throw new Error('Este arquivo não parece ser uma NF-e (não achei os dados da nota).')

  let chave = limparChave((inf.getAttribute('Id') ?? '').replace(/^NFe/i, ''))
  if (chave.length !== 44) chave = limparChave(valorDe(doc, 'chNFe'))

  const dados = lerChave(chave)
  if (!dados) throw new Error('A chave de acesso do XML é inválida.')

  const ide = primeiro(inf, 'ide')
  const emit = primeiro(inf, 'emit')
  const tot = primeiro(inf, 'ICMSTot')

  const valor = arred2(paraNumero(valorDe(tot, 'vNF')))
  if (!(valor > 0)) throw new Error('O XML não traz o valor total da nota.')

  const emissaoBruta = valorDe(ide, 'dhEmi') || valorDe(ide, 'dEmi')
  const emissao = /^\d{4}-\d{2}-\d{2}/.test(emissaoBruta) ? emissaoBruta.slice(0, 10) : null

  const itens: ItemNota[] = Array.from(inf.getElementsByTagNameNS('*', 'det'))
    .map((det) => {
      const prod = primeiro(det, 'prod')
      const q = paraNumero(valorDe(prod, 'qCom'))
      const liquido = paraNumero(valorDe(prod, 'vProd')) - paraNumero(valorDe(prod, 'vDesc'))
      const ean = valorDe(prod, 'cEAN')
      return {
        codigo: valorDe(prod, 'cProd'),
        ean: /^\d{8,14}$/.test(ean) ? ean : '', // "SEM GTIN" vira vazio
        nome: valorDe(prod, 'xProd'),
        unidade: valorDe(prod, 'uCom'),
        quantidade: q,
        preco: q > 0 ? arred4(liquido / q) : 0,
        subtotal: arred2(liquido),
      }
    })
    .filter((i) => i.nome && i.quantidade > 0)

  const duplicatas: DuplicataNota[] = Array.from(inf.getElementsByTagNameNS('*', 'dup'))
    .map((d) => {
      const venc = valorDe(d, 'dVenc')
      return {
        numero: valorDe(d, 'nDup'),
        vencimento: /^\d{4}-\d{2}-\d{2}$/.test(venc) ? venc : null,
        valor: arred2(paraNumero(valorDe(d, 'vDup'))),
      }
    })
    .filter((d) => d.valor > 0)

  const cStat = valorDe(primeiro(doc, 'infProt'), 'cStat')

  return {
    chave,
    numero: dados.numero,
    serie: dados.serie,
    emissao,
    emitenteDoc: soAlfanum(valorDe(emit, 'CNPJ') || valorDe(emit, 'CPF')),
    emitenteNome: valorDe(emit, 'xNome').slice(0, 200),
    valor,
    duplicatas,
    itens,
    autorizada: cStat ? cStat === '100' || cStat === '150' : null,
  }
}