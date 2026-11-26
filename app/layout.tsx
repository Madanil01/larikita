import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'LariKita',
  description: 'Rencana latihan lari (5K sampai maraton) yang mengikuti data larimu',
  // ikon diambil otomatis dari app/icon.svg & app/apple-icon.tsx
  appleWebApp: { title: 'LariKita' },
};

export const viewport = { themeColor: '#F5F3EE' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
