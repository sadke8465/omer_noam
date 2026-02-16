import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, List, CalendarDays, Rows3, ChevronDown } from 'lucide-react';
import TaskCard, { type Task } from './components/TaskCard';
import AddTaskModal from './components/AddTaskModal';
import { supabase } from './supabase';

// Lazy load heavy views — only loaded when user switches to them
const CalendarView = lazy(() => import('./components/CalendarView'));
const WeeklyView = lazy(() => import('./components/WeeklyView'));

// Define Filter Types
type FilterType = 'all' | 'noam' | 'omer' | 'both';

const filters: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'both', label: 'ביחד' },
  { value: 'noam', label: 'נועם' },
  { value: 'omer', label: 'עומר' },
];

const filterColors: Record<FilterType, string> = {
  all: 'bg-gray-900',
  both: 'bg-violet-500',
  noam: 'bg-blue-500',
  omer: 'bg-pink-400',
};

type ViewMode = 'list' | 'weekly' | 'calendar';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSomedayOpen, setIsSomedayOpen] = useState(true);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  // OneSignal is initialized in index.html — just need the permission request handler
  const handleRequestNotifications = useCallback(() => {
    const OS = (window as any).OneSignal;
    if (OS && OS.Notifications && !OS.Notifications.permission) {
      OS.Notifications.requestPermission();
    }
  }, []);

  // --- 1. Fetch Tasks from Supabase ---
  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
    } else {
      setTasks(data || []);
    }
  }, []);

  // --- 2. Smart Real-time — apply changes from payload instead of re-fetching ---
  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('realtime-tasks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload) => {
          setTasks(prev => {
            // Avoid duplicates from optimistic inserts
            if (prev.some(t => t.id === (payload.new as Task).id)) return prev;
            return [payload.new as Task, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          setTasks(prev => prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        (payload) => {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as { id: number }).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  // --- 3. Database Actions (useCallback for stable references) ---

  const handleAdd = useCallback(async (newTask: { title: string; notes: string; assignee: 'noam' | 'omer' | 'both'; due_date: string | null }) => {
    const { error } = await supabase.from('tasks').insert([
      {
        title: newTask.title,
        notes: newTask.notes,
        assignee: newTask.assignee,
        due_date: newTask.due_date,
        is_complete: false
      }
    ]);
    if (error) console.error('Error adding task:', error);
  }, []);

  const handleToggle = useCallback(async (id: string | number) => {
    let originalComplete: boolean | null = null;
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;
      originalComplete = task.is_complete;
      return prev.map(t => t.id === id ? { ...t, is_complete: !t.is_complete } : t);
    });

    if (originalComplete === null) return;

    const { error } = await supabase
      .from('tasks')
      .update({ is_complete: !originalComplete })
      .eq('id', id);

    if (error) {
      console.error('Error toggling task:', error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const handleDelete = useCallback(async (id: string | number) => {
    setTasks(prev => prev.filter(t => t.id !== id));

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const handleUpdateNotes = useCallback(async (id: string | number, notes: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, notes } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ notes })
      .eq('id', id);

    if (error) console.error('Error updating notes:', error);
  }, []);

  const handleUpdateDueDate = useCallback(async (id: string | number, due_date: string | null) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ due_date })
      .eq('id', id);

    if (error) {
      console.error('Error updating due date:', error);
      fetchTasks();
    }
  }, [fetchTasks]);

  // --- Sorting & Filtering (fully memoized) ---
  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (activeFilter === 'all') return true;
      return t.assignee === activeFilter;
    });
    return filtered.sort((a, b) => {
      if (a.is_complete !== b.is_complete) return a.is_complete ? 1 : -1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tasks, activeFilter]);

  const { activeTasks, datedTasks, undatedTasks, completedTasks } = useMemo(() => {
    const active = filteredTasks.filter((t) => !t.is_complete);
    return {
      activeTasks: active,
      datedTasks: active.filter((t) => t.due_date),
      undatedTasks: active.filter((t) => !t.due_date),
      completedTasks: filteredTasks.filter((t) => t.is_complete),
    };
  }, [filteredTasks]);

  // --- Render ---
  return (
    <div className="h-screen flex flex-col bg-[#F8F8FA] font-['Inter',system-ui,sans-serif] overflow-hidden" dir="rtl">
      {/* Static header area — never scrolls */}
      <div className="flex-shrink-0 max-w-lg w-full mx-auto px-5">
        <div className="h-[env(safe-area-inset-top,12px)]" />

        <header className="pt-8 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-[28px] tracking-[-0.02em] text-gray-900 cursor-pointer"
                onClick={handleRequestNotifications}
              >
                עומר ונועם 💛
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-[13px] text-gray-400 mt-0.5"
              >
                {activeTasks.length === 0
                  ? 'הכל בוצע ✓'
                  : `${activeTasks.length} ${activeTasks.length === 1 ? 'משימה' : 'משימות'}`}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center bg-gray-100/80 rounded-xl p-0.5"
            >
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-[10px] transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('weekly')} className={`p-2 rounded-[10px] transition-all ${viewMode === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                <Rows3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-[10px] transition-all ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                <CalendarDays className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </header>

        <AnimatePresence>
          {viewMode === 'list' && (
            <motion.div
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              className="flex items-center justify-between py-4 mb-2"
            >
              <div className="flex gap-1.5">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setActiveFilter(f.value)}
                    className={`relative px-4 py-1.5 rounded-full text-[13px] transition-all ${activeFilter === f.value ? `${filterColors[f.value]} text-white` : 'text-gray-400'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <motion.button
                onClick={() => setIsModalOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                className="w-[30px] h-[30px] rounded-full bg-gray-900 text-white flex items-center justify-center"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scrollable content area — only this scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollable-content pb-8">
        <div className="max-w-lg mx-auto px-5 pb-[env(safe-area-inset-bottom,16px)]">
          <AnimatePresence mode="wait">
            {viewMode === 'list' ? (
              <motion.div
                key={`list-${activeFilter}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                {/* Main tasks (with due dates) */}
                {datedTasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: [0.25, 0.1, 0.25, 1] }}
                    className="mb-2 gpu-accelerated"
                  >
                    <TaskCard task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
                  </motion.div>
                ))}

                {filteredTasks.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="flex flex-col items-center justify-center py-24 text-center gpu-accelerated"
                  >
                    <div className="text-[40px] mb-3">✨</div>
                    <p className="text-[14px] text-gray-300">אין משימות</p>
                  </motion.div>
                )}

                {/* Someday section (no due date) */}
                {undatedTasks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(datedTasks.length * 0.03 + 0.05, 0.35) }}
                    className="pt-6"
                  >
                    <button
                      onClick={() => setIsSomedayOpen(!isSomedayOpen)}
                      className="flex items-center gap-3 mb-3 px-1 w-full group"
                    >
                      <div className="h-px bg-gray-200/60 flex-1" />
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-300 tracking-wide">ביום מן הימים · {undatedTasks.length}</span>
                        <motion.div
                          animate={{ rotate: isSomedayOpen ? 0 : -90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-3 h-3 text-gray-300" />
                        </motion.div>
                      </div>
                      <div className="h-px bg-gray-200/60 flex-1" />
                    </button>
                    <AnimatePresence>
                      {isSomedayOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2">
                            {undatedTasks.map((task, i) => (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.03 }}
                              >
                                <TaskCard task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Completed section (collapsible) */}
                {completedTasks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: Math.min((datedTasks.length + undatedTasks.length) * 0.03 + 0.1, 0.4) }}
                    className="pt-6"
                  >
                    <button
                      onClick={() => setIsCompletedOpen(!isCompletedOpen)}
                      className="flex items-center gap-3 mb-3 px-1 w-full group"
                    >
                      <div className="h-px bg-gray-200/60 flex-1" />
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-300 tracking-wide">הושלמו · {completedTasks.length}</span>
                        <motion.div
                          animate={{ rotate: isCompletedOpen ? 0 : -90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-3 h-3 text-gray-300" />
                        </motion.div>
                      </div>
                      <div className="h-px bg-gray-200/60 flex-1" />
                    </button>
                    <AnimatePresence>
                      {isCompletedOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2">
                            {completedTasks.map((task, i) => (
                              <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.03 }}
                              >
                                <TaskCard task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>
            ) : viewMode === 'weekly' ? (
              <motion.div key="weekly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Suspense fallback={null}>
                  <WeeklyView tasks={tasks} onToggle={handleToggle} />
                </Suspense>
              </motion.div>
            ) : (
              <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Suspense fallback={null}>
                  <CalendarView tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AddTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={handleAdd} defaultAssignee={activeFilter} />
    </div>
  );
}
