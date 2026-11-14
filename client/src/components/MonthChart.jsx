import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatShortDate, slotLabel } from '../utils/format.js';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <strong>{point.value} mg/dl</strong>
      <span>
        {slotLabel(point.slot)} · {formatShortDate(point.date)}
      </span>
    </div>
  );
}

/**
 * One point per reading, in date + slot order.
 */
export default function MonthChart({ readings }) {
  const data = readings.map((reading) => ({
    date: reading.date,
    slot: reading.slot,
    value: reading.value,
    label: formatShortDate(reading.date),
  }));

  // Keep the 70-180 target band readable, but never clip a real value.
  const highest = Math.max(...data.map((point) => point.value), 180);
  const chartMax = Math.min(600, Math.max(260, Math.ceil((highest + 20) / 20) * 20));

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e3ece9" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b817c', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#dbe7e4' }}
            minTickGap={18}
          />
          <YAxis
            domain={[40, chartMax]}
            tick={{ fill: '#6b817c', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={42}
          />
          <ReferenceLine y={180} stroke="#e8a23a" strokeDasharray="4 4" strokeOpacity={0.8} />
          <ReferenceLine y={70} stroke="#e8a23a" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#0d9488', strokeDasharray: '4 4' }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0f766e"
            strokeWidth={2.4}
            dot={{ r: 3, fill: '#ffffff', stroke: '#0f766e', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: '#0f766e' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="chart-legend">
        <span className="legend-line" /> Readings
        <span className="legend-dash" /> Target band 70–180 mg/dl
      </p>
    </div>
  );
}
