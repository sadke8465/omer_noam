import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, List, CalendarDays, Rows3, ChevronDown } from 'lucide-react';
import TaskCard, { type Task } from './components/TaskCard';
import AddTaskModal from './components/AddTaskModal';
import CalendarView from './components/CalendarView';
import WeeklyView from './components/WeeklyView';
import { supabase } from './supabase'; // Import the connection we made

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
  const [tasks, setTasks] = useState<Task[]>([]); // Start empty, wait for DB
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSomedayOpen, setIsSomedayOpen] = useState(true);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  // --- 1. Fetch Tasks from Supabase ---
  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
    } else {
      setTasks(data || []);
    }
  };

  // --- 2. Real-time Setup ---
  useEffect(() => {
    // Initial fetch
    fetchTasks();

    // Listen for ANY change in the DB (Insert, Update, Delete)
    const channel = supabase
      .channel('realtime-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          fetchTasks(); // Re-fetch data immediately when something happens
        }
      )
      .subscribe();

    // Cleanup when leaving
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- 3. Database Actions ---

  const handleAdd = async (newTask: { title: string; notes: string; assignee: 'noam' | 'omer' | 'both'; due_date: string | null }) => {
    // We send data to Supabase. The 'useEffect' above will see the new row and update the screen automatically.
    const { error } = await supabase.from('tasks').insert([
      {
        title: newTask.title,
        notes: newTask.notes,
        assignee: newTask.assignee,
        due_date: newTask.due_date,
        is_complete: false // Default
      }
    ]);

    if (error) console.error('Error adding task:', error);
  };

  const handleToggle = async (id: string | number) => {
    // 1. Find the current status
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // 2. Optimistic Update (makes it feel instant)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_complete: !t.is_complete } : t));

    // 3. Send to DB
    const { error } = await supabase
      .from('tasks')
      .update({ is_complete: !task.is_complete })
      .eq('id', id);

    if (error) {
      console.error('Error toggling task:', error);
      fetchTasks(); // Revert if failed
    }
  };

  const handleDelete = async (id: string | number) => {
    // Optimistic
    setTasks(prev => prev.filter(t => t.id !== id));

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      fetchTasks();
    }
  };

  const handleUpdateNotes = async (id: string | number, notes: string) => {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === id ? { ...t, notes } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ notes })
      .eq('id', id);

    if (error) console.error('Error updating notes:', error);
  };

  const handleUpdateDueDate = async (id: string | number, due_date: string | null) => {
    // Optimistic
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ due_date })
      .eq('id', id);

    if (error) {
      console.error('Error updating due date:', error);
      fetchTasks();
    }
  };

  // --- Sorting & Filtering (Same as before) ---
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

  const activeTasks = filteredTasks.filter((t) => !t.is_complete);
  const datedTasks = activeTasks.filter((t) => t.due_date);
  const undatedTasks = activeTasks.filter((t) => !t.due_date);
  const completedTasks = filteredTasks.filter((t) => t.is_complete);

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
                className="text-[28px] tracking-[-0.02em] text-gray-900"
              >
                שלנו
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
      <div className="flex-1 min-h-0 overflow-y-auto scrollable-content">
        <div className="max-w-lg mx-auto px-5 pb-[env(safe-area-inset-bottom,16px)]">
          <AnimatePresence mode="wait">
            {viewMode === 'list' ? (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-2">
                  {/* Main tasks (with due dates) */}
                  <AnimatePresence mode="popLayout">
                    {datedTasks.map((task, index) => (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.35, delay: index * 0.04 }}
                      >
                        <TaskCard task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {filteredTasks.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="text-[40px] mb-3">✨</div>
                      <p className="text-[14px] text-gray-300">אין משימות</p>
                    </motion.div>
                  )}

                  {/* Someday section (no due date) */}
                  <AnimatePresence>
                    {undatedTasks.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-6">
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
                              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-2">
                                {undatedTasks.map((task) => (
                                  <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Completed section (collapsible) */}
                  <AnimatePresence>
                    {completedTasks.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-6">
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
                              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-2">
                                {completedTasks.map((task) => (
                                  <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : viewMode === 'weekly' ? (
              <motion.div key="weekly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <WeeklyView tasks={tasks} onToggle={handleToggle} />
              </motion.div>
            ) : (
              <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CalendarView tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} onUpdateDueDate={handleUpdateDueDate} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AddTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={handleAdd} defaultAssignee={activeFilter} />
    </div>
  );
}
