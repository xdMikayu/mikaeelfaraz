import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cases } from '../../_data/cases';
import { selected } from '../../_data/work';
import CopyEmail from '../../_components/CopyEmail';
import TaskLab from '../../_components/TaskLab';
import OnboardingFlow from '../../_components/OnboardingFlow';
import MeasureLab from '../../_components/MeasureLab';
import SystemMap from '../../_components/SystemMap';

const ARTIFACT = {
  'crm-task-engine': [TaskLab, 'Try it: an example run with made-up numbers'],
  'merchant-onboarding': [OnboardingFlow, 'The process, before and after'],
  'reporting-stack': [MeasureLab, 'Why a comparison group matters, with made-up numbers'],
  'ops-platform': [SystemMap, 'How the pieces connect. Pick a system to trace it step by step'],
};

export const dynamicParams = false;

export function generateStaticParams() {
  return selected.map((w) => ({ slug: w.slug }));
}

export function generateMetadata({ params }) {
  const c = cases[params.slug];
  const w = selected.find((x) => x.slug === params.slug);
  if (!c || !w) return {};
  return { title: w.system, description: c.tldr.slice(0, 180) };
}

export default function CaseStudy({ params }) {
  const c = cases[params.slug];
  const i = selected.findIndex((x) => x.slug === params.slug);
  if (!c || i < 0) notFound();
  const next = selected[(i + 1) % selected.length];

  return (
    <div className="wrap">
      <main id="main" className="case">
        <Link className="back" href="/">← Mikaeel Faraz</Link>
        <h1>{c.title}</h1>

        <dl className="meta mono">
          {Object.entries(c.meta).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <p className="tldr">{c.tldr}</p>

        {ARTIFACT[params.slug] && (() => {
          const [Comp, label] = ARTIFACT[params.slug];
          return (
            <section className="case-art">
              <p className="try mono">{label}</p>
              <Comp />
            </section>
          );
        })()}

        <div className="body">
          {c.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p.map((p, j) => <p key={j}>{p}</p>)}
            </section>
          ))}

          <h2>Decisions</h2>
          <ul>
            {c.decisions.map((d, j) => <li key={j}>{d}</li>)}
          </ul>

          <h2>Before and after</h2>
        </div>
        <table className="results">
          <thead><tr><th></th><th>Before</th><th>After</th></tr></thead>
          <tbody>
            {c.results.map(([what, before, after]) => (
              <tr key={what}><td>{what}</td><td>{before}</td><td>{after}</td></tr>
            ))}
          </tbody>
        </table>

        <p className="note">
          This describes internal work at qlub. Names, internal rules and business data are left out on purpose. If you want the
          detail behind any of it, email <CopyEmail /> and I will walk you through it.
        </p>

        <nav className="next" aria-label="More work">
          <Link href="/">All work</Link>
          <Link href={`/work/${next.slug}`}>Next: {next.system} →</Link>
        </nav>
      </main>
      <footer className="foot">
        <span>Mikaeel Faraz · Operations Strategy Analyst at qlub, Dubai</span>
        <a href="/resume.pdf">Résumé (PDF)</a>
      </footer>
    </div>
  );
}
