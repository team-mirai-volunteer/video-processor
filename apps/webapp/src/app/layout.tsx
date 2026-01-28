import { Video } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'みらい動画スタジオ',
  description: 'Google Drive動画からショート動画を自動切り抜き',
};

function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Video className="h-6 w-6" />
          <span>みらい動画スタジオ</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium hover:text-primary">
            動画一覧
          </Link>
          <Link href="/submit" className="text-sm font-medium hover:text-primary">
            動画登録
          </Link>
          <Link href="/shorts-gen" className="text-sm font-medium hover:text-primary">
            ショート動画生成
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto flex h-14 items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">みらい動画スタジオ - Team Mirai Volunteer</p>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
