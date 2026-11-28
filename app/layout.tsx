import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Bricolage_Grotesque } from 'next/font/google';
import { Background } from '@/components/Background';
import { BlossomOverlay } from '@/components/BlossomOverlay';
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chill-calendar-in4w.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Chill With Me — Bạn đi đâu tôi đi đấy',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  description:
    'Không đi cùng nhau những ngày mưa thì đừng tìm nhau những ngày nắng',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Chill With Me',
    title: 'Chill With Me — Bạn đi đâu tôi đi đấy',
    description:
      'Hẹn giờ rảnh, bình chọn địa điểm, check-in Live và lưu album kỷ niệm cùng nhóm bạn.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chill With Me — Bạn đi đâu tôi đi đấy',
    description:
      'Hẹn giờ rảnh, bình chọn địa điểm, check-in Live và lưu album kỷ niệm cùng nhóm bạn.',
  },
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
          <BlossomOverlay />
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
