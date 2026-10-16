// tipos, rótulos e cores do caderno de ideias

export const STATUS = ['nova', 'planejada', 'fazendo', 'feita', 'descartada'] as const
export type StatusIdeia = (typeof STATUS)[number]

export const AREAS = [
  'geral',
  'loja',
  'catalogo',
  'compras',
  'financeiro',
  'clientes',
  'equipe',
] as const
export type AreaIdeia = (typeof AREAS)[number]

export const TIPOS = ['recurso', 'melhoria', 'bug', 'visual', 'duvida'] as const
export type TipoIdeia = (typeof TIPOS)[number]

export interface Ideia {
  id: string
  texto: string
  detalhes: string | null
  area: AreaIdeia
  tipo: TipoIdeia
  status: StatusIdeia
  destaque: boolean
  created_at: string
  updated_at: string
}

export interface NovaIdeia {
  texto: string
  detalhes?: string | null
  area?: AreaIdeia
  tipo?: TipoIdeia
  status?: StatusIdeia
  destaque?: boolean
}

export const STATUS_INFO: Record<StatusIdeia, { rotulo: string; classe: string }> = {
  nova: { rotulo: 'Nova', classe: 'border-sky-200 bg-sky-50 text-sky-700' },
  planejada: { rotulo: 'Planejada', classe: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  fazendo: { rotulo: 'Fazendo', classe: 'border-amber-200 bg-amber-50 text-amber-700' },
  feita: { rotulo: 'Feita', classe: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  descartada: { rotulo: 'Descartada', classe: 'border-slate-200 bg-slate-100 text-slate-500' },
}

// o que ainda está "vivo": aparece por padrão na lista
export const EM_ABERTO: StatusIdeia[] = ['nova', 'planejada', 'fazendo']

export const AREA_ROTULO: Record<AreaIdeia, string> = {
  geral: 'Geral',
  loja: 'Loja',
  catalogo: 'Catálogo',
  compras: 'Compras',
  financeiro: 'Financeiro',
  clientes: 'Clientes',
  equipe: 'Equipe',
}

export const TIPO_INFO: Record<TipoIdeia, { rotulo: string; classe: string }> = {
  recurso: { rotulo: 'Recurso novo', classe: 'bg-emerald-50 text-emerald-700' },
  melhoria: { rotulo: 'Melhoria', classe: 'bg-sky-50 text-sky-700' },
  bug: { rotulo: 'Problema', classe: 'bg-red-50 text-red-700' },
  visual: { rotulo: 'Visual', classe: 'bg-violet-50 text-violet-700' },
  duvida: { rotulo: 'Dúvida', classe: 'bg-slate-100 text-slate-600' },
}

// texto pronto para colar numa conversa (por exemplo, para pedir a implementação)
export function textoParaCopiar(ideias: Ideia[]): string {
  if (ideias.length === 0) return ''

  const linhas = [`Ideias em aberto (${ideias.length})`, '']
  for (const i of ideias) {
    linhas.push(
      `- [${AREA_ROTULO[i.area]} · ${TIPO_INFO[i.tipo].rotulo} · ${STATUS_INFO[i.status].rotulo}]${
        i.destaque ? ' ★' : ''
      } ${i.texto}`
    )
    const det = i.detalhes?.trim()
    if (det) for (const l of det.split('\n')) linhas.push(`    ${l}`)
  }
  return linhas.join('\n')
}