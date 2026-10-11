import { Suspense } from 'react';
import { Archivo } from 'next/font/google';
import SportShell from './_components/SportShell';
import './sport.css';

// One family, two widths: semi-condensed for team names and scores, normal for everything else.
const sans = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], display: 'swap', variable: '--font-sport' });

export const metadata = {
  title: { default: 'Matchday', template: '%s · Matchday' },
  description: 'Football scores, match detail and live Fantasy Premier League points, with no ads.',
  applicationName: 'Matchday',
  // Saved to the home screen it runs full screen as its own app: iOS reads the apple-touch-icon and
  // these apple tags, Android the manifest.
  manifest: '/sport/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/sport/icon.svg', type: 'image/svg+xml' },
      { url: '/sport/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/sport/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'Matchday', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

// viewport-fit=cover lets the layout reach the screen edges, with the safe-area insets (the notch,
// the home indicator) handled in sport.css; without it iOS reports those insets as zero.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
};

// Applies a saved theme before paint, so a dark-mode visit never flashes white; the status bar follows it.
const themeScript = `try{var p=JSON.parse(localStorage.getItem('md-prefs-v1')||'{}');if(p.theme&&p.theme!=='system'){document.documentElement.setAttribute('data-sport-theme',p.theme);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',p.theme==='dark'?'#121212':'#ffffff')})}}catch(e){}`;

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
