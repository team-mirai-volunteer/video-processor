import { Video } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'みらい動画スタジオ β',
  description: 'チームみらいの切り抜き動画を探したり、素材を作成したりできるサイトです。',
};

function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-sm sm:text-xl">
          <Video className="h-6 w-6 shrink-0" />
          <span>みらい動画スタジオ β</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link href="/videos" className="text-sm font-medium hover:text-primary">
            動画一覧
          </Link>
          <Link href="/clips" className="text-sm font-medium hover:text-primary">
            クリップ一覧
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
        <p className="text-sm text-muted-foreground">みらい動画スタジオ β - Team Mirai Volunteer</p>
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
