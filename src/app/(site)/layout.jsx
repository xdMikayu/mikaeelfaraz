import '@fontsource/familjen-grotesk/400.css';
import '@fontsource/familjen-grotesk/500.css';
import '@fontsource/familjen-grotesk/600.css';
import '@fontsource/martian-mono/400.css';
import '@fontsource/martian-mono/500.css';
import './site.css';
import Palette from './_components/Palette';

export const metadata = {
  title: { default: 'Mikaeel Faraz', template: '%s · Mikaeel Faraz' },
  description:
    'I build the systems an operations team runs on: CRM automation, data pipelines, dashboards and internal tools. Operations Strategy Analyst at qlub, Dubai.',
  openGraph: {
    title: 'Mikaeel Faraz',
    description: 'CRM automation, data pipelines, dashboards and internal tools, in production at a Dubai fintech.',
    url: 'https://www.mikaeelfaraz.com',
    locale: 'en_AE',
    type: 'website',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#131416' },
  ],
};

// Applies a saved theme before paint. Without a saved choice the CSS follows the OS.
const themeScript = `try{var t=localStorage.getItem('mf-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Mikaeel Faraz',
  alternateName: 'Mikaeel Faraz Safdar',
  jobTitle: 'Operations Strategy Analyst',
  worksFor: { '@type': 'Organization', name: 'qlub' },
  address: { '@type': 'PostalAddress', addressLocality: 'Dubai', addressCountry: 'AE' },
  alumniOf: 'University of Wollongong in Dubai',
  url: 'https://www.mikaeelfaraz.com',
  sameAs: ['https://github.com/xdMikayu', 'https://www.linkedin.com/in/mikaeelf/'],
};

export default function SiteLayout({ children }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }} />
      <div className="site">
        <a href="#main" className="skip">Skip to content</a>
        {children}
        <Palette />
      </div>
    </>
  );
}
