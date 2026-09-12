import { Area, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisToman, formatCompactToman, formatExactToman, type BalanceFlowPoint } from "./balance-flow";
import { useIsMobile } from "@/hooks/use-mobile";

function TooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload: BalanceFlowPoint }> }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return <div dir="rtl" className="rounded-lg border border-border bg-surface p-3 text-sm shadow-lg"><strong>{point.date}</strong><p className="mt-1">تغییر روزانه: {formatCompactToman(point.netRial)}</p><p>مانده کل: {formatExactToman(point.cumulativeRial)}</p></div>;
}

export function BalanceFlowChart({ points }: { points: BalanceFlowPoint[] }) {
  const isMobile = useIsMobile();
  if (points.length < 2) return null;
  const total = points.at(-1)?.cumulativeRial ?? 0;
  const crossesZero = points.some((point) => point.cumulativeRial === 0) || points.slice(1).some((point, index) => point.cumulativeRial * points[index].cumulativeRial < 0);
  return <section className="balance-flow-chart rounded-xl border border-border bg-surface p-4" aria-label={`روند مانده حساب‌ها از ${points[0].date} تا ${points.at(-1)?.date}، مانده کل ${formatExactToman(total)}`} role="img"><h2 className="font-semibold">روند مانده حساب‌ها</h2><p className="mt-1 text-xs text-muted-foreground">{points[0].date} تا {points.at(-1)?.date} · مانده کل: {formatExactToman(total)}</p><div className="mt-4 h-52" dir="ltr"><ResponsiveContainer height="100%" width="100%"><LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="flow-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: isMobile ? 10 : 11 }} tickLine={false} /><YAxis axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: isMobile ? 10 : 11 }} tickFormatter={formatAxisToman} tickLine={false} width={isMobile ? 44 : 56} /><Tooltip content={<TooltipContent />} /><Area dataKey="cumulativeRial" fill="url(#flow-fill)" isAnimationActive={false} stroke="none" type="monotone" /><Line activeDot={{ r: 5 }} dataKey="cumulativeRial" dot={false} isAnimationActive={false} stroke="var(--primary)" strokeWidth={2.5} type="monotone" />{crossesZero && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}</LineChart></ResponsiveContainer></div><table className="sr-only" aria-label="مقادیر روزانه مانده حساب‌ها"><caption>مقادیر روزانه مانده حساب‌ها</caption><thead><tr><th>روز</th><th>تغییر روز</th><th>مانده کل</th></tr></thead><tbody>{points.map((point) => <tr key={point.date}><td>{point.date}</td><td>{formatCompactToman(point.netRial)}</td><td>{formatExactToman(point.cumulativeRial)}</td></tr>)}</tbody></table></section>;
}
