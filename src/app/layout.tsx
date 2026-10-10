import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import {
  FileText,
  Truck,
  ClipboardCheck,
  HardHat,
  BarChart3,
  Settings,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { LogoutButton } from "@/features/logout/logout-button";
import { NavLinks } from "@/features/nav/nav-links";
import { MobileNav } from "@/features/nav/mobile-nav";

export const metadata: Metadata = {
  title: "Inventory Helper",
  description: "Sistema de controle de compras",
};

// viewport-fit=cover permite à barra de baixo respeitar a área do gesto do iPhone
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// ideias para o futuro (ainda sem página)
const EM_BREVE = [
  { label: "Cotações", icon: FileText },
  { label: "Fornecedores", icon: Truck },
  { label: "Pedidos de compra", icon: ClipboardCheck },
  { label: "Obras", icon: HardHat },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
];

function nomeDoUsuario(user: {
  email?: string
  user_metadata?: Record<string, unknown>
}) {
  const meta = user.user_metadata ?? {}
  const nome =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    user.email?.split("@")[0] ||
    ""
  return nome
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nome = user ? nomeDoUsuario(user) : ""

  return (
    <html lang="pt-BR">
      <body>
        <main className="flex flex-col max-w-400 min-w-0 m-auto h-dvh bg-white">
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between">
              <Link
                href={user ? "/dashboard" : "/"}
                className="px-4 py-2 md:px-0 md:py-0"
              >
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-16 w-auto md:h-40"
                />
              </Link>

              {user && (
                <div className="flex min-w-0 items-center gap-3 pr-4 md:pr-8">
                  {nome && (
                    <span
                      title={nome}
                      className="max-w-[170px] truncate text-sm text-gray-500 md:max-w-[240px] md:text-base"
                    >
                      Olá,{" "}
                      <span className="font-semibold text-gray-800">{nome}</span>
                    </span>
                  )}

                  {/* no celular o botão de sair fica dentro do "Mais" */}
                  <div className="hidden md:block">
                    <LogoutButton />
                  </div>
                </div>
              )}
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            {/* só no desktop: sidebar com os links */}
            {user && (
              <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-slate-50 p-4 md:block">
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Menu
                </p>
                <NavLinks />

                {/* ideias para o futuro */}
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Em breve
                  </p>
                  <ul className="space-y-1">
                    {EM_BREVE.map(({ label, icon: Icon }) => (
                      <li
                        key={label}
                        aria-disabled="true"
                        title="Em breve"
                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            )}

            <div className="min-w-0 flex-1 overflow-y-auto px-4 md:px-10 lg:px-14">
              {children}
            </div>
          </div>

          {/* só no celular: barra de baixo com o "Mais" */}
          {user && <MobileNav logout={<LogoutButton />} />}
        </main>
      </body>
    </html>
  );
}