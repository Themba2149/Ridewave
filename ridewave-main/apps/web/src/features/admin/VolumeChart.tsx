import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Analytics } from './types';

export default function VolumeChart({ data }: { data: Analytics['volume'] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, label: d.date.slice(5) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="requested" name="Requested" fill="#0B1220" radius={[3, 3, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="#8DB814" radius={[3, 3, 0, 0]} />
          <Bar dataKey="cancelled" name="Cancelled" fill="#DC2626" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
