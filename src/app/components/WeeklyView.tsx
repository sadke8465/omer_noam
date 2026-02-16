import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Sparkles } from 'lucide-react';
import type { Task } from './TaskCard';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const ASSIGNEE_CONFIG: Record<
  string,
  { name: string; verb: string; color: string; dotColor: string }
> = {
  noam: { name: 'נועם', verb: 'צריך', color: 'text-blue-600', dotColor: 'bg-blue-500' },
  omer: { name: 'עומר', verb: 'צריכה', color: 'text-pink-500', dotColor: 'bg-pink-400' },
  both: { name: 'שניכם', verb: 'צריכים', color: 'text-violet-600', dotColor: 'bg-violet-500' },
};

interface WeeklyViewProps {
  tasks: Task[];
  onToggle: (id: number) => void;
}

function getWeekRange(): { start: Date; end: Date; dates: Date[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  const end = new Date(dates[6]);
  return { start, end, dates };
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function joinTitles(titles: string[]): string {
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} ו${titles[1]}`;
  const last = titles[titles.length - 1];
  const rest = titles.slice(0, -1);
  return `${rest.join(', ')} ו${last}`;
}

interface DayGroup {
  date: Date;
  dateKey: string;
  dayIndex: number;
  assigneeGroups: {
    assignee: string;
    tasks: Task[];
  }[];
}

export default function WeeklyView({ tasks, onToggle }: WeeklyViewProps) {
  const { dates } = useMemo(() => getWeekRange(), []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(today.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrowDate);

  const { activeDays, completedThisWeek } = useMemo(() => {
    // Map date keys for this week
    const weekKeys = new Set(dates.map(toDateKey));

    // Filter tasks that fall in this week and have a due date
    const weekTasks = tasks.filter((t) => t.due_date && weekKeys.has(t.due_date));

    const active = weekTasks.filter((t) => !t.is_complete);
    const completed = weekTasks.filter((t) => t.is_complete);

    // Group active tasks by day, then by assignee
    const dayMap = new Map<string, Task[]>();
    active.forEach((t) => {
      if (!t.due_date) return;
      const existing = dayMap.get(t.due_date) || [];
      existing.push(t);
      dayMap.set(t.due_date, existing);
    });

    const activeDays: DayGroup[] = [];
    dates.forEach((date) => {
      const key = toDateKey(date);
      const dayTasks = dayMap.get(key);
      if (!dayTasks || dayTasks.length === 0) return;

      // Group by assignee
      const assigneeMap = new Map<string, Task[]>();
      dayTasks.forEach((t) => {
        const existing = assigneeMap.get(t.assignee) || [];
        existing.push(t);
        assigneeMap.set(t.assignee, existing);
      });

      const assigneeGroups = Array.from(assigneeMap.entries()).map(([assignee, tasks]) => ({
        assignee,
        tasks,
      }));

      activeDays.push({
        date,
        dateKey: key,
        dayIndex: date.getDay(),
        assigneeGroups,
      });
    });

    return { activeDays, completedThisWeek: completed };
  }, [tasks, dates]);

  function getDayLabel(dateKey: string, dayIndex: number): string {
    if (dateKey === todayKey) return 'היום';
    if (dateKey === tomorrowKey) return 'מחר';
    return `ביום ${DAY_NAMES[dayIndex]}`;
  }

  function isPast(dateKey: string): boolean {
    return dateKey < todayKey;
  }

  // Build week date range label
  const weekLabel = `${formatDateShort(dates[0])} – ${formatDateShort(dates[6])}`;

  return (
    <div className="pt-2">
      {/* Week header */}
      <div className="mb-5">
        <h2 className="text-[18px] text-gray-900">השבוע שלכם</h2>
        <p className="text-[12px] text-gray-300 mt-0.5">{weekLabel}</p>
      </div>

      {/* Active days */}
      {activeDays.length === 0 && completedThisWeek.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="flex flex-col items-center py-20 text-center gpu-accelerated"
        >
          <Sparkles className="w-8 h-8 text-gray-200 mb-3" />
          <p className="text-[14px] text-gray-300">שבוע נקי!</p>
          <p className="text-[12px] text-gray-300 mt-1">אין משימות השבוע</p>
        </motion.div>
      ) : (
        <div className="space-y-1">
          {activeDays.map((dayGroup, dayIdx) => {
            const dayLabel = getDayLabel(dayGroup.dateKey, dayGroup.dayIndex);
            const isOverdue = isPast(dayGroup.dateKey);
            const isToday = dayGroup.dateKey === todayKey;

            return (
              <motion.div
                key={dayGroup.dateKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: dayIdx * 0.06,
                  type: 'spring',
                  stiffness: 400,
                  damping: 28,
                }}
                className={`
                  bg-white rounded-2xl
                  shadow-[0_1px_3px_rgba(0,0,0,0.04)]
                  px-5 py-4 mb-2.5
                  gpu-accelerated
                  ${isOverdue ? 'border border-red-100' : ''}
                `}
              >
                {/* Day label */}
                <div className="flex items-center gap-2 mb-2.5">
                  {isToday && (
                    <div className="w-[6px] h-[6px] rounded-full bg-gray-900" />
                  )}
                  {isOverdue && (
                    <div className="w-[6px] h-[6px] rounded-full bg-red-400" />
                  )}
                  <span
                    className={`
                      text-[13px]
                      ${isOverdue ? 'text-red-400' : isToday ? 'text-gray-900' : 'text-gray-400'}
                    `}
                  >
                    {dayLabel}
                    {isOverdue && ' · באיחור'}
                  </span>
                </div>

                {/* Assignee sentences */}
                <div className="space-y-2">
                  {dayGroup.assigneeGroups.map((group, gIdx) => {
                    const config = ASSIGNEE_CONFIG[group.assignee];
                    const titles = group.tasks.map((t) => t.title);
                    const sentence = joinTitles(titles);

                    return (
                      <motion.div
                        key={group.assignee}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: dayIdx * 0.06 + gIdx * 0.04 + 0.1 }}
                        className="flex items-start gap-2"
                      >
                        <div
                          className={`w-[6px] h-[6px] rounded-full mt-[7px] flex-shrink-0 ${config.dotColor}`}
                        />
                        <p className="text-[14px] text-gray-700 leading-relaxed">
                          <span className={config.color}>{config.name}</span>
                          {' '}
                          <span className="text-gray-400">{config.verb}</span>
                          {' '}
                          {sentence}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          {/* Completed this week */}
          <AnimatePresence>
            {completedThisWeek.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: activeDays.length * 0.06 + 0.15 }}
                className="pt-4"
              >
                <div className="flex items-center gap-3 mb-3 px-1">
                  <div className="h-px bg-gray-200/60 flex-1" />
                  <span className="text-[11px] text-gray-300 tracking-wide">
                    כבר עשיתם השבוע
                  </span>
                  <div className="h-px bg-gray-200/60 flex-1" />
                </div>

                <div className="bg-white/60 rounded-2xl px-5 py-3.5 space-y-2.5 gpu-accelerated">
                  {completedThisWeek.map((task, idx) => {
                    const config = ASSIGNEE_CONFIG[task.assignee];
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          delay: activeDays.length * 0.06 + 0.2 + idx * 0.04,
                        }}
                        className="flex items-center gap-2.5"
                      >
                        <button
                          onClick={() => onToggle(task.id)}
                          className={`
                            flex-shrink-0 w-[18px] h-[18px] rounded-full
                            ${config.dotColor} flex items-center justify-center
                            transition-all hover:opacity-80
                          `}
                        >
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </button>
                        <span className="text-[13px] text-gray-400 line-through">
                          {task.title}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
