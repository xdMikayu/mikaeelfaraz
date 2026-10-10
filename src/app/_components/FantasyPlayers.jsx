'use client';
import { useState } from 'react';
import Prices from './FantasyPrices';

const VIEWS = [['prices', 'Prices']];

/** Everything about individual players: prices for now; comparison, watchlist and team news next. */
export default function Players({ st, teams, squad }) {
  const [view, setView] = useState('prices');
  return (
    <div>
      <div className="sp-pad" style={{ marginTop: 10 }}>
        <div className="sp-tabs" role="tablist" aria-label="Players" style={{ gap: 16 }}>
          {VIEWS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} style={{ height: 36, fontSize: 14 }}>{l}</button>
          ))}
        </div>
      </div>
      {view === 'prices' && <Prices st={st} teams={teams} squad={squad} />}
    </div>
  );
}
