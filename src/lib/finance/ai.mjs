// Claude-powered helpers: merchant categorization and a monthly spending summary.
// Both are optional — without ANTHROPIC_API_KEY the tracker falls back to rules.
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES } from './categories.mjs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client;
function getClient() {
  if (!client) client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  return client;
}

// Opus 5 can decline a request via its safety classifiers; `fallbacks: "default"`
// re-runs a declined request on Anthropic's recommended fallback model server-side.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

function textOf(response) {
  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined the request${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : ''}`);
  }
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

const CATEGORIZE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          category: { type: 'string', enum: CATEGORIES },
        },
        required: ['id', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
};

/**
 * Classify merchants into CATEGORIES.
 * `items` is [{ merchant, raw, amountAed }]. Returns Map(merchant → category).
 */
export async function categorizeMerchants(items) {
  if (!items.length) return new Map();
  const list = items
    .map((it, i) => `${i}. ${it.merchant}${it.raw && it.raw !== it.merchant ? ` (descriptor: ${it.raw})` : ''} — typical amount AED ${it.amountAed}`)
    .join('\n');

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CATEGORIZE_SCHEMA } },
    system:
      'You categorize card transactions for a personal budget tracker. The cardholder lives in the UAE (Dubai/Sharjah), so merchants are mostly UAE businesses; use your knowledge of UAE brands. ' +
      'Pick the single best category for each merchant. Use "Other" only when the merchant genuinely cannot be identified. ' +
      'Categories: ' + CATEGORIES.join(', ') + '.',
    messages: [{ role: 'user', content: `Categorize each merchant by its number:\n\n${list}` }],
  });

  const parsed = JSON.parse(textOf(response));
  const out = new Map();
  for (const r of parsed.results || []) {
    const item = items[r.id];
    if (item && CATEGORIES.includes(r.category)) out.set(item.merchant, r.category);
  }
  return out;
}

/** A short plain-English read of the spending summary the dashboard computed. */
export async function spendingInsights(summary) {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: 'medium' },
    system:
      'You are a friendly, direct personal-finance assistant for someone in the UAE. Amounts are in AED. ' +
      'Given a JSON spending summary, write 4–6 short bullet points: where the money went, what changed versus the comparison period and why (name categories and merchants), ' +
      'anything unusual (one-off large purchases, new recurring charges, categories over budget), and one or two concrete, realistic suggestions. ' +
      'Use the numbers given; do not invent transactions. Plain text bullets starting with "• ", no headings, no markdown bold.',
    messages: [{ role: 'user', content: JSON.stringify(summary) }],
  });
  return textOf(response).trim();
}
