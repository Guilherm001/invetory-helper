import { supabase } from '@/lib/supabase'
import type { DuplicataNota, ItemNota } from '../lib/nfe'

const BUCKET = 'notas-compra'

export interface ArquivoNota {
  path: string
  nome: string
  tipo: string
  tamanho: number
}

export interface DadosNota {
  chave: string
  numero: number
  serie: number | null
  emissao: string | null
  valor: number
  emitente_doc: string
  emitente_nome: string
  observacao: string
  origem: 'manual' | 'chave' | 'xml'
  arquivos: ArquivoNota[]
  itens: ItemNota[]
  duplicatas: DuplicataNota[]
}

export interface NotaCompra {
  id: string
  pedido_id: string
  numero: number
  serie: number | null
  chave: string | null
  emissao: string | null
  valor: number
  emitente_doc: string | null
  emitente_nome: string | null
  observacao: string | null
  origem: 'manual' | 'chave' | 'xml'
  arquivos: ArquivoNota[]
  itens: ItemNota[]
  duplicatas: DuplicataNota[]
  registrada_por: string | null
  criado_em: string
}

const COLUNAS =
  'id, pedido_id, numero, serie, chave, emissao, valor, emitente_doc, emitente_nome, observacao, origem, arquivos, itens, duplicatas, registrada_por, criado_em'

function traduz(error: { message: string; code?: string }) {
  const m = error.message.toLowerCase()
  if (m.includes('could not find the function') || error.code === '42P01' || m.includes('does not exist'))
    return new Error('O registro de notas ainda não existe no banco. Rode o SQL de notas fiscais.')
  return new Error(error.message)
}

function traduzArmazenamento(message: string) {
  const m = message.toLowerCase()
  if (m.includes('bucket not found'))
    return 'O armazenamento das notas ainda não foi criado. Rode o SQL do bloco 2.'
  if (m.includes('row-level security') || m.includes('unauthorized'))
    return 'Sem permissão para enviar o arquivo.'
  if (m.includes('exceeded') || m.includes('too large') || m.includes('payload'))
    return 'Arquivo grande demais (limite de 10 MB).'
  if (m.includes('mime')) return 'Tipo de arquivo não aceito. Use foto, PDF ou XML.'
  return message
}

// ---------- empresa (para montar o caminho do arquivo) ----------

export async function empresaIdAtual(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Sessão expirada. Entre de novo.')

  const { data, error } = await supabase
    .from('perfis')
    .select('empresa_id')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (error || !data) throw new Error('Não foi possível identificar a empresa.')
  return data.empresa_id as string
}

// ---------- arquivos ----------

const TIPOS_OK = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/xml',
  'text/xml',
]
const EXTENSAO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/xml': 'xml',
  'text/xml': 'xml',
}
const LIMITE_BYTES = 10 * 1024 * 1024

function tipoDo(arquivo: File) {
  if (arquivo.type) return arquivo.type
  const n = arquivo.name.toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.xml')) return 'application/xml'
  if (/\.jpe?g$/.test(n)) return 'image/jpeg'
  if (n.endsWith('.png')) return 'image/png'
  return ''
}

// foto de celular pesa vários MB: reduz o lado maior para 2200 px
async function reduzirImagem(arquivo: File): Promise<Blob> {
  const LADO_MAX = 2200
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')

  ctx.fillStyle = '#ffffff' // PNG com transparência vira fundo branco
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close?.()

  return new Promise<Blob>((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error('toBlob'))), 'image/jpeg', 0.82)
  )
}

export async function enviarArquivo(opts: {
  empresaId: string
  pedidoId: string
  arquivo: File
}): Promise<ArquivoNota> {
  let tipo = tipoDo(opts.arquivo)

  if (!TIPOS_OK.includes(tipo)) {
    if (tipo === 'image/heic' || tipo === 'image/heif')
      throw new Error('Foto em formato HEIC. Tire a foto em JPEG ou escolha outra.')
    throw new Error('Tipo de arquivo não aceito. Use foto (JPG ou PNG), PDF ou XML.')
  }

  let corpo: Blob = opts.arquivo
  if (tipo.startsWith('image/') && opts.arquivo.size > 1_000_000) {
    try {
      const menor = await reduzirImagem(opts.arquivo)
      if (menor.size < opts.arquivo.size) {
        corpo = menor
        tipo = 'image/jpeg'
      }
    } catch {
      // não deu para reduzir: manda a original
    }
  }

  if (corpo.size > LIMITE_BYTES) throw new Error('Arquivo grande demais (limite de 10 MB).')

  const caminho = `${opts.empresaId}/${opts.pedidoId}/${crypto.randomUUID()}.${EXTENSAO[tipo]}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, corpo, { contentType: tipo, upsert: false })
  if (error) throw new Error(traduzArmazenamento(error.message))

  return { path: caminho, nome: opts.arquivo.name.slice(0, 120), tipo, tamanho: corpo.size }
}

// endereço temporário (5 minutos) para abrir o anexo: só o dono consegue
export async function linkDoArquivo(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error || !data) throw new Error('Não foi possível abrir o arquivo.')
  return data.signedUrl
}

// ---------- notas ----------

function mapear(r: Record<string, unknown>): NotaCompra {
  return {
    ...(r as unknown as NotaCompra),
    valor: Number(r.valor),
    arquivos: Array.isArray(r.arquivos) ? (r.arquivos as ArquivoNota[]) : [],
    itens: Array.isArray(r.itens) ? (r.itens as ItemNota[]) : [],
    duplicatas: Array.isArray(r.duplicatas) ? (r.duplicatas as DuplicataNota[]) : [],
  }
}

export async function listarNotas(pedidoId: string): Promise<NotaCompra[]> {
  const { data, error } = await supabase
    .from('pedido_compra_notas')
    .select(COLUNAS)
    .eq('pedido_id', pedidoId)
    .order('criado_em')

  if (error) throw traduz(error)
  return (data ?? []).map((r) => mapear(r as Record<string, unknown>))
}

export async function registrarNota(pedidoId: string, dados: DadosNota) {
  const { error } = await supabase.rpc('registrar_nota_compra', {
    p_pedido: pedidoId,
    p_nota: dados,
  })
  if (error) throw traduz(error)
}

export async function excluirNota(id: string) {
  const { data, error } = await supabase.rpc('excluir_nota_compra', { p_id: id })
  if (error) throw traduz(error)

  // apaga os arquivos do armazenamento (se falhar, a nota já saiu e o arquivo fica solto)
  const paths = ((data ?? []) as ArquivoNota[]).map((a) => a.path)
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
}

// ---------- apoio à conferência (só o dono usa) ----------

export async function documentoDoFornecedor(ref: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('documento')
    .eq('id', ref)
    .maybeSingle()
  if (error) return null
  return (data?.documento as string | null) ?? null
}

// código do catálogo -> código de barras (para ligar o item do pedido ao da nota)
export async function barcodesDosCodigos(codigos: string[]): Promise<Map<string, string>> {
  const lista = Array.from(new Set(codigos.filter(Boolean)))
  if (lista.length === 0) return new Map()

  const { data, error } = await supabase
    .from('catalog_items')
    .select('code, barcode')
    .in('code', lista)
  if (error) return new Map()

  return new Map(
    (data ?? [])
      .filter((r) => r.barcode)
      .map((r) => [String(r.code), String(r.barcode)] as const)
  )
}