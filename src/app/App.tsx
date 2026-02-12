import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, List, CalendarDays, Rows3 } from 'lucide-react';
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
  const completedTasks = filteredTasks.filter((t) => t.is_complete);

  // --- Render (Same as before) ---
  return (
    <div className="min-h-screen bg-[#F8F8FA] font-['Inter',system-ui,sans-serif]" dir="rtl">
      <div className="max-w-lg mx-auto px-5 pb-24">
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
              className="flex gap-1.5 py-4 mb-2"
            >
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className={`relative px-4 py-1.5 rounded-full text-[13px] transition-all ${activeFilter === f.value ? `${filterColors[f.value]} text-white` : 'text-gray-400'}`}
                >
                  {f.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {activeTasks.map((task, index) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35, delay: index * 0.04 }}
                    >
                      <TaskCard task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredTasks.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="text-[40px] mb-3">✨</div>
                    <p className="text-[14px] text-gray-300">אין משימות</p>
                  </motion.div>
                )}

                <AnimatePresence>
                  {completedTasks.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-6">
                      <div className="flex items-center gap-3 mb-3 px-1">
                        <div className="h-px bg-gray-200/60 flex-1" />
                        <span className="text-[11px] text-gray-300 tracking-wide">הושלמו · {completedTasks.length}</span>
                        <div className="h-px bg-gray-200/60 flex-1" />
                      </div>
                      <div className="space-y-2">
                        {completedTasks.map((task) => (
                          <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} />
                        ))}
                      </div>
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
              <CalendarView tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} onUpdateNotes={handleUpdateNotes} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <motion.button
          onClick={() => setIsModalOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          className="w-14 h-14 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
        >
          <Plus className="w-6 h-6" strokeWidth={1.8} />
        </motion.button>
      </div>

      <AddTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={handleAdd} defaultAssignee={activeFilter} />
    </div>
  );
}
