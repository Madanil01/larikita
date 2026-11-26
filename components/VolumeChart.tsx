'use client';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeekPoint } from '@/lib/stats';

// Warna = token tema (app/globals.css)
const TRACK = 'rgb(34 84 66)', MUTED = 'rgba(24,26,27,0.45)', GRID = 'rgba(24,26,27,0.06)', AMBER = 'rgb(240 178 92)';

export default function VolumeChart({ data, todayMonday }: { data: WeekPoint[]; todayMonday: string }) {
  return (
    <div className="mt-3 h-60 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TRACK} stopOpacity={0.22} />
              <stop offset="100%" stopColor={TRACK} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="monday" tickFormatter={(_, i) => data[i]?.label ?? ''} interval={0} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: 'rgba(24,26,27,0.15)' }}
            contentStyle={{ background: '#fff', border: '1px solid rgba(24,26,27,0.08)', borderRadius: 12, fontSize: 12, boxShadow: '0 8px 24px rgba(24,26,27,0.08)' }}
            labelFormatter={(m) => `Minggu ${m}`}
            formatter={(v: number, k: string) => [`${v} km`, k === 'aktual' ? 'Aktual' : 'Rencana']}
          />
          <ReferenceLine x={todayMonday} stroke={AMBER} strokeWidth={2} label={{ value: 'sekarang', position: 'insideTopRight', fill: MUTED, fontSize: 10 }} />
          {/* rencana = garis putus-putus tipis, aktual = area hijau */}
          <Area type="monotone" dataKey="rencana" stroke={MUTED} strokeWidth={1.5} strokeDasharray="4 4" fill="none" connectNulls={false} />
          <Area type="monotone" dataKey="aktual" stroke={TRACK} strokeWidth={2.25} fill="url(#gA)" connectNulls={false} activeDot={{ r: 4, strokeWidth: 0, fill: TRACK }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
