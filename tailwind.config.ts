import type { Config } from 'tailwindcss';

// Tema "Pagi di Lintasan": warna dari CSS variable (app/globals.css), jadi bisa dipakai dengan opacity: text-ink/60, bg-track/10, dst.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: v('paper'), // latar halaman (kertas hangat)
        card: v('card'), // permukaan kartu
        ink: v('ink'), // teks & garis
        track: v('track'), // hijau pinus: aksen utama
        volt: v('volt'), // amber: sorotan kecil
        ok: v('ok'),
        bad: v('bad'),
        warn: v('warn'),
        info: v('info'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
