// Supabase Edge Function — Task Notifications via OneSignal
// Triggered by Database Webhook on INSERT/UPDATE/DELETE on `tasks` table

const ONESIGNAL_APP_ID = "856c86f5-588e-4dd1-a5d8-049f8af01a08";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

// Supabase connection for tracking scheduled notifications
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

// ── Helpers ──

const ASSIGNEE_LABELS: Record<string, string> = {
    noam: "נועם",
    omer: "עומר",
    both: "שניכם",
};

function formatHebrewDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

/** Create a Date object in Israel timezone for a given date string and time */
function israelTime(dateStr: string, hours: number, minutes: number): Date {
    // Create date in Israel time (UTC+2 or UTC+3 depending on DST)
    const dateInIsrael = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+02:00`);
    return dateInIsrael;
}

/** Schedule a single OneSignal notification */
async function scheduleNotification(
    title: string,
    body: string,
    sendAfter: Date,
    taskId: number,
    tag: string
): Promise<string | null> {
    // Don't schedule notifications in the past
    if (sendAfter <= new Date()) return null;

    const payload = {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: title },
        contents: { en: body },
        send_after: sendAfter.toISOString(),
        data: { task_id: taskId, tag },
    };

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
        if (data.id) {
            // Store the notification ID for potential cancellation
            await storeNotificationId(taskId, data.id, tag);
            return data.id;
        }
        console.error("OneSignal error:", data);
        return null;
    } catch (err) {
        console.error("Failed to schedule notification:", err);
        return null;
    }
}

/** Send an instant notification */
async function sendInstantNotification(title: string, body: string): Promise<void> {
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: title },
        contents: { en: body },
    };

    try {
        await fetch(ONESIGNAL_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        console.error("Failed to send notification:", err);
    }
}

/** Cancel a scheduled OneSignal notification by its ID */
async function cancelNotification(notificationId: string): Promise<void> {
    try {
        await fetch(`${ONESIGNAL_API_URL}/${notificationId}?app_id=${ONESIGNAL_APP_ID}`, {
            method: "DELETE",
            headers: {
                Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
            },
        });
    } catch (err) {
        console.error("Failed to cancel notification:", err);
    }
}

// ── Supabase helpers for tracking notification IDs ──

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

async function storeNotificationId(taskId: number, notificationId: string, tag: string) {
    await supabaseFetch("/task_notifications", {
        method: "POST",
        body: JSON.stringify({ task_id: taskId, notification_id: notificationId, tag }),
    });
}

async function cancelAllForTask(taskId: number) {
    // Get all scheduled notification IDs for this task
    const res = await supabaseFetch(`/task_notifications?task_id=eq.${taskId}&select=notification_id`);
    const rows = await res.json();

    if (Array.isArray(rows)) {
        // Cancel each notification in OneSignal
        await Promise.all(rows.map((r: { notification_id: string }) => cancelNotification(r.notification_id)));
    }

    // Delete tracking records
    await supabaseFetch(`/task_notifications?task_id=eq.${taskId}`, { method: "DELETE" });
}

// ── Schedule the 3 reminder notifications for a task ──

async function scheduleReminders(task: Task) {
    if (!task.due_date) return;

    const assigneeLabel = ASSIGNEE_LABELS[task.assignee] || task.assignee;
    const dateLabel = formatHebrewDate(task.due_date);

    // Calculate the day before
    const dayBefore = new Date(task.due_date + "T00:00:00");
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

    // 1. Evening before (21:00)
    await scheduleNotification(
        `📋 תזכורת למחר`,
        `${assigneeLabel}: "${task.title}" — מחר, ${dateLabel}`,
        israelTime(dayBeforeStr, 21, 0),
        task.id,
        "evening-before"
    );

    // 2. Morning of (10:00)
    await scheduleNotification(
        `☀️ משימה להיום`,
        `${assigneeLabel}: "${task.title}" — היום`,
        israelTime(task.due_date, 10, 0),
        task.id,
        "morning-of"
    );

    // 3. Evening of (18:30)
    await scheduleNotification(
        `🔔 תזכורת אחרונה`,
        `${assigneeLabel}: "${task.title}" — היום, שעה 18:30`,
        israelTime(task.due_date, 18, 30),
        task.id,
        "evening-of"
    );
}

// ── Main handler ──

Deno.serve(async (req) => {
    // Verify method
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const payload: WebhookPayload = await req.json();
        const { type, record, old_record } = payload;

        switch (type) {
            case "INSERT": {
                // New task with a due date → schedule reminders
                if (record?.due_date && !record.is_complete) {
                    await scheduleReminders(record);
                }
                break;
            }

            case "UPDATE": {
                if (!record) break;

                // Task completed → send instant notification
                if (record.is_complete && !old_record?.is_complete) {
                    const who = ASSIGNEE_LABELS[record.assignee] || record.assignee;
                    await sendInstantNotification(
                        `✅ הושלם!`,
                        `${who} סיימ/ה: "${record.title}"`
                    );
                    // Cancel any pending reminders
                    await cancelAllForTask(record.id);
                    break;
                }

                // Task uncompleted → reschedule if has date
                if (!record.is_complete && old_record?.is_complete && record.due_date) {
                    await scheduleReminders(record);
                    break;
                }

                // Due date changed → cancel old, schedule new
                if (record.due_date !== old_record?.due_date) {
                    await cancelAllForTask(record.id);
                    if (record.due_date && !record.is_complete) {
                        await scheduleReminders(record);
                    }
                }
                break;
            }

            case "DELETE": {
                // Task deleted → cancel all scheduled notifications
                if (old_record) {
                    await cancelAllForTask(old_record.id);
                }
                break;
            }
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
