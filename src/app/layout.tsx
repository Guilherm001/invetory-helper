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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="pt-BR">
      <body>
        <main className="flex flex-col max-w-300 min-w-0 m-auto h-dvh bg-white">
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
            {/* celular: logo + sair em cima, abas embaixo | desktop: tudo na mesma linha */}
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
                  <div className="order-2 ml-auto pr-4 md:order-3">
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