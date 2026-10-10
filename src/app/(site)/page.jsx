import Image from 'next/image';
import Link from 'next/link';
import CopyEmail from './_components/CopyEmail';
import ThemeToggle from './_components/ThemeToggle';
import Alphabet from './_components/Alphabet';
import MifolioMini from './_components/MifolioMini';
import TaskLab from './_components/TaskLab';
import OnboardingFlow from './_components/OnboardingFlow';
import MeasureLab from './_components/MeasureLab';
import LocalTime from './_components/LocalTime';
import { PaletteButton } from './_components/Palette';
import { alsoBuilt, earlier, selected } from './_data/work';
import { notes } from './_data/notes';

export const dynamic = 'force-static';

const UPDATED = 'October 2026';

const FLAGSHIPS = [
  {
    slug: 'crm-task-engine',
    kicker: 'Account management · since January 2026',
    title: 'Telling account managers which venue needs them today',
    problem: 'Every venue’s numbers reach the CRM overnight. Nobody had time to read them all, and a rule that flags every drop buries the few that matter.',
    did: 'I built the CRM automation that reads each venue’s numbers every day, opens a task only when a change is worth a call, gives it to the right person and closes it when things recover.',
    result: 'Most account-management tasks in the CRM now come from it, across the UAE and Qatar.',
    lab: <TaskLab />,
    tryIt: 'Try it: move the slider, then tell it someone is already on the venue.',
  },
  {
    slug: 'merchant-onboarding',
    kicker: 'New vertical · built in 30 days',
    title: 'Onboarding a new kind of merchant without the copying',
    problem: 'Each new merchant meant documents over WhatsApp, every setting typed into the admin panel by hand, and print artwork made one at a time.',
    did: 'I built a self-service flow: the merchant fills in one secure link, the team reviews it, and one publish step sets them up across the internal systems, artwork included.',
    result: 'A form, a review and one click, in place of manual steps across several tools.',
    lab: <OnboardingFlow />,
    tryIt: 'Switch between Before and After, and open the why? notes.',
  },
  {
    slug: 'reporting-stack',
    kicker: 'Reporting and measurement · since January 2026',
    title: 'Numbers the team can act on',
    problem: 'An internal dashboard that disagrees with the official BI tool gets ignored. And a programme can look like it worked when the whole market simply moved.',
    did: 'I built the reporting pipeline and checked it against the BI tool until the totals matched. I also helped improve how a staff incentive programme is measured, using a comparison group.',
    result: 'Dashboards and weekly performance reviews run on numbers that agree with the source.',
    lab: <MeasureLab />,
    tryIt: 'Move the market, then switch how it is measured.',
  },
];

const MORE = ['ops-platform', 'incident-webhook', 'reviews-impact'];

