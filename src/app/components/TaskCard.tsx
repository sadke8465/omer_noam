import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Calendar, Trash2, AlignRight, ExternalLink } from 'lucide-react';

export interface Task {
  id: number;
  title: string;
  notes: string;
  assignee: 'noam' | 'omer' | 'both';
  due_date: string | null;
  is_complete: boolean;
  created_at: string;
}

const assigneeConfig = {
  noam: { color: 'bg-blue-500', label: 'נועם', ring: 'ring-blue-500/20' },
  omer: { color: 'bg-pink-400', label: 'עומר', ring: 'ring-pink-400/20' },
  both: { color: 'bg-violet-500', label: 'ביחד', ring: 'ring-violet-500/20' },
};

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const taskDate = new Date(dateStr);
  taskDate.setHours(0, 0, 0, 0);

  if (taskDate.getTime() === today.getTime()) return 'היום';
  if (taskDate.getTime() === tomorrow.getTime()) return 'מחר';

  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function getDateInfo(dateStr: string | null, isComplete: boolean): {
  label: string | null;
  countdown: string | null;
  isOverdue: boolean;
} {
  if (!dateStr) return { label: null, countdown: null, isOverdue: false };

  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dateStr);
  taskDate.setHours(0, 0, 0, 0);

  const diffMs = taskDate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = formatDate(dateStr)!;

  if (isComplete) {
    return { label: formattedDate, countdown: null, isOverdue: false };
  }

  if (diffDays === 0) {
    return { label: 'היום', countdown: null, isOverdue: false };
  }
  if (diffDays === 1) {
    return { label: 'מחר', countdown: null, isOverdue: false };
  }
  if (diffDays > 1) {
    const dayWord = diffDays === 2 ? 'יומיים' : `${diffDays} ימים`;
    return { label: formattedDate, countdown: `עוד ${dayWord}`, isOverdue: false };
  }
  // overdue
  const absDays = Math.abs(diffDays);
  const dayWord = absDays === 1 ? 'יום' : absDays === 2 ? 'יומיים' : `${absDays} ימים`;
  return { label: formattedDate, countdown: `באיחור של ${dayWord}`, isOverdue: true };
}

interface TaskCardProps {
  task: Task;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateNotes: (id: number, notes: string) => void;
  onUpdateDueDate?: (id: number, dueDate: string | null) => void;
}

