import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CodeSim",
  description: "Master frameworks by building: hands-on React, Next.js, TypeScript and Rust challenges.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-mono font-semibold">
              <Image src="/logo.svg" alt="" width={28} height={28} />
              CodeSim
            </Link>
            <div className="flex gap-5 text-sm text-muted-foreground">
              <Link href="/problems" className="hover:text-primary">
                Problems
              </Link>
              <Link href="/dashboard" className="hover:text-primary">
                Dashboard
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
