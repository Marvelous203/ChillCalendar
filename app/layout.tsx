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
  title: 'Hẹn Giờ Rảnh — Chốt lịch & chọn quán cùng bạn bè',
  description:
    'Tạo phòng hẹn giờ rảnh chỉ trong 10 giây. Bạn bè vào bằng mã hoặc link, không cần tài khoản.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${bricolage.variable} ${beVietnam.variable} h-full antialiased`}
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
