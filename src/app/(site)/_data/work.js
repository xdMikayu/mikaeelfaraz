// Kept general on purpose: no company names for internal tools or programmes, no internal rules,
// no business figures and no incident details. The stack lines are the tools I work with.

export const selected = [
  {
    slug: 'ops-platform',
    system: 'Internal operations platform',
    outcome: 'Dashboards, guides and forms in one internal app, with the scheduled data jobs behind them. Used by operations, support and leadership.',
    stack: 'React, Netlify Functions, Supabase, Postgres',
    since: '2026-04',
    status: 'In production',
    node: 'platform',
  },
  {
    slug: 'merchant-onboarding',
    system: 'Self-service merchant onboarding',
    outcome: 'New merchants onboard themselves from one secure link, and a single publish step sets them up across the internal systems. Built in 30 days.',
    stack: 'React, Netlify Functions, Zoho CRM, Notion, Slack',
    since: '2026-08',
    status: 'In production',
    node: 'onboarding',
  },
  {
    slug: 'reporting-stack',
    system: 'Reporting pipeline',
    outcome: 'BI and CRM data synced into Postgres on a schedule and reconciled until it matches the BI tool’s own totals.',
    stack: 'Tableau, Zoho Analytics SQL, Supabase',
    since: '2026-01',
    status: 'In production',
    node: 'reporting',
  },
  {
    slug: 'crm-task-engine',
    system: 'CRM task automation',
    outcome: 'Watches every live venue daily and turns meaningful changes into tasks for the right account manager.',
    stack: 'Zoho CRM, Deluge, Slack, AWS Lambda',
    since: '2026-01',
    status: 'In production',
    node: 'crm',
  },
  {
    slug: 'incident-webhook',
    system: 'Alert to ticket webhook',
    outcome: 'Production alerts become support tickets in real time, once, on the right account.',
    stack: 'Netlify Functions, HMAC-SHA256, Zoho Desk API, Supabase',
    since: '2026-07',
    status: 'In production',
    node: 'incidents',
  },
  {
    slug: 'reviews-impact',
    system: 'Ratings impact report',
    outcome: 'A monthly before-and-after look at merchants’ public ratings once they go live.',
    stack: 'Python, Playwright',
    since: '2026-01',
    status: 'Monthly',
    node: 'reviews',
  },
];

export const alsoBuilt = [
  ['Offline monitoring', 'A daily view of merchants that have stopped transacting, with a morning summary in Slack.', '2026'],
  ['Print artwork generator', 'Turns form data into print-ready artwork as vector PDF, through a small PDF writer I wrote for it.', '2026'],
  ['Programme measurement', 'A difference-in-differences model that measures an incentive programme against a control group.', '2026'],
  ['Helpdesk and Trello sync', 'Two-way sync between support tickets and the board the technical team works from.', '2026'],
  ['WhatsApp support inbox', 'WhatsApp Cloud API connected to Slack, with an inbox page for a support team.', '2026'],
  ['Automated statements', 'Weekly WhatsApp statements from a script that dry-runs first and emails an audit of every send.', '2025'],
  ['Leadership summaries', 'A weekly market summary over WhatsApp, built on the same synced data.', '2026'],
  ['Lead sourcing', 'Scraped and enriched public business listings into leads for a sales team.', '2026'],
  ['POS log analyser', 'An in-browser tool that parses POS payment logs to find data-quality problems.', '2026'],
];

export const earlier = [
  ['2025', 'GetDopamine', 'Web development intern', 'Laravel, MySQL and Vue.js features, and a WhatsApp Business API integration.'],
  ['2024–25', 'Dunkin’ Donuts UAE', 'Data science intern', 'Store-level demand forecasts for 80+ stores (XGBoost, Prophet) and a Next.js dashboard over a Django API to compare the models. It became my capstone and won 1st place at the UOWD Innovation Fair 2025.'],
  ['2023', 'Formula 1 Abu Dhabi Grand Prix', 'Customer service supervisor, Class Act Events', 'Supervised customer service over the race weekend.'],
  ['2022–24', 'Asian Street by Thai', 'Marketing manager', 'Built the restaurant’s online presence from nothing: delivery platforms, Google Business, paid social.'],
  ['', 'SolPay', 'Blockchain developer', 'Solana payment flows and a Shopify integration for a crypto payments product.'],
  ['2023–25', 'University of Wollongong in Dubai', 'BSc Computer Science', 'Big Data and AI major. Graduated with distinction.'],
];
