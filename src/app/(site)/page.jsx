import Image from 'next/image';
import Work from './_components/Work';
import CopyEmail from './_components/CopyEmail';
import ThemeToggle from './_components/ThemeToggle';
import Alphabet from './_components/Alphabet';
import { PaletteButton } from './_components/Palette';
import { alsoBuilt, earlier } from './_data/work';

export const dynamic = 'force-static';

const UPDATED = 'September 2026';

export default function Home() {
  return (
    <div className="wrap">
      <header className="bar">
        <span className="mono faint">Dubai · GMT+4</span>
        <nav aria-label="Sections">
          <a href="#work-h">Work</a>
          <a href="#mifolio">Mifolio</a>
          <a href="#before">Background</a>
          <a href="#az">a–z</a>
          <a href="/resume.pdf">Résumé</a>
          <PaletteButton />
        </nav>
      </header>

      <main id="main">
        <section className="intro">
          <div>
            <h1>Mikaeel Faraz</h1>
            <p className="role">Operations Strategy Analyst at qlub, Dubai</p>
            <p className="pitch">
              I build the software an operations team runs on. At qlub, a pay-at-table fintech, that is the CRM
              automation that decides which venue an account manager calls next, the pipelines that feed our dashboards,
              and the internal platform all of it lives on.
            </p>
            <p className="pitch">
              I work best inside the team that has the problem: I learn the process, find the part people do by hand,
              and ship the whole fix, from data source to the Slack message someone acts on.
            </p>
            <p className="links">
              <a href="/resume.pdf">Résumé (PDF)</a>
              <CopyEmail />
              <a href="https://www.linkedin.com/in/mikaeelf/">LinkedIn</a>
              <a href="https://github.com/xdMikayu">GitHub</a>
            </p>
            <p className="status muted">Open to forward-deployed, solutions and internal-tools engineering roles</p>
          </div>
          <Image className="photo" src="/headshot.jpg" alt="Mikaeel Faraz" width={512} height={512} priority />
        </section>

        <Work />

        <section className="sec" aria-labelledby="also-h">
          <div className="sec-head">
            <h2 id="also-h">Also built at qlub</h2>
            <p>Smaller systems, each in daily or weekly use</p>
          </div>
          <ul className="rows">
            {alsoBuilt.map(([name, what, year]) => (
              <li key={name}>
                <b>{name}</b>
                <span>{what}</span>
                <span className="mono faint">{year}</span>
              </li>
            ))}
          </ul>
          <p className="caption">
            The code is private, and this page leaves out company data and internal rules. I am happy to walk through
            any of it in more depth in an interview.
          </p>
        </section>

        <section className="sec" id="mifolio" aria-labelledby="mifolio-h">
          <div className="sec-head">
            <h2 id="mifolio-h">My own product</h2>
            <p>Designed and built September 2026</p>
          </div>
          <div className="product">
            <div>
              <h3>Mifolio</h3>
              <p className="tag faint">Personal finance tracker · Next.js, Supabase, Claude API</p>
              <p>
                I wanted to know what I spend, as I spend it, across three cards and a buy-now-pay-later account. None of
                the banks offer an API, so Mifolio reads what they already send: card SMS through an iPhone Shortcut, bank
                emails through a Gmail Apps Script, and Apple Wallet taps.
              </p>
              <p>
                Each alert is parsed, matched against the same purchase arriving on another channel so it is counted
                once, and categorised by UAE merchant rules first and Claude only for merchants the rules do not know. The
                dashboard breaks spending down by category against your usual, tracks the month’s pace against a
                typical month, shows balances per card and the merchants that add up, and keeps a net-worth view
                across bank accounts, stocks, gold and crypto.
              </p>
              <dl>
                <dt>Role</dt><dd>Designer and sole engineer</dd>
                <dt>Ingest</dt><dd>SMS, email and Wallet into one authenticated endpoint</dd>
                <dt>Data</dt><dd>Supabase with row-level security, nothing private in the repo</dd>
                <dt>Jobs</dt><dd>Categorisation every 15 minutes on Netlify</dd>
                <dt>Status</dt><dd>Private; demo mode on request</dd>
              </dl>
            </div>
            <div className="shots">
              <figure className="wide">
                <Image src="/mifolio/categories.png" alt="Mifolio category breakdown: a ring chart of spending by category over the last three months, with each category’s total, share and change against usual" width={1202} height={1445} />
                <figcaption className="mono faint">Where it went, last 3 months · demo data</figcaption>
              </figure>
              <figure>
                <Image src="/mifolio/overview.png" alt="Mifolio spending overview: this month’s total, pace chart against last month and a typical month, and per-card totals" width={1400} height={734} />
                <figcaption className="mono faint">Spending pace</figcaption>
              </figure>
              <figure>
                <Image src="/mifolio/networth.png" alt="Mifolio net worth: total over three months and the split across bank accounts, stocks, gold and crypto" width={1400} height={636} />
                <figcaption className="mono faint">Net worth</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="sec" aria-labelledby="how-h">
          <div className="sec-head">
            <h2 id="how-h">How I work</h2>
          </div>
          <div className="two">
            <div>
              <p>
                Most of what I build started as a conversation with the person doing the work by hand. The first version
                is small and goes to them early; the parts that matter then get tests, logs that say
                what went wrong in plain words, and a written note of why a schedule or threshold is what it is.
              </p>
              <p>
                I measure before I trust. New APIs get tested against live data before I build on them, and every
                write is read back. Dashboards get reconciled against the source of truth until they match.
              </p>
            </div>
            <div>
              <p>
                I use AI coding tools every day, the way I would use a pair programmer. The problem, the requirements,
                the design decisions, the review, the testing against production and the deployment stay with me, and
                so does what happens after it ships.
              </p>
            </div>
          </div>
        </section>

        <section className="sec" id="before" aria-labelledby="before-h">
          <div className="sec-head">
            <h2 id="before-h">Before qlub</h2>
          </div>
          <ul className="rows cv">
            {earlier.map(([when, org, role, what]) => (
              <li key={org}>
                <span className="mono faint">{when}</span>
                <span><b>{org}</b><br /><span className="faint">{role}</span></span>
                <span className="muted">{what}</span>
              </li>
            ))}
          </ul>
          <p className="caption">
            University projects: real-estate valuation with XGBoost and PySpark, an Azure Data Factory data lake with
            Power BI for a finance case study, and a NEAT neuro-evolution agent that learned to play Flappy Bird.
          </p>
          <p className="caption">
            Before engineering I spent two years in marketing, so I can still cut a video, run an ad account and lay out a
            deck in Illustrator or Figma. It helps when the output of a system has to persuade someone.
          </p>
        </section>

        <section className="sec" id="az" aria-labelledby="az-h">
          <div className="sec-head">
            <h2 id="az-h">a to z</h2>
            <p>Guinness World Records</p>
          </div>
          <div className="records">
            <div>
              <p>
                In July 2022 I typed the alphabet on a touchscreen phone in 3.01 seconds, and one-handed in 4.88. Both
                were Guinness World Records titles; both have since been broken.
              </p>
              <p>
                The one that still stands is less expected:{' '}
                <a href="https://www.guinnessworldrecords.com/world-records/590931-fastest-game-of-five-cup-tilt-a-cup">fastest game of five cup tilt-a-cup</a>,
                12.99 seconds, with Raania Faraz in Dubai on 20 June 2021.
              </p>
              <p className="faint">
                Virgin Radio featured me on their channel (<a href="https://www.instagram.com/reel/CwzzAERvHml/">Instagram</a>).
                Your time is kept in this browser only.
              </p>
            </div>
            <Alphabet />
          </div>
        </section>
      </main>

      <footer className="foot">
        <span><CopyEmail /> · <a href="tel:+971589606420">+971 58 960 6420</a></span>
        <span>Updated {UPDATED}. <a href="/resume.json">Résumé as JSON</a>.<span className="kb-hint"> Press <kbd className="mono">/</kbd> for the menu.</span></span>
        <ThemeToggle />
      </footer>
    </div>
  );
}
