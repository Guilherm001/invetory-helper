import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {Header } from "../components/body/body"





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
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 py-4 px-4 md:py-0 md:border-b-0 md:px-10 md:m-10">
            <Header />
          </div>
          <div className="flex-1 overflow-y-auto px-4 md:px-10">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}
