'use client';

import { useEffect, useState } from 'react';

// "Dubai" in the top bar, with the time there. Useful for anyone scheduling a call.
const fmt = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' }).format(new Date());

export default function LocalTime({ name = true }) {
  const [t, setT] = useState(null);
  useEffect(() => {
    setT(fmt());
    const id = setInterval(() => setT(fmt()), 20000);
    return () => clearInterval(id);
  }, []);
  return (
    <a className={`home-mark${name ? '' : ' bare'}`} href="/" aria-label="Mikaeel Faraz, home">
      {name && <b>Mikaeel Faraz</b>}
      <span className="mono faint">Dubai{t ? ` ${t}` : ''}</span>
    </a>
  );
}
