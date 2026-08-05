import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AiBadge({ title = "Suggerimento AI", text = "Valore estratto dall'Intelligenza Artificiale (AI Act UE). Verifica il dato prima di confermare." }) {
  return (
    <span
      title={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(168, 85, 247, 0.1)',
        color: 'var(--accent, #a855f7)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        cursor: 'help'
      }}
    >
      <Sparkles size={12} />
      {title}
    </span>
  );
}
