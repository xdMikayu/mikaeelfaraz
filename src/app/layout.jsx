import './globals.css';

export const metadata = {
  metadataBase: new URL('https://www.mikaeelfaraz.com'),
  title: 'Mikaeel Faraz',
  description:
    'Mikaeel Faraz builds the systems an operations team runs on: CRM automation, data pipelines, dashboards and internal tools. Operations Strategy Analyst at qlub, Dubai.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
