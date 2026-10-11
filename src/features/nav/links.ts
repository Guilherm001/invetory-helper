import {
  Calculator,
  Library,
  LineChart,
  Package,
  Scale,
  Wallet,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavLink {
  href: string
  label: string
  curto?: string // rótulo menor para a barra do celular
  icon: LucideIcon
  principal: boolean // true = barra de baixo | false = dentro do "Mais"
  soDono?: boolean // true = só o dono vê
}

export const LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Produtos', icon: Package, principal: true },
  { href: '/comparar-precos', label: 'Comparar preços', curto: 'Comparar', icon: Scale, principal: true },
  { href: '/catalogo', label: 'Catálogo', icon: Library, principal: true },
  { href: '/historico-precos', label: 'Histórico', icon: LineChart, principal: true },
  { href: '/calculator', label: 'Calculadora', icon: Calculator, principal: false },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet, principal: false },
  { href: '/equipe', label: 'Equipe', icon: Users, principal: false, soDono: true },
]

// links que a pessoa pode ver: os marcados como soDono só aparecem para o dono
export const linksVisiveis = (ehDono: boolean) =>
  LINKS.filter((l) => ehDono || !l.soDono)

export const estaAtivo = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)