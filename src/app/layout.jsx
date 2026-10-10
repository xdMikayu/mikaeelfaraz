import { Suspense } from 'react';
import { Archivo } from 'next/font/google';
import SportShell from './_components/SportShell';
import './sport.css';

// One family, two widths: semi-condensed for team names and scores, normal for everything else.
const sans = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], display: 'swap', variable: '--font-sport' });

export const metadata = {
  title: { default: 'Matchday', template: '%s · Matchday' },
  description: 'Football scores, match detail and live Fantasy Premier League points, with no ads.',
  manifest: '/sport/manifest.webmanifest',
  icons: {
    icon: [{ url: '/sport/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/sport/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { title: 'Matchday', statusBarStyle: 'default' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f3f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1012' },
  ],
};

// Applies a saved theme before paint, so a dark-mode visit never flashes white.
const themeScript = `try{var p=JSON.parse(localStorage.getItem('md-prefs-v1')||'{}');if(p.theme&&p.theme!=='system')document.documentElement.setAttribute('data-sport-theme',p.theme)}catch(e){}`;

export default function SportLayout({ children }) {
  return (
    <div className={`sp-root ${sans.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <Suspense>
        <SportShell>{children}</SportShell>
      </Suspense>
    </div>
  );
}
