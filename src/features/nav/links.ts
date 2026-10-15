import {
  Calculator,
  Library,
  LineChart,
  Package,
  Scale,
  Send,
  Store,
  Wallet,
  Users,
  FileText,
  ClipboardList,
  Truck,
  type LucideIcon,
} from 'lucide-react'

export type GrupoId = 'loja' | 'compras' | 'gestao'

// ordem em que os grupos aparecem no menu
export const GRUPOS: { id: GrupoId; label: string }[] = [
  { id: 'loja', label: 'Loja' },
  { id: 'compras', label: 'Compras' },
  { id: 'gestao', label: 'Gestão' },
]

export interface NavLink {
  href: string
  label: string
  curto?: string // rótulo menor para a barra do celular
  icon: LucideIcon
  grupo: GrupoId // em qual seção do menu aparece
  principal: boolean // true = barra de baixo | false = dentro do "Mais"
  ordemBarra?: number // posição na barra de baixo do celular (menor = mais à esquerda)
  soDono?: boolean // true = só o dono vê
  soFuncionario?: boolean // true = só o funcionário vê
}

export const LINKS: NavLink[] = [
  // ---- Loja ----
  { href: '/calculator', label: 'Calculadora', icon: Calculator, grupo: 'loja', principal: true, ordemBarra: 2 },
  { href: '/loja', label: 'Vendas', curto: 'Loja', icon: Store, grupo: 'loja', principal: true, ordemBarra: 3 },
  { href: '/orcamentos', label: 'Orçamentos', icon: FileText, grupo: 'loja', principal: false },
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList, grupo: 'loja', principal: false },

  // ---- Compras ----
  { href: '/dashboard', label: 'Produtos', icon: Package, grupo: 'compras', principal: false, ordemBarra: 1, soDono: true },
  { href: '/cotacoes', label: 'Cotações', icon: Send, grupo: 'compras', principal: false, soDono: true },
  { href: '/comparar-precos', label: 'Comparar preços', curto: 'Comparar', icon: Scale, grupo: 'compras', principal: false, soDono: true },
  { href: '/historico-precos', label: 'Histórico', icon: LineChart, grupo: 'compras', principal: false, soDono: true },
  { href: '/catalogo', label: 'Catálogo', icon: Library, grupo: 'compras', principal: true, ordemBarra: 4, soDono: true },
  { href: '/fornecedores', label: 'Fornecedores',grupo: 'compras', icon: Truck, principal: false, soDono: true },

  // ---- Gestão (só o dono) ----
  { href: '/financeiro', label: 'Financeiro', icon: Wallet, grupo: 'gestao', principal: false, soDono: true },
  { href: '/equipe', label: 'Equipe', icon: Users, grupo: 'gestao', principal: false, soDono: true },
]

// links que a pessoa pode ver
export const linksVisiveis = (ehDono: boolean) =>
  LINKS.filter((l) => (ehDono ? !l.soFuncionario : !l.soDono))

// links visíveis separados por grupo (grupos vazios ficam de fora)
export const linksPorGrupo = (ehDono: boolean) => {
  const visiveis = linksVisiveis(ehDono)
  return GRUPOS.map((g) => ({
    ...g,
    links: visiveis.filter((l) => l.grupo === g.id),
  })).filter((g) => g.links.length > 0)
}

export const estaAtivo = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

// só o link mais específico fica marcado (ex.: /catalogo/importar não acende dois itens)
export const hrefAtivo = (pathname: string, ehDono: boolean) =>
  linksVisiveis(ehDono)
    .filter((l) => estaAtivo(pathname, l.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href