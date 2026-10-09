import Link from 'next/link';
import { notFound } from 'next/navigation';
import { notes } from '../../_data/notes';
import OncePurchase from '../../_components/OncePurchase';
import MifolioMini from '../../_components/MifolioMini';

export const dynamicParams = false;

export function generateStaticParams() {
  return notes.map((n) => ({ slug: n.slug }));
}

export function generateMetadata({ params }) {
  const n = notes.find((x) => x.slug === params.slug);
  if (!n) return {};
  return { title: n.title, description: n.summary, openGraph: { title: n.title, description: n.summary, type: 'article' } };
}

export default function Note({ params }) {
  const n = notes.find((x) => x.slug === params.slug);
  if (!n) notFound();
  const other = notes.find((x) => x.slug !== n.slug);
  return (
    <div className="wrap">
      <main id="main" className="case note-page">
        <Link className="back" href="/#notes">← Mikaeel Faraz</Link>
        <h1>{n.title}</h1>
        <p className="note-date mono faint">{n.date}</p>
        <div className="body">
          {n.blocks.map((b, i) => {
            if (b.h) return <h2 key={i}>{b.h}</h2>;
            if (b.explainer) return <OncePurchase key={i} />;
            if (b.charts) return <MifolioMini key={i} />;
            return <p key={i}>{b.p}{b.a && <> <a href={b.a[1]}>{b.a[0]} →</a></>}</p>;
          })}
        </div>
        {other && (
          <nav className="next" aria-label="More writing">
            <Link href="/#notes">All writing</Link>
            <Link href={`/notes/${other.slug}`}>Next: {other.title} →</Link>
          </nav>
        )}
      </main>
      <footer className="foot">
        <span>Mikaeel Faraz · Dubai</span>
        <a href="/resume.pdf">Résumé (PDF)</a>
      </footer>
    </div>
  );
}
