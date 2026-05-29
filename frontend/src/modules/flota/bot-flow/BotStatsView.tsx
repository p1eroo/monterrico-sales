import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, ArrowRightLeft, AlertTriangle, Clock, UserX, Target, CheckCircle2 } from 'lucide-react';

const STATS = [
  { label: 'Conversations started', value: '342', icon: BarChart3, color: 'text-blue-600 bg-blue-100' },
  { label: 'Completed', value: '246', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100' },
  { label: 'Leads captured', value: '189', icon: Target, color: 'text-cyan-600 bg-cyan-100' },
  { label: 'Conversion rate', value: '55%', icon: TrendingUp, color: 'text-green-600 bg-green-100' },
  { label: 'Handoff rate', value: '18%', icon: ArrowRightLeft, color: 'text-amber-600 bg-amber-100' },
  { label: 'Error rate', value: '2.1%', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  { label: 'Avg qualification time', value: '4m 32s', icon: Clock, color: 'text-violet-600 bg-violet-100' },
  { label: 'Abandonment rate', value: '8%', icon: UserX, color: 'text-rose-600 bg-rose-100' },
];

const DAILY_DATA = [
  { day: 'Mon', conversations: 48, completed: 36 },
  { day: 'Tue', conversations: 52, completed: 40 },
  { day: 'Wed', conversations: 45, completed: 32 },
  { day: 'Thu', conversations: 55, completed: 42 },
  { day: 'Fri', conversations: 60, completed: 48 },
  { day: 'Sat', conversations: 38, completed: 28 },
  { day: 'Sun', conversations: 30, completed: 20 },
];

const maxVal = Math.max(...DAILY_DATA.map((d) => d.conversations));

export default function BotStatsView() {
  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto">
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 flex items-start gap-3">
            <div className={cn('rounded-md p-2 shrink-0', s.color)}>
              <s.icon className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Performance by day (last 7 days)</h3>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-end gap-3 h-40">
            {DAILY_DATA.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t bg-emerald-400 transition-all"
                    style={{ height: `${(d.completed / maxVal) * 100}%` }}
                  />
                  <div
                    className="w-full rounded-t bg-blue-400 transition-all"
                    style={{ height: `${((d.conversations - d.completed) / maxVal) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-emerald-400" /> Completed</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-blue-400" /> Started</span>
          </div>
        </div>
      </div>
    </div>
  );
}