export default function Home() {
  const more = selected.filter((w) => MORE.includes(w.slug));
  return (
    <div className="wrap">
      <header className="bar">
        <LocalTime name={false} />
        <nav aria-label="Sections">
          <a href="#work">Work</a>
          <a href="#mifolio">Mifolio</a>
          <a href="#matchday">Matchday</a>
          <a href="#notes">Writing</a>
          <a href="#az">Typing challenge</a>
          <a href="/resume.pdf">Résumé</a>
          <PaletteButton />
        </nav>
      </header>

      <main id="main">
        <section className="intro">
          <div>
            <h1>Mikaeel Faraz</h1>
            <p className="role">Operations Strategy Analyst at qlub, Dubai</p>
            <p className="pitch">I turn operational problems into working tools, reliable numbers and repeatable processes.</p>
            <p className="pitch sub">
              At qlub, a pay-at-table fintech, that has meant CRM automation for account management, self-service
              onboarding for a new merchant vertical, and measurement the team can trust.
            </p>
            <p className="links">
              <a href="/resume.pdf">Résumé (PDF)</a>
              <CopyEmail />
              <a href="https://www.linkedin.com/in/mikaeelf/">LinkedIn</a>
            </p>
            <p className="status muted">Open to strategy & operations, product and analytics roles</p>
          </div>
          <Image className="photo" src="/headshot.jpg" alt="Mikaeel Faraz" width={512} height={512} priority />
        </section>

        <section id="work" className="flagships" aria-label="Selected work at qlub">
          {FLAGSHIPS.map((f, i) => (
            <article key={f.slug} className={`flag flag-${i + 1}`} aria-labelledby={`flag-${i}`}>
              <div className="flag-text">
                <h2 id={`flag-${i}`}>{f.title}</h2>
                <p className="kicker mono">{f.kicker}</p>
                <dl className="flag-facts">
                  <dt>Problem</dt><dd>{f.problem}</dd>
                  <dt>What I did</dt><dd>{f.did}</dd>
                  <dt>Result</dt><dd>{f.result}</dd>
                </dl>
                <Link className="flag-more" href={`/work/${f.slug}`}>Read the case study →</Link>
              </div>
              <div className="flag-lab">
                <p className="try mono">{f.tryIt}</p>
                {f.lab}
              </div>
            </article>
          ))}
        </section>

        <section className="sec" aria-labelledby="more-h">
          <div className="sec-head">
            <h2 id="more-h">More from qlub</h2>
            <p>Smaller systems, each in regular use</p>
          </div>
          <ul className="rows more">
            {more.map((w) => (
              <li key={w.slug}>
                <Link href={`/work/${w.slug}`}><b>{w.system}</b></Link>
                <span>{w.outcome}</span>
                <span className="mono faint">{w.since.slice(0, 4)}</span>
              </li>
            ))}
            {alsoBuilt.map(([name, what, year]) => (
              <li key={name}>
                <b>{name}</b>
                <span>{what}</span>
                <span className="mono faint">{year}</span>
              </li>
            ))}
          </ul>
          <p className="caption">
            The code is private, and this page leaves out company data and internal rules. The interactive examples use
            made-up numbers. I am happy to walk through any of it in an interview.
          </p>
        </section>

        <section className="sec" id="mifolio" aria-labelledby="mifolio-h">
          <div className="sec-head">
            <h2 id="mifolio-h">Mifolio, my own product</h2>
            <p>Designed and built September 2026</p>
          </div>
          <div className="product">
            <div>
              <p className="tag faint">Personal finance tracker · Next.js, Supabase, Claude API</p>
              <p>
                I wanted to see what I spend, as I spend it, across three cards and a buy-now-pay-later account. None of
                the banks offer an API, so Mifolio reads what they already send: card SMS, bank emails and Apple Wallet
                taps.
              </p>
              <p>
                Each purchase is counted once even when it arrives three ways, sorted into categories by UAE merchant
                rules with Claude handling the rest, and shown against what is usual for me.
              </p>
              <p className="links">
                <a className="btn" href="/finance?demo=1" target="_blank" rel="noopener">Try the full demo ↗</a>
                <a href="/notes/why-i-built-mifolio">Why I built it</a>
                <a href="/notes/reading-bank-sms">How it counts each purchase once</a>
              </p>
            </div>
            <dl>
              <dt>Role</dt><dd>Designed and built it</dd>
              <dt>Inputs</dt><dd>SMS, email and Wallet into one private endpoint</dd>
              <dt>Data</dt><dd>My own Supabase, behind row-level security</dd>
              <dt>Status</dt><dd>Private; everything shown here is made-up data</dd>
            </dl>
          </div>
          <p className="try mono">Hover or tap the charts: a slice, a day on the pace line, a point on net worth.</p>
          <MifolioMini />
          <figure className="mf-print">
            <Image src="/mifolio/categories.png" alt="Mifolio category breakdown: a ring chart of spending by category over the last three months" width={1202} height={1445} />
          </figure>
        </section>

        <section className="sec" id="matchday" aria-labelledby="matchday-h">
          <div className="sec-head">
            <h2 id="matchday-h">A football tracker</h2>
            <p>Designed and built October 2026</p>
          </div>
          <div className="product">
            <div>
              <h3>Matchday</h3>
              <p className="tag faint">Football scores and live fantasy points · Next.js, ESPN and FPL feeds</p>
              <p>
                The score apps I used had got slower and louder: pop-up ads over the match, favourites moved around, ratings
                nobody could explain. Matchday puts the teams you follow first, refreshes only while a match is on, and says
                how old every number is. A spoiler mode hides scores until you tap.
              </p>
              <p>
                Match pages have a shot map and an expected-goals timeline from my own model, fitted on 25,513 shots from
                StatsBomb’s open data and shown next to Opta’s figure where FPL publishes it. The fantasy page works out live
                points, projected autosubs and which players move you against your mini-league.
              </p>
              <p className="links">
                <a href="/sport">Open Matchday</a>
                <a href="/sport/following#xg">How the xG model works</a>
              </p>
            </div>
            <dl>
              <dt>Role</dt><dd>Designer and sole engineer</dd>
              <dt>Data</dt><dd>ESPN’s public feed straight from the browser; FPL through two cached routes</dd>
              <dt>Cost</dt><dd>Nothing to run: static pages, no database, no paid APIs</dd>
              <dt>Status</dt><dd>Football now; cricket, F1 and wrestling to follow</dd>
            </dl>
          </div>
        </section>

        <section className="sec" id="notes" aria-labelledby="notes-h">
          <div className="sec-head">
            <h2 id="notes-h">Writing</h2>
            <p>Notes on building Mifolio</p>
          </div>
          <ul className="rows notes">
            {notes.map((n) => (
              <li key={n.slug}>
                <a href={`/notes/${n.slug}`}><b>{n.title}</b></a>
                <span>{n.summary}</span>
                <span className="mono faint">{n.short}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="sec" aria-labelledby="how-h">
          <div className="sec-head">
            <h2 id="how-h">How I work</h2>
          </div>
          <div className="two">
            <p>
              Most of what I have built started as a conversation with the person doing the work by hand. The first
              version is small and goes to them early. What matters then gets tests, plain-language error messages and a
              written note on why it works the way it does.
            </p>
            <p>
              I check numbers before I trust them: new data sources get compared with live data, and dashboards get
              reconciled with the source until they match. I use AI coding tools as a pair programmer; the requirements,
              decisions, testing and rollout stay with me.
            </p>
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
            Before qlub I spent two years in marketing, so I can still cut a video, run an ad account and lay out a deck.
            It helps when a piece of analysis has to persuade someone.
          </p>
        </section>

        <section className="sec" id="az" aria-labelledby="az-h">
          <div className="sec-head">
            <h2 id="az-h">Typing challenge</h2>
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
                The grey marker shows my record pace. Your time stays in this browser.
              </p>
            </div>
            <Alphabet />
          </div>
        </section>
      </main>

      <footer className="foot">
        <span><CopyEmail /> · <a href="tel:+971589606420">+971 58 960 6420</a> · <a href="https://github.com/xdMikayu">GitHub</a></span>
        <span>Updated {UPDATED}. <a href="/resume.json">Résumé as JSON</a>.<span className="kb-hint"> Press <kbd className="mono">/</kbd> for the menu.</span></span>
        <ThemeToggle />
      </footer>
    </div>
  );
}