export default function TaskCard({ task, onToggle, onDelete, onUpdateNotes, onUpdateDueDate }: TaskCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(task.notes);
  const [localDueDate, setLocalDueDate] = useState(task.due_date || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const config = assigneeConfig[task.assignee];
  const dateInfo = getDateInfo(task.due_date, task.is_complete);

  useEffect(() => {
    setLocalNotes(task.notes);
  }, [task.notes]);

  useEffect(() => {
    setLocalDueDate(task.due_date || '');
  }, [task.due_date]);

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [isExpanded, localNotes]);

  const handleBlur = () => {
    if (localNotes !== task.notes) {
      onUpdateNotes(task.id, localNotes);
    }
  };

  const hasNotes = task.notes.trim().length > 0;

  return (
    <motion.div
      layout
      className="relative overflow-hidden"
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <motion.div
        layout
        animate={{ scale: isPressed ? 0.98 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`
          relative px-4 py-3.5
          bg-white/80 backdrop-blur-xl
          rounded-2xl
          transition-shadow duration-300
          ${task.is_complete ? 'opacity-40' : 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}
        `}
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          {/* Checkbox */}
          <button
            onClick={() => onToggle(task.id)}
            className={`
              relative flex-shrink-0 w-[22px] h-[22px] rounded-full
              border-[1.5px] transition-all duration-300 ease-out
              flex items-center justify-center
              ${task.is_complete
                ? `${config.color} border-transparent`
                : `border-gray-300 hover:border-gray-400`
              }
            `}
          >
            {task.is_complete && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </button>

          {/* Content */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <p className={`
              text-[15px] leading-tight transition-all duration-300
              ${task.is_complete
                ? 'line-through text-gray-400'
                : 'text-gray-900'
              }
            `}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {/* Assignee dot */}
              <div className="flex items-center gap-1">
                <div className={`w-[6px] h-[6px] rounded-full ${config.color}`} />
                <span className="text-[11px] text-gray-400">{config.label}</span>
              </div>
              {dateInfo.label && (
                <>
                  <span className="text-gray-200">&middot;</span>
                  <div className="flex items-center gap-0.5">
                    <Calendar className="w-3 h-3 text-gray-300" />
                    <span className={`text-[11px] ${dateInfo.isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                      {dateInfo.label}
                    </span>
                  </div>
                  {dateInfo.countdown && (
                    <span className={`text-[10px] ${dateInfo.isOverdue ? 'text-red-400/80' : 'text-gray-300'}`}>
                      {dateInfo.countdown}
                    </span>
                  )}
                </>
              )}
              {hasNotes && !isExpanded && (
                <>
                  <span className="text-gray-200">&middot;</span>
                  <AlignRight className="w-3 h-3 text-gray-300" />
                </>
              )}
            </div>
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (showDelete) {
                onDelete(task.id);
              } else {
                setShowDelete(true);
                setTimeout(() => setShowDelete(false), 3000);
              }
            }}
            className={`
              flex-shrink-0 p-1.5 rounded-full transition-all duration-200
              ${showDelete
                ? 'bg-red-50 text-red-400'
                : 'text-gray-200 hover:text-gray-400'
              }
            `}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Expandable details area */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="overflow-hidden"
            >
              <div className="pt-3 pr-[34px] space-y-2">
                {/* Due date picker */}
                <div className="relative inline-flex items-center gap-1.5 h-8 rounded-xl bg-gray-50/60 px-3 transition-all hover:bg-gray-100/80">
                  <input
                    type="date"
                    value={localDueDate}
                    onChange={(e) => setLocalDueDate(e.target.value)}
                    onBlur={() => {
                      const newVal = localDueDate || null;
                      if (newVal !== (task.due_date || null)) {
                        onUpdateDueDate?.(task.id, newVal);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    style={{ WebkitAppearance: 'none' }}
                  />
                  <Calendar className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.6} />
                  <span className="text-[12px] text-gray-500">
                    {localDueDate ? formatDate(localDueDate) : 'הוסף תאריך'}
                  </span>
                  {localDueDate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocalDueDate('');
                        onUpdateDueDate?.(task.id, null);
                      }}
                      className="relative z-20 text-gray-300 hover:text-gray-500 transition-colors mr-0.5"
                    >
                      <span className="text-[11px]">✕</span>
                    </button>
                  )}
                </div>

                {/* Notes */}
                <textarea
                  ref={textareaRef}
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="הוסף הערה..."
                  rows={1}
                  className="
                    w-full text-[13px] text-gray-500 placeholder-gray-300
                    bg-gray-50/60 rounded-xl px-3 py-2.5
                    border-0 outline-none resize-none
                    focus:bg-gray-50 focus:ring-1 focus:ring-gray-900/5
                    transition-all
                  "
                  style={{ minHeight: '36px' }}
                />

                {/* Google Calendar button — only for tasks with dates */}
                {task.due_date && (
                  <motion.a
                    href={(() => {
                      const d = task.due_date!.replace(/-/g, '');
                      const nextDay = new Date(task.due_date!);
                      nextDay.setDate(nextDay.getDate() + 1);
                      const dEnd = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
                      const params = new URLSearchParams({
                        action: 'TEMPLATE',
                        text: task.title,
                        dates: `${d}/${dEnd}`,
                        ...(task.notes ? { details: task.notes } : {}),
                      });
                      return `https://calendar.google.com/calendar/render?${params.toString()}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    whileTap={{ scale: 0.95 }}
                    className="
                      inline-flex items-center gap-1.5 h-8 rounded-xl
                      bg-gray-50/60 px-3
                      text-[12px] text-gray-400
                      transition-all hover:bg-gray-100/80 hover:text-gray-600
                    "
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.6} />
                    <span>הוסף ליומן</span>
                  </motion.a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}