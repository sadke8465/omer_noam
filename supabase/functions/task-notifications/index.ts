// Supabase Edge Function — Task Notifications via OneSignal
// Triggered by Database Webhook on INSERT/UPDATE/DELETE on `tasks` table

const ONESIGNAL_APP_ID = "856c86f5-588e-4dd1-a5d8-049f8af01a08";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

const SUPABASE_URL = "https://xpggmrkipeernskkmorj.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface Task {
    id: number;
    title: string;
    notes: string;
    assignee: "noam" | "omer" | "both";
    due_date: string | null;
    is_complete: boolean;
    created_at: string;
}

interface WebhookPayload {
    type: "INSERT" | "UPDATE" | "DELETE";
    table: string;
    record: Task | null;
    old_record: Task | null;
}

// ── Supabase helpers ──

async function supabaseFetch(path: string, options: RequestInit = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer: "return=representation",
            ...(options.headers || {}),
        },
    });
}

/** Get all active (non-complete) tasks for a specific due date */
async function getTasksForDate(dueDate: string): Promise<Task[]> {
    const res = await supabaseFetch(
        `/tasks?due_date=eq.${dueDate}&is_complete=eq.false&select=*`
    );
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

// ── Notification ID tracking ──

async function storeNotificationId(dueDate: string, notificationId: string, tag: string) {
    await supabaseFetch("/task_notifications", {
        method: "POST",
        body: JSON.stringify({
            task_id: 0, // legacy column — we track by tag now
            notification_id: notificationId,
            tag: `${dueDate}:${tag}`,
        }),
    });
}

async function cancelAllForDate(dueDate: string) {
    // Get all scheduled notification IDs for this date
    const res = await supabaseFetch(
        `/task_notifications?tag=like.${dueDate}%25&select=notification_id,tag`
    );
    const rows = await res.json();

    if (Array.isArray(rows) && rows.length > 0) {
        // Cancel each notification in OneSignal
        await Promise.all(
            rows.map((r: { notification_id: string }) =>
                cancelOneSignalNotification(r.notification_id)
            )
        );
        // Delete tracking records
        await supabaseFetch(`/task_notifications?tag=like.${dueDate}%25`, {
            method: "DELETE",
        });
    }
}

async function cancelOneSignalNotification(notificationId: string) {
    try {
        await fetch(
            `${ONESIGNAL_API_URL}/${notificationId}?app_id=${ONESIGNAL_APP_ID}`,
            {
                method: "DELETE",
                headers: { Authorization: `Key ${ONESIGNAL_REST_API_KEY}` },
            }
        );
    } catch (err) {
        console.error("Failed to cancel notification:", err);
    }
}

// ── OneSignal API ──

async function sendNotification(
    title: string,
    body: string,
    sendAfter?: Date
): Promise<string | null> {
    // Don't schedule notifications in the past
    if (sendAfter && sendAfter <= new Date()) return null;

    const payload: Record<string, unknown> = {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: title },
        contents: { en: body },
    };

    if (sendAfter) {
        payload.send_after = sendAfter.toISOString();
    }

    try {
        const res = await fetch(ONESIGNAL_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.id) return data.id;
        console.error("OneSignal error:", data);
        return null;
    } catch (err) {
        console.error("Failed to send notification:", err);
        return null;
    }
}

// ── Build summary text ──

function buildSummary(tasks: Task[]): string {
    // Group tasks by assignee
    const omerTasks = tasks.filter((t) => t.assignee === "omer");
    const noamTasks = tasks.filter((t) => t.assignee === "noam");
    const bothTasks = tasks.filter((t) => t.assignee === "both");

    const parts: string[] = [];

    if (omerTasks.length > 0) {
        const titles = joinTitles(omerTasks.map((t) => t.title));
        parts.push(`עומר צריכה ${titles}`);
    }

    if (noamTasks.length > 0) {
        const titles = joinTitles(noamTasks.map((t) => t.title));
        parts.push(`נועם צריך ${titles}`);
    }

    if (bothTasks.length > 0) {
        const titles = joinTitles(bothTasks.map((t) => t.title));
        parts.push(`שניכם צריכים ${titles}`);
    }

    return parts.join(" ו");
}

function joinTitles(titles: string[]): string {
    if (titles.length === 1) return titles[0];
    const last = titles.pop()!;
    return `${titles.join(", ")} ו${last}`;
}

// ── Israel timezone helper ──

function israelTime(dateStr: string, hours: number, minutes: number): Date {
    return new Date(
        `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+02:00`
    );
}

// ── Schedule aggregated reminders for a specific date ──

async function rescheduleRemindersForDate(dueDate: string) {
    // 1. Cancel all existing notifications for this date
    await cancelAllForDate(dueDate);

    // 2. Get ALL active tasks for this date
    const tasks = await getTasksForDate(dueDate);

    // If no tasks, nothing to schedule
    if (tasks.length === 0) return;

    // 3. Build summary text
    const summary = buildSummary(tasks);

    // 4. Calculate the day before
    const dayBefore = new Date(dueDate + "T00:00:00");
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

    // 5. Schedule 3 notifications

    // Evening before (21:00)
    const eveningBeforeId = await sendNotification(
        "הכנות למחר",
        `מחר, ${summary}`,
        israelTime(dayBeforeStr, 21, 0)
    );
    if (eveningBeforeId) {
        await storeNotificationId(dueDate, eveningBeforeId, "evening-before");
    }

    // Morning of (10:00)
    const morningId = await sendNotification(
        "צהריים טובים מיילאבה ☀️",
        `היום, ${summary}`,
        israelTime(dueDate, 10, 0)
    );
    if (morningId) {
        await storeNotificationId(dueDate, morningId, "morning-of");
    }

    // Evening of (18:30)
    const eveningId = await sendNotification(
        "תזכורת אחרונה להיום!! 🔔",
        `היום, ${summary}`,
        israelTime(dueDate, 18, 30)
    );
    if (eveningId) {
        await storeNotificationId(dueDate, eveningId, "evening-of");
    }
}

// ── Completion notification ──

async function sendCompletionNotification(task: Task) {
    let text: string;

    switch (task.assignee) {
        case "omer":
            text = `עומר סיימה ${task.title}!`;
            break;
        case "noam":
            text = `נועם סיים ${task.title}!`;
            break;
        case "both":
        default:
            text = `סיימתם ${task.title}!`;
            break;
    }

    await sendNotification("כל הכבוד 🥳", text);
}

// ── Main handler ──

Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const payload: WebhookPayload = await req.json();
        const { type, record, old_record } = payload;

        // Collect all affected dates that need rescheduling
        const datesToReschedule = new Set<string>();

        switch (type) {
            case "INSERT": {
                if (record?.due_date && !record.is_complete) {
                    datesToReschedule.add(record.due_date);
                }
                break;
            }

            case "UPDATE": {
                if (!record) break;

                // Task completed → send instant notification + reschedule that date
                if (record.is_complete && !old_record?.is_complete) {
                    await sendCompletionNotification(record);
                    if (record.due_date) {
                        datesToReschedule.add(record.due_date);
                    }
                    break;
                }

                // Task uncompleted → reschedule its date
                if (!record.is_complete && old_record?.is_complete && record.due_date) {
                    datesToReschedule.add(record.due_date);
                    break;
                }

                // Due date changed → reschedule both old and new dates
                if (record.due_date !== old_record?.due_date) {
                    if (old_record?.due_date) datesToReschedule.add(old_record.due_date);
                    if (record.due_date && !record.is_complete) datesToReschedule.add(record.due_date);
                }

                // Title or assignee changed → reschedule the date (summary text changes)
                if (
                    record.due_date &&
                    !record.is_complete &&
                    (record.title !== old_record?.title || record.assignee !== old_record?.assignee)
                ) {
                    datesToReschedule.add(record.due_date);
                }
                break;
            }

            case "DELETE": {
                if (old_record?.due_date) {
                    datesToReschedule.add(old_record.due_date);
                }
                break;
            }
        }

        // Reschedule all affected dates
        for (const date of datesToReschedule) {
            await rescheduleRemindersForDate(date);
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("Edge function error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
