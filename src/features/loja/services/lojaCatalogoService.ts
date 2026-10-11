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

interface LinhaBusca {
  id: string
  code: string
  barcode: string | null
  name: string
  unit: string | null
  price: number | string | null
  stock: number | string | null
  total: number | string
}

// a ordenação (código exato, começa com o texto, palavra no meio...) é feita no banco
export async function buscarProdutos(opts: {
  termo: string
  pagina: number
  soComEstoque: boolean
}): Promise<{ itens: ProdutoLoja[]; total: number }> {
  const { data, error } = await supabase.rpc('buscar_catalogo', {
    p_termo: opts.termo,
    p_so_estoque: opts.soComEstoque,
    p_limite: TAMANHO_PAGINA,
    p_offset: opts.pagina * TAMANHO_PAGINA,
  })

  if (error) {
    if (error.message.toLowerCase().includes('could not find the function'))
      throw new Error('A busca do catálogo ainda não foi criada no banco. Rode o SQL da busca.')
    throw new Error(error.message)
  }

  const linhas = (data ?? []) as LinhaBusca[]

  return {
    itens: linhas.map((r) => ({
      id: r.id,
      code: r.code,
      barcode: r.barcode ?? null,
      name: r.name,
      unit: r.unit ?? null,
      price: num(r.price),
      stock: num(r.stock),
    })),
    total: linhas.length > 0 ? Number(linhas[0].total) : 0,
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