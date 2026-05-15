import { useEffect, useState } from 'react';

interface Props {
  phaseEndAt: number | null;
}

export function PhaseTimer({ phaseEndAt }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!phaseEndAt) { setRemaining(0); return; }
    const update = () => setRemaining(Math.max(0, phaseEndAt - Date.now()));
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [phaseEndAt]);

  const totalSecs = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const isUrgent = remaining > 0 && remaining < 30_000;

  if (!phaseEndAt) return null;

  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700,
        fontSize: '15px',
        color: isUrgent ? 'var(--color-danger)' : 'var(--color-text-muted)',
        transition: 'color 0.3s',
      }}
    >
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}
