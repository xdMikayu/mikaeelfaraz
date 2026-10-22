// Privacy policy, in plain language. Readable without an account (see PUBLIC_PAGES in FinanceShell).
// Keep it true to the code: if what Mifolio stores or sends anywhere changes, update this page.
import Link from 'next/link';

export const metadata = { title: 'Privacy · Mifolio' };

const UPDATED = '22 October 2026';
// Where people can reach you about their data. Set before inviting anyone.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_FINANCE_CONTACT_EMAIL || '';

function H({ children }) {
  return <h2 className="fin-h2 mt-8">{children}</h2>;
}

export default function Privacy() {
  return (
    <article className="mx-auto max-w-2xl space-y-3 text-[15px] leading-relaxed fin-ink-2">
      <p className="fin-eyebrow">Last updated {UPDATED}</p>
      <h1 className="fin-h1" style={{ color: 'var(--fin-ink)' }}>Privacy</h1>
      <p>Mifolio keeps track of your card spending from the alerts your banks already send you. This page says exactly what that means for your data.</p>

      <H>What Mifolio stores</H>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Your account:</b> your email address and a password (stored hashed by our login provider, never readable by us).</li>
        <li><b>Card alerts you send it:</b> the text of the bank SMS, email or app notification your iPhone Shortcut or Gmail script forwards, and what Mifolio reads from it: merchant, amount, currency, date, the card’s last 4 digits and the available balance or limit if the alert includes one.</li>
        <li><b>Things you enter:</b> card names and limits, budgets, categories and notes, and the holdings on your Net worth page.</li>
        <li><b>API keys:</b> only a one-way hash of each key, so a stored key can’t be used even if read.</li>
      </ul>
      <p>Mifolio never asks for your bank login, card numbers or PIN, and can’t move money.</p>

      <H>Where it lives</H>
      <p>Your data is stored in a database hosted by Supabase and processed by the site’s server functions on Netlify. Row-level security means each account can only ever read its own rows.</p>

      <H>Who else sees anything</H>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Anthropic (Mifolio AI):</b> to sort an unfamiliar merchant into a category, Mifolio sends the merchant name, the bank’s description of it and a typical amount. For Insights, it sends a spending summary (totals by category and merchant). No email address, card digits or account details are sent. Anthropic doesn’t use API data to train its models.</li>
        <li><b>Price sources:</b> Mifolio fetches public prices for stocks, crypto, gold and exchange rates. Nothing about you is sent.</li>
      </ul>
      <p>Mifolio doesn’t sell your data, show ads or share it with anyone else.</p>

      <H>Your controls</H>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Download everything:</b> Setup → Your data → Download, as a JSON file.</li>
        <li><b>Delete everything:</b> Setup → Your data → Delete account. Your account and every row of your data are deleted immediately and can’t be recovered.</li>
        <li><b>Revoke access:</b> Setup → API keys. A revoked key stops working at once.</li>
      </ul>

      <H>Contact</H>
      <p>{CONTACT_EMAIL ? <>Questions about your data: <a className="fin-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</> : <>Questions about your data: use the contact details on <Link className="fin-link" href="/">the main site</Link>.</>}</p>
      <p className="pt-6 text-xs fin-muted">Mifolio is in beta. If this policy changes in a way that affects your data, you’ll be told in the app first.</p>
    </article>
  );
}
