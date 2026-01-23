import type { Metadata } from 'next';
import Link from 'next/link';
import { Film } from 'lucide-react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Video Processor',
  description: 'Google Drive動画を自動で切り抜くツール',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-14 items-center">
                <Link href="/videos" className="flex items-center gap-2 font-semibold">
                  <Film className="h-5 w-5" />
                  <span>Video Processor</span>
                </Link>
                <nav className="ml-6 flex items-center gap-4 text-sm">
                  <Link
                    href="/videos"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    動画一覧
                  </Link>
                  <Link
                    href="/submit"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    新規登録
                  </Link>
                </nav>
              </div>
            </header>
            <main className="flex-1">
              <div className="container py-6">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
