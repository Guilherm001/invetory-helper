import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createSupabaseServer } from "@/lib/supabase-server";
import { LogoutButton } from "@/features/logout/logout-button";
import { NavLinks } from "@/features/nav/nav-links";

export const metadata: Metadata = {
  title: "Inventory Helper",
  description: "Sistema de controle de compras",
};

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
        <main className="flex flex-col max-w-300 min-w-0 m-auto h-dvh bg-white">
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
            {/* celular: logo + usuário em cima, abas embaixo | desktop: tudo na mesma linha */}
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
                  <div className="order-2 ml-auto flex min-w-0 items-center gap-3 pr-4 md:order-3">
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

                  <NavLinks className="order-3 w-full border-t border-gray-100 md:order-2 md:w-auto md:border-t-0" />
                </>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 md:px-10">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}