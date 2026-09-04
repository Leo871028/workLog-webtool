# Work Task Tracker

A lightweight personal work and task management web app built with **GitHub Pages + Supabase**.

It combines a Kanban-style task board, dashboard, daily work logs, calendar, activity history, backup/restore, and productivity shortcuts in a simple browser-based application that works across devices.

## Live Site

https://leo871028.github.io/workLog-webtool/

## Features

### Dashboard

- Separate Dashboard landing page
- Open Tasks, Ongoing, Overdue, and Due Soon counters
- Upcoming Deadlines list
- Pinned task indicator in Upcoming Deadlines
- Click an Upcoming Deadline task to open it directly in the Edit Task dialog

### Task Management

- Todo / Ongoing / Done Kanban board
- Add, edit, move, and delete tasks
- Priority levels: Low / Medium / High
- Optional task deadline
- Deadline countdown
- Overdue and Due Soon indicators
- Deadline-based sorting
- Collapsible task descriptions
- Pin / Unpin tasks
- Pinned tasks appear first within each Kanban column
- Archive completed tasks and restore them later
- Responsive Task Card layout

### Search & Filter

Filter active tasks by:

- Title or description search
- Status
- Priority
- Deadline state
  - Overdue
  - Due Today
  - Due Soon
  - No Deadline

### Daily Work Log

Each day can contain:

- Completed Today
- Ongoing / In Progress
- Blockers / Issues
- Next Plan

Additional features:

- Prev Day / Today / Next Day navigation
- Unsaved draft preservation while switching dates
- Save-state feedback
- Local-date handling to avoid UTC date shifts

### Daily Work Log Export

Export saved work logs over a selected date range as:

- Excel (`.xlsx`)
- CSV (`.csv`)
- Markdown (`.md`)
- Text (`.txt`)

### Calendar View

- Monthly task calendar based on deadlines
- Previous / Next / Today navigation
- Filter by task status
- Overdue task indication
- Click a calendar task to edit it
- Archived tasks are excluded

### Activity History

Task changes can be recorded in a persistent activity timeline, including:

- Task created
- Status changed
- Priority changed
- Deadline changed
- Title changed
- Description changed
- Archived / Restored
- Pinned / Unpinned
- Deleted

Activity history remains available even after a task is deleted.

### Quick Add

Create a Todo task quickly without navigating to the Tasks page.

Keyboard shortcuts:

- `Q` — open Quick Add when not typing
- `Ctrl + K` / `Cmd + K` — open Quick Add
- `Esc` — close the dialog

### Backup & Restore

- Download account data as JSON
- Backup active and archived tasks
- Backup Daily Work Logs
- Backup Activity History when available
- Preserve task Pin state
- Merge backup into existing data
- Replace all current data from a backup

### UI

- Soft Slate dark theme
- Responsive desktop/mobile layout
- Lightweight three-column Kanban board
- Coder-style favicon
- Interactive bottom-screen animal runner
- Runner choices: Dino, Cat, Dog, Rabbit, Fox, Turtle
- Runner selection and enable state stored locally

## Architecture

```text
GitHub Pages
     │
     ▼
HTML / CSS / JavaScript
     │
     ▼
Supabase
├── Authentication
├── PostgreSQL
└── Row Level Security (RLS)
```

The application does not require a dedicated backend server. Static frontend files are hosted by GitHub Pages while authentication and persistent data are handled by Supabase.

## Main Files

| File | Purpose |
| --- | --- |
| `index.html` | Main application UI |
| `style.css` | Global styling and responsive layout |
| `app.js` | Core tasks, dashboard, Daily Work Log, and export logic |
| `config.js` | Supabase project configuration |
| `backup.js` | JSON backup and restore |
| `archive.js` | Task archive / restore functionality |
| `pin.js` | Task Pin / Unpin and Dashboard pin integration |
| `calendar.js` | Calendar View |
| `activity.js` | Activity History and Quick Add |
| `dino.js` | Interactive animal runner |
| `schema.sql` | Supabase database schema and RLS policies |

## Database

The main Supabase tables are:

### `tasks`

Stores task data including:

- title
- description
- priority
- status
- deadline
- archive state
- pin state

### `daily_logs`

Stores one Daily Work Log per user and date.

### `task_activity`

Stores persistent task activity history.

All user-owned tables use Supabase **Row Level Security (RLS)** so authenticated users can only access their own records.

## Setup

### 1. Create a Supabase project

Create a project in Supabase.

### 2. Initialize the database

Open **Supabase → SQL Editor** and run `schema.sql`.

For an existing installation created before newer features were added, the repository also contains migration scripts such as:

- `migration_add_task_deadline.sql`
- `migration_add_task_archive.sql`
- `migration_add_task_activity.sql`
- `migration_add_task_pin.sql`

A new installation should use the latest `schema.sql`.

### 3. Configure Supabase

Copy your Supabase Project URL and publishable/anon key into `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-PUBLISHABLE-OR-ANON-KEY"
};
```

The browser-side publishable/anon key is expected to be public. Access control is enforced by Supabase RLS.

**Never put a Supabase `service_role` key in `config.js` or GitHub Pages.**

### 4. Enable authentication

In Supabase Authentication, enable Email authentication/sign-up as needed.

### 5. Deploy with GitHub Pages

In the GitHub repository:

1. Open **Settings → Pages**.
2. Select **Deploy from a branch**.
3. Select branch `main`.
4. Select folder `/ (root)`.

The current deployment is:

```text
https://leo871028.github.io/workLog-webtool/
```

## Local Development

No Node.js build step is required.

Start a simple local web server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Security Notes

- Authentication is handled by Supabase Auth.
- Database access is protected by Row Level Security.
- Each authenticated user only sees their own application data.
- Do not expose the Supabase `service_role` key.
- JSON backups can contain task descriptions and Daily Work Log content; keep backup files private.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- SheetJS for Excel export
- GitHub Pages
