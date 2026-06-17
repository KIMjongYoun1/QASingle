interface DonutSegment {
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  total: number;
  centerLabel?: string;
  centerSub?: string;
  size?: number;
}

export function DonutChart({ segments, total, centerLabel, centerSub, size = 110 }: DonutChartProps) {
  const stroke = size * 0.18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          if (!s.value || !total) return null;
          const frac = s.value / total;
          const dash = frac * c;
          const dashOffset = -offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerLabel && <div className="text-xl font-extrabold text-primary">{centerLabel}</div>}
        {centerSub && <div className="mt-0.5 text-[10px] text-muted-foreground">{centerSub}</div>}
      </div>
    </div>
  );
}
