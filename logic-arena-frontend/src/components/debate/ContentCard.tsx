interface Props {
  label: string;
  text: string | null;
  side?: 'pro' | 'con' | 'ai' | 'neutral';
  loading?: boolean;
}

const SIDE_COLORS = {
  pro: { border: 'rgba(22,163,74,0.3)', bg: 'rgba(22,163,74,0.06)', label: 'var(--color-pro)' },
  con: { border: 'rgba(220,38,38,0.3)', bg: 'rgba(220,38,38,0.06)', label: 'var(--color-con)' },
  ai: { border: 'rgba(8,145,178,0.3)', bg: 'rgba(8,145,178,0.06)', label: 'var(--color-ai)' },
  neutral: { border: 'var(--color-border)', bg: 'var(--color-surface-2)', label: 'var(--color-text-muted)' },
};

export function ContentCard({ label, text, side = 'neutral', loading = false }: Props) {
  const colors = SIDE_COLORS[side];

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: colors.label, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      {loading ? (
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          생성 중...
        </span>
      ) : text ? (
        <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text)', margin: 0 }}>{text}</p>
      ) : (
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          대기 중...
        </span>
      )}
    </div>
  );
}
