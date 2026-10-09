import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Link-preview card, 1200x630. Ink on paper with the site's one green accent; text kept
// inside the centre so LinkedIn, Slack and WhatsApp crops don't cut it.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const font = (pkg, file) => readFile(path.join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', file));

export async function card({ kicker, title, sub }) {
  const [regular, bold, mono] = await Promise.all([
    font('familjen-grotesk', 'familjen-grotesk-latin-400-normal.woff'),
    font('familjen-grotesk', 'familjen-grotesk-latin-600-normal.woff'),
    font('martian-mono', 'martian-mono-latin-400-normal.woff'),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fafaf8', color: '#17191c', padding: '72px 84px', fontFamily: 'Familjen' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Martian', fontSize: 22, color: '#737883' }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: '#1e6b52', marginRight: 14 }} />
          {kicker}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: title.length > 34 ? 64 : 84, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
          {sub && <div style={{ marginTop: 26, fontSize: 32, color: '#4d525b', maxWidth: 980, lineHeight: 1.35 }}>{sub}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e2dd', paddingTop: 26, fontFamily: 'Martian', fontSize: 22, color: '#737883' }}>
          <span>mikaeelfaraz.com</span>
          <span>Dubai</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Familjen', data: regular, weight: 400, style: 'normal' },
        { name: 'Familjen', data: bold, weight: 600, style: 'normal' },
        { name: 'Martian', data: mono, weight: 400, style: 'normal' },
      ],
    },
  );
}
