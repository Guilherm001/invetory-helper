import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import {
  FileText,
  Truck,
  Scale,
  LineChart,
  ClipboardCheck,
  HardHat,
  BarChart3,
  Settings,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { LogoutButton } from "@/features/logout/logout-button";
import { NavLinks } from "@/features/nav/nav-links";

export const metadata: Metadata = {
  title: "Inventory Helper",
  description: "Sistema de controle de compras",
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
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
            {/* celular: logo + usuário em cima, abas embaixo | desktop: logo e usuário na mesma linha */}
            <div className="flex flex-wrap items-center md:flex-nowrap">
              <Link
                href={user ? "/dashboard" : "/"}
                className="order-1 px-4 py-2 md:px-0 md:py-0"
              >
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-16 w-auto md:h-40"
                />
              </Link>

              {user && (
                <>
                  <div className="order-2 ml-auto flex min-w-0 items-center gap-3 pr-4 md:order-3 md:pr-8">
                    {nome && (
                      <span
                        title={nome}
                        className="max-w-[110px] truncate text-sm font-medium text-gray-700 md:max-w-[220px] md:text-base"
                      >
                        <span className="hidden text-gray-400 md:inline">
                          Olá,{" "}
                        </span>
                        {nome}
                      </span>
                    )}
                    <LogoutButton />
                  </div>

                  {/* só no celular: abas embaixo do header */}
                  <NavLinks className="order-3 w-full border-t border-gray-100 md:hidden" />
                </>
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
                <NavLinks className="flex-col items-stretch gap-1" />

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
        </main>
      </body>
    </html>
  );
}