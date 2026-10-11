# Admin & Secretary bot — setup guide

Telegram → Botpress → **BizTask Bot API** (`https://biztask.wssdevlabs.com/api/bot/...`) → Firestore.

The API runs as Cloudflare Pages Functions (`functions/api/bot/`) and deploys with the site on every push to `main`.

---

## 1. Cloudflare: add 3 secrets

Cloudflare → Workers & Pages → **biztask** → Settings → **Variables and Secrets** → Production → Add (type **Secret**):

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The whole service-account JSON (same one as the GitHub secret) |
| `BOT_OWNER_UID` | Your Firebase **User UID**: Firebase Console → Authentication → Users → your email → copy *User UID* |
| `BOT_API_KEY` | A long random string. Generate one in PowerShell:<br>`-join ((48..57)+(65..90)+(97..122) \| Get-Random -Count 48 \| % {[char]$_})` |

Secrets only take effect on the **next deploy**, so afterwards run GitHub → Actions → *Deploy to Cloudflare Pages* → **Run workflow**.

Check: `https://biztask.wssdevlabs.com/api/bot/brief` should return `{"error":"Unauthorized"}` (not `"Bot API is not configured"`).

---

## 2. API reference

Every request needs the header `Authorization: Bearer <BOT_API_KEY>`.
All dates/times are **Malaysia time**. Times can be sent as `2026-10-14T15:00`.

| What | Method & path | Body / query |
|---|---|---|
| Daily brief | `GET /api/bot/brief` | `?date=YYYY-MM-DD` (default today) |
| Schedule | `GET /api/bot/schedule` | `?date=YYYY-MM-DD` or `?from=…&to=…` (max 31 days) |
| Add event | `POST /api/bot/events` | `{ title, start, end?, allDay?, location?, notes?, dryRun? }` |
| Change / move event | `PATCH /api/bot/events/{id}` | any of the above fields + `dryRun?` (moving `start` keeps the duration) |
| Cancel event | `DELETE /api/bot/events/{id}` | — |
| List tasks | `GET /api/bot/tasks` | `?filter=open\|overdue\|today\|week\|done&q=search` |
| Add task | `POST /api/bot/tasks` | `{ title, dueDate?, priority?, status?, description?, project?, dryRun? }` |
| Update task | `PATCH /api/bot/tasks/{id}` | `{ status?, priority?, dueDate?, title?, description?, dryRun? }` |

- **`dryRun: true`** validates and returns exactly what *would* be saved (plus calendar clashes) without saving. Use it to ask the user "Save?".
- Event/task IDs come from the `id` field in schedule/task responses.
- Priorities: `Critical, High, Medium, Low`. Statuses: `Backlog, To Do, In Progress, Review, Done`.
- Errors come back as `{ "error": "message" }` with status 400/401/404 — the message is safe to show the user.
- Every change is written to the BizTask audit log as "(via Telegram)".

---

## 3. Botpress

### Store the key
Bot settings → **Configuration variables**: add `BIZTASK_API_KEY` = your `BOT_API_KEY`, and `BIZTASK_URL` = `https://biztask.wssdevlabs.com/api/bot`.
Never paste the key directly into a node or code card.

### Lock it to you
Your bot is public on Telegram — anyone who finds it can message it. Make the **first step of the main flow** compare the sender's Telegram user ID with yours and end the conversation if it doesn't match.
(Get your ID by messaging `@userinfobot` on Telegram. In Botpress, check the incoming message's user/conversation tags in the emulator or logs to see where the Telegram user ID appears.)

### Tools for the Autonomous Node
Create one tool (Execute Code card / action) per API call. Pattern:

```js
const res = await axios({
  method: 'POST',
  url: `${env.BIZTASK_URL}/events`,
  headers: { Authorization: `Bearer ${env.BIZTASK_API_KEY}` },
  data: { title, start, end, allDay, location, notes, dryRun },
  validateStatus: () => true,   // let the agent read 400 error messages
})
return res.data
```

Suggested tools: `getBrief`, `getSchedule(date | from,to)`, `previewEvent` / `saveEvent` (same endpoint, dryRun true/false), `updateEvent(id, …)`, `cancelEvent(id)`, `listTasks(filter, q)`, `addTask(…)`, `updateTask(id, …)`.

### Agent instructions (paste and adjust)

```
You are the personal admin & secretary of a solo business owner in Malaysia.
Timezone: Asia/Kuala_Lumpur. Today is {{today's date and weekday}}.
Reply briefly, in the same language the user writes (English or Malay).

Calendar:
- To add or change an event, FIRST call the tool with dryRun=true, show the
  result (day, date, time, title, location) and any clashes, and ask "Save?".
  Only call it again with dryRun=false after the user confirms.
- Convert relative dates ("tomorrow", "next Tue") to YYYY-MM-DD using today's date.
  Send times as YYYY-MM-DDTHH:mm. Default meeting length is 1 hour.
- To move or cancel, get the schedule first to find the event id. If several
  events match, ask which one. Always confirm before cancelling.

Schedule questions: call getSchedule / getBrief and summarise by time.
Deadlines (tasks, invoices, bills, renewals, staff leave) are listed separately
from meetings.

Tasks: confirm before creating or changing. "Done" means status Done.

If a tool returns an "error", explain it plainly and ask how to fix it.
Never invent events, tasks or numbers — only report what the tools return.
```

---

## 4. Not in this version (planned)
- 8am daily brief and reminders pushed automatically (needs a scheduled job; Botpress only replies).
- Notes inbox, email/message drafting, finance/sales/operations topics.
