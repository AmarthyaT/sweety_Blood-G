import Icon from './Icon.jsx';

const CARDS = [
  {
    key: 'highest',
    label: 'Highest',
    icon: 'trend',
    tone: 'high',
    format: (value) => (value === null ? '—' : String(value)),
  },
  {
    key: 'lowest',
    label: 'Lowest',
    icon: 'droplet',
    tone: 'low',
    format: (value) => (value === null ? '—' : String(value)),
  },
  {
    key: 'average',
    label: 'Average',
    icon: 'chart',
    tone: 'avg',
    format: (value) => (value === null ? '—' : Number(value).toFixed(1)),
  },
  {
    key: 'count',
    label: 'Readings',
    icon: 'calendar',
    tone: 'count',
    format: (value) => String(value),
  },
];

export default function StatCards({ stats }) {
  return (
    <div className="stat-grid">
      {CARDS.map((card) => (
        <article key={card.key} className={`stat-card stat-${card.tone}`}>
          <div className="stat-head">
            <span className="stat-icon">
              <Icon name={card.icon} size={18} />
            </span>
            <span>{card.label}</span>
          </div>
          <p className="stat-value">
            {card.format(stats[card.key])}
            {card.key !== 'count' && stats[card.key] !== null && (
              <span className="stat-unit">mg/dl</span>
            )}
          </p>
          <p className="stat-caption">
            {card.key === 'count'
              ? stats.count === 1
                ? 'reading in this period'
                : 'readings in this period'
              : card.key === 'average'
                ? 'rounded to 1 decimal'
                : 'in this period'}
          </p>
        </article>
      ))}
    </div>
  );
}
