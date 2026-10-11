import { supabase } from '@/lib/supabase'

export interface ProdutoLoja {
  id: string
  code: string
  barcode: string | null
  name: string
  unit: string | null
  price: number | null
  stock: number | null
}

export const TAMANHO_PAGINA = 20

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v)

export async function buscarProdutos(opts: {
  termo: string
  pagina: number
  soComEstoque: boolean
}): Promise<{ itens: ProdutoLoja[]; total: number }> {
  let q = supabase
    .from('catalog_items')
    .select('id, code, barcode, name, unit, price, stock', { count: 'exact' })

  // vírgula, %, parênteses e * quebram o filtro .or()
  const t = opts.termo.trim().replace(/[%,()*]/g, ' ').trim()
  if (t) {
    // cada palavra precisa aparecer na descrição, no código ou no código de barras
    for (const palavra of t.split(/\s+/)) {
      q = q.or(`name.ilike.%${palavra}%,code.ilike.${palavra}%,barcode.ilike.${palavra}%`)
    }
  }

  if (opts.soComEstoque) q = q.gt('stock', 0)

  const de = opts.pagina * TAMANHO_PAGINA
  const { data, error, count } = await q.order('name').range(de, de + TAMANHO_PAGINA - 1)

  if (error) throw new Error(error.message)

  return {
    itens: (data ?? []).map((r) => ({
      id: r.id as string,
      code: r.code as string,
      barcode: (r.barcode as string | null) ?? null,
      name: r.name as string,
      unit: (r.unit as string | null) ?? null,
      price: num(r.price),
      stock: num(r.stock),
    })),
    total: count ?? 0,
  }
}

// ---------- pedido de compra (vai para a lista de produtos do comprador) ----------

async function nomeDoSolicitante() {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  const meta = u?.user_metadata ?? {}
  const nome =
    typeof meta.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : (u?.email?.split('@')[0] ?? '')
  return nome
}

export async function pedirCompra(
  produto: ProdutoLoja,
  dados: { quantidade: number; urgente: boolean; observacao: string }
) {
  const quem = await nomeDoSolicitante()
  const partes = [quem ? `Pedido por ${quem}` : 'Pedido pela loja']
  if (dados.observacao.trim()) partes.push(dados.observacao.trim())

  // a mesma rota do "Adicionar Produtos": vale a mesma regra de acesso
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: produto.name,
      quantity: dados.quantidade,
      priority: dados.urgente ? 'Alta' : 'Média',
      status: 'Pendente',
      notes: partes.join(' — '),
      unit: produto.unit,
      catalog_code: produto.code,
    }),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => null)
    throw new Error(json?.error || 'Não foi possível colocar na lista de compras')
  }
}

// quanto de cada item (por código do catálogo) já está pendente na lista de compras
export async function codigosNaLista(): Promise<Map<string, number>> {
  const res = await fetch('/api/products')
  if (!res.ok) throw new Error('Não foi possível ler a lista de compras')

  const produtos = (await res.json()) as {
    catalog_code?: string | null
    quantity: number
    status: string
  }[]

  const mapa = new Map<string, number>()
  for (const p of produtos) {
    if (!p.catalog_code || p.status === 'Concluído') continue
    mapa.set(p.catalog_code, (mapa.get(p.catalog_code) ?? 0) + Number(p.quantity))
  }
  return mapa
}