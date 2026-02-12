import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import TaskCard, { type Task } from './TaskCard';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

interface CalendarViewProps {
  tasks: Task[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateNotes: (id: number, notes: string) => void;
  onUpdateDueDate?: (id: number, dueDate: string | null) => void;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [];

  // Leading blanks
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }
  // Trailing blanks to fill last row
  while (days.length % 7 !== 0) {
    days.push(null);
  }
  return days;
}

export default function CalendarView({ tasks, onToggle, onDelete, onUpdateNotes, onUpdateDueDate }: CalendarViewProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);

  const days = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Map date keys to arrays of assignees
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.due_date) {
        if (!map[t.due_date]) map[t.due_date] = [];
        map[t.due_date].push(t);
      }
    });
    return map;
  }, [tasks]);

  // Dots for a given day
  function getDotsForDay(day: number) {
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = tasksByDate[key];
    if (!dayTasks || dayTasks.length === 0) return [];

    const assignees = new Set(dayTasks.filter((t) => !t.is_complete).map((t) => t.assignee));
    const dots: string[] = [];
    // Order: noam (blue), both (purple), omer (pink)
    if (assignees.has('noam')) dots.push('bg-blue-500');
    if (assignees.has('both')) dots.push('bg-violet-500');
    if (assignees.has('omer')) dots.push('bg-pink-400');
    return dots;
  }

  function getSelectedTasks(): Task[] {
    if (!selectedDate) return [];
    return (tasksByDate[selectedDate] || []).sort((a, b) => {
      if (a.is_complete !== b.is_complete) return a.is_complete ? 1 : -1;
      return a.created_at.localeCompare(b.created_at);
    });
  }

  const selectedTasks = getSelectedTasks();

  const todayKey = toDateKey(today);

  function goToPrevMonth() {
    setDirection(-1);
    setSelectedDate(null);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    setDirection(1);
    setSelectedDate(null);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleDayClick(day: number) {
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate((prev) => (prev === key ? null : key));
  }

  function formatSelectedDate(): string {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  const monthKey = `${currentYear}-${currentMonth}`;

  return (
    <div className="pt-2">
      {/* Calendar card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 350, damping: 30 }}
        className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button
            onClick={goNextMonthRTL()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={monthKey}
              initial={{ opacity: 0, x: direction * -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * 20 }}
              transition={{ duration: 0.2 }}
              className="text-[16px] text-gray-900"
            >
              {HEBREW_MONTHS[currentMonth]} {currentYear}
            </motion.h2>
          </AnimatePresence>
          <button
            onClick={goPrevMonthRTL()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-3 pb-1">
          {HEBREW_DAYS.map((day) => (
            <div key={day} className="text-center text-[11px] text-gray-300 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={monthKey}
            initial={{ opacity: 0, x: direction * -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * 30 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="grid grid-cols-7 px-3 pb-4"
          >
            {days.map((day, i) => {
              if (day === null) {
                return <div key={`blank-${i}`} className="h-12" />;
              }

              const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;
              const dots = getDotsForDay(day);

              return (
                <button
                  key={dateKey}
                  onClick={() => handleDayClick(day)}
                  className="relative h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200"
                >
                  {/* Selected / today background */}
                  {isSelected && (
                    <motion.div
                      layoutId="selected-day"
                      className="absolute inset-1 rounded-xl bg-gray-900"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  {isToday && !isSelected && (
                    <div className="absolute inset-1 rounded-xl bg-gray-100/80" />
                  )}

                  <span
                    className={`
                      relative z-10 text-[14px] transition-colors duration-200
                      ${isSelected ? 'text-white' : isToday ? 'text-gray-900' : 'text-gray-700'}
                    `}
                  >
                    {day}
                  </span>

                  {/* Dots */}
                  {dots.length > 0 && (
                    <div className="relative z-10 flex gap-[3px]">
                      {dots.map((dotColor, idx) => (
                        <div
                          key={idx}
                          className={`
                            w-[5px] h-[5px] rounded-full transition-all duration-200
                            ${isSelected ? 'bg-white/70' : dotColor}
                          `}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 pt-4 pb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full bg-blue-500" />
          <span className="text-[11px] text-gray-400">נועם</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full bg-violet-500" />
          <span className="text-[11px] text-gray-400">ביחד</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full bg-pink-400" />
          <span className="text-[11px] text-gray-400">עומר</span>
        </div>
      </div>

      {/* Selected date tasks */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="pt-5">
              <div className="flex items-center gap-3 mb-3 px-1">
                <div className="h-px bg-gray-200/60 flex-1" />
                <span className="text-[12px] text-gray-400">
                  {formatSelectedDate()}
                </span>
                <div className="h-px bg-gray-200/60 flex-1" />
              </div>

              {selectedTasks.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-8 text-center"
                >
                  <p className="text-[13px] text-gray-300">אין משימות ביום הזה</p>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {selectedTasks.map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: index * 0.05,
                        type: 'spring',
                        stiffness: 400,
                        damping: 28,
                      }}
                    >
                      <TaskCard
                        task={task}
                        onToggle={onToggle}
                        onDelete={onDelete}
                        onUpdateNotes={onUpdateNotes}
                        onUpdateDueDate={onUpdateDueDate}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // In RTL, right arrow = prev month, left arrow = next month
  function goNextMonthRTL() {
    return goToPrevMonth;
  }
  function goPrevMonthRTL() {
    return goToNextMonth;
  }
}