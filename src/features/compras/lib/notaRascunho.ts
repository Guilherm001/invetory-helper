import { lerPreco } from '@/features/comparar-precos/utils/melhorPreco'
import { lerChave, type NotaXml } from './nfe'
import type { ArquivoNota, DadosNota } from '../services/notasService'

export const MAX_ANEXOS = 6

export interface Anexo {
  id: string
  nome: string
  tipo: string
  tamanho: number
  previa: string | null // endereço local da miniatura (só fotos)
  estado: 'enviando' | 'ok' | 'erro'
  erro?: string
  arquivo?: ArquivoNota
}

// o que a pessoa está preenchendo (tudo em texto, como nos formulários)
export interface NotaRascunho {
  chave: string
  numero: string
  serie: string
  emissao: string
  valor: string
  emitenteDoc: string
  emitenteNome: string
  observacao: string
  anexos: Anexo[]
  xml: NotaXml | null
}

export const NOTA_VAZIA: NotaRascunho = {
  chave: '',
  numero: '',
  serie: '',
  emissao: '',
  valor: '',
  emitenteDoc: '',
  emitenteNome: '',
  observacao: '',
  anexos: [],
  xml: null,
}

export const notaPreenchida = (n: NotaRascunho) =>
  !!(n.chave || n.numero.trim() || n.valor.trim() || n.anexos.length > 0 || n.xml)

type Resultado = { ok: true; dados: DadosNota } | { ok: false; erro: string }

const erro = (texto: string): Resultado => ({ ok: false, erro: texto })

export function validarNota(n: NotaRascunho): Resultado {
  if (n.anexos.some((a) => a.estado === 'enviando'))
    return erro('Aguarde o envio dos arquivos terminar.')
  if (n.anexos.some((a) => a.estado === 'erro'))
    return erro('Há arquivo com erro no envio. Remova-o ou anexe de novo.')

  let numero: number | null = null
  let serie: number | null = null
  let emitenteDoc = n.emitenteDoc

  if (n.chave) {
    if (n.chave.length !== 44)
      return erro('A chave de acesso tem 44 caracteres. Complete ou apague o campo.')
    const d = lerChave(n.chave)
    if (!d) return erro('A chave de acesso é inválida. Confira os números.')
    numero = d.numero
    serie = d.serie
    emitenteDoc = emitenteDoc || d.emitente
  } else {
    const digitosNumero = n.numero.replace(/\D/g, '')
    numero = digitosNumero ? Number(digitosNumero) : null
    const digitosSerie = n.serie.replace(/\D/g, '')
    serie = digitosSerie ? Number(digitosSerie) : null
  }

  if (!numero || numero < 1 || numero > 999999999) return erro('Informe o número da nota.')
  if (serie !== null && serie > 999) return erro('A série deve ter até 3 números.')

  const valor = lerPreco(n.valor)
  if (valor === null || !Number.isFinite(valor) || valor <= 0)
    return erro('Informe o valor total da nota.')
  if (valor > 9_999_999_999) return erro('Valor da nota alto demais.')

  return {
    ok: true,
    dados: {
      chave: n.chave,
      numero,
      serie,
      emissao: n.emissao || null,
      valor,
      emitente_doc: emitenteDoc,
      emitente_nome: n.emitenteNome,
      observacao: n.observacao.trim(),
      origem: n.xml ? 'xml' : n.chave ? 'chave' : 'manual',
      arquivos: n.anexos.flatMap((a) => (a.arquivo ? [a.arquivo] : [])),
      itens: n.xml?.itens ?? [],
      duplicatas: n.xml?.duplicatas ?? [],
    },
  }
}