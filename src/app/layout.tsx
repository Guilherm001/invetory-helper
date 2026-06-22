import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventory Helper",
  description: "Sistema de controle de compras",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="flex flex-col max-w-300 min-w-100 m-auto h-screen bg-white">
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-4 md:px-10">
              <Link href="/">
                <img src="/logo.png" alt="Logo" className="h-40 w-auto" />
              </Link>
              <nav className="flex items-center gap-3">
                <Link
                  href="/note"
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Notas
                </Link>
              </nav>
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
