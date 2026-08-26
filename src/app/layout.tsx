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
            <div className="flex items-center  ">
              <Link href="/">
                <img src="/logo.png" alt="Logo" className="h-40 w-auto" />
              </Link>
              <nav className="flex border-b border-gray-200 bg-white">
                <Link 
                  href="/"
                  className=" relative flex flex-1 items-center justify-center gap-2
                    px-6 py-4 text-base font-medium text-[#079C9C]
                    transition-colors duration-200
                    hover:bg-[#079C9C]/5
                    after:absolute after:bottom-0 after:left-0
                    after:h-[3px] after:w-full
                    after:rounded-t-full after:bg-[#079C9C]"
                >
                  Produtos
                </Link>
                <Link
                  href="/note"
                  className="flex flex-1 items-center justify-center gap-2
                    px-6 py-4 text-base font-medium text-slate-500
                    transition-colors duration-200
                    hover:bg-slate-50 hover:text-[#079C9C]"
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
