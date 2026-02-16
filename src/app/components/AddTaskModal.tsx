import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ArrowUp } from 'lucide-react';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: { title: string; notes: string; assignee: 'noam' | 'omer' | 'both'; due_date: string | null }) => void;
  defaultAssignee: 'all' | 'noam' | 'omer' | 'both';
}

const assigneeOptions: { value: 'noam' | 'omer' | 'both'; label: string; dot: string; ring: string; bg: string }[] = [
  { value: 'noam', label: 'נועם', dot: 'bg-blue-500', ring: 'ring-blue-500/30', bg: 'bg-blue-50' },
  { value: 'both', label: 'ביחד', dot: 'bg-violet-500', ring: 'ring-violet-500/30', bg: 'bg-violet-50' },
  { value: 'omer', label: 'עומר', dot: 'bg-pink-400', ring: 'ring-pink-400/30', bg: 'bg-pink-50' },
];

function formatHebrewDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'היום';
  if (date.getTime() === tomorrow.getTime()) return 'מחר';

  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export default function AddTaskModal({ isOpen, onClose, onAdd, defaultAssignee }: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [assignee, setAssignee] = useState<'noam' | 'omer' | 'both'>(
    defaultAssignee === 'all' ? 'both' : defaultAssignee
  );
  const [dueDate, setDueDate] = useState('');
  const [showDate, setShowDate] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setNotes('');
      setShowNotes(false);
      setDueDate('');
      setShowDate(false);
      setAssignee(defaultAssignee === 'all' ? 'both' : defaultAssignee);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen, defaultAssignee]);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      notes: notes.trim(),
      assignee,
      due_date: dueDate || null,
    });
    onClose();
  }, [title, notes, assignee, dueDate, onAdd, onClose]);

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (title.trim()) {
        handleSubmit();
      }
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const currentAssignee = assigneeOptions.find((a) => a.value === assignee)!;
  const canSubmit = title.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-[6px]"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 420 }}
            className="relative z-10 w-full max-w-lg bg-white/98 backdrop-blur-2xl rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.08)]"
            dir="rtl"
          >
            {/* Handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-8 h-[3px] rounded-full bg-gray-200/80" />
            </div>

            <div className="px-5 pb-3 pt-3">
              {/* Title input — the hero */}
              <textarea
                ref={inputRef}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  autoResize(e.target);
                }}
                onKeyDown={handleTitleKeyDown}
                placeholder="מה צריך לעשות?"
                rows={1}
                className="w-full text-[20px] text-gray-900 placeholder-gray-300 bg-transparent border-0 outline-none resize-none leading-[1.4] py-1"
                style={{ minHeight: '32px' }}
              />

              {/* Notes — collapsible */}
              <AnimatePresence>
                {showNotes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        autoResize(e.target);
                      }}
                      placeholder="הערות..."
                      rows={1}
                      className="w-full text-[16px] text-gray-500 placeholder-gray-300 bg-transparent border-0 outline-none resize-none leading-[1.5] mt-1"
                    />
                  </motion.div>
                )}
              </AnimatePresence>



              {/* Toolbar row */}
              <div className="flex items-center justify-between mt-4 mb-1">
                <div className="flex items-center gap-1.5">
                  {/* Assignee dots */}
                  {assigneeOptions.map((opt) => {
                    const isActive = assignee === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        type="button"
                        onClick={() => setAssignee(opt.value)}
                        whileTap={{ scale: 0.9 }}
                        className={`
                          h-8 rounded-full flex items-center transition-all duration-250 ease-out
                          ${isActive
                            ? `${opt.bg} px-3 gap-1.5`
                            : 'w-8 justify-center hover:opacity-70'
                          }
                        `}
                      >
                        <motion.div
                          layout
                          className={`
                            rounded-full flex-shrink-0 transition-all duration-250
                            ${isActive ? 'w-[7px] h-[7px]' : 'w-[10px] h-[10px] opacity-35'}
                            ${opt.dot}
                          `}
                        />
                        <AnimatePresence>
                          {isActive && (
                            <motion.span
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              exit={{ opacity: 0, width: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-[12px] text-gray-600 whitespace-nowrap overflow-hidden"
                            >
                              {opt.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}

                  {/* Divider */}
                  <div className="w-px h-4 bg-gray-150 mx-1" />

                  {/* Date button — native input overlay for iOS compatibility */}
                  <div className={`
                    relative h-8 rounded-full flex items-center gap-1.5 transition-all duration-200
                    ${dueDate ? 'bg-gray-100 px-3' : 'w-8 justify-center text-gray-300 hover:text-gray-400'}
                  `}>
                    <input
                      ref={dateRef}
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        if (e.target.value) setShowDate(true);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      style={{ WebkitAppearance: 'none' }}
                    />
                    <Calendar className="w-[15px] h-[15px]" strokeWidth={1.6} />
                    {dueDate && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[12px] text-gray-500"
                      >
                        {formatHebrewDate(dueDate)}
                      </motion.span>
                    )}
                  </div>

                  {/* Notes toggle */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowNotes(!showNotes)}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
                      ${showNotes ? 'text-gray-500 bg-gray-100' : 'text-gray-300 hover:text-gray-400'}
                    `}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <line x1="21" y1="6" x2="3" y2="6" />
                      <line x1="17" y1="12" x2="3" y2="12" />
                      <line x1="13" y1="18" x2="3" y2="18" />
                    </svg>
                  </motion.button>
                </div>

                {/* Submit button */}
                <motion.button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  whileTap={canSubmit ? { scale: 0.88 } : {}}
                  animate={{
                    scale: canSubmit ? 1 : 0.9,
                    opacity: canSubmit ? 1 : 0.4,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={`
                    w-9 h-9 rounded-full flex items-center justify-center
                    transition-colors duration-200
                    ${canSubmit
                      ? `${currentAssignee.dot} text-white shadow-sm`
                      : 'bg-gray-100 text-gray-300'
                    }
                  `}
                >
                  <ArrowUp className="w-[18px] h-[18px] rotate-180" strokeWidth={2.2} style={{ transform: 'scaleX(-1)' }} />
                </motion.button>
              </div>
            </div>

            {/* Safe area spacer */}
            <div className="h-[env(safe-area-inset-bottom,8px)]" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
