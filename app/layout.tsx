import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Bricolage_Grotesque } from 'next/font/google';
import { Background } from '@/components/Background';
import { Header } from '@/components/Header';
import { Providers } from '@/components/Providers';
import { WebViewBanner } from '@/components/WebViewBanner';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Chill With Me — Bạn đi đâu tôi đi đấy',
  description:
    'Khôn đi cùn nhau những ngày mưa thì đừng tìm nheu những ngày nén',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${bricolage.variable} ${beVietnam.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Background />
          <WebViewBanner />
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
