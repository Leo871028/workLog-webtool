# WorkTaskTracker — GitHub Pages + Supabase

A lightweight personal work tracker that can be accessed remotely from multiple devices.

## Features

- Todo / Ongoing / Done task board
- Add, edit, move, and delete tasks
- Priority: Low / Medium / High
- Daily Work Log
- Prev Day / Today / Next Day
- Morandi UI theme
- Supabase cloud sync
- Email/password login
- Row Level Security (RLS): each user only sees their own data
- No Node.js required for GitHub Pages deployment

## Setup

1. Create a Supabase project at https://supabase.com/.
2. Open **SQL Editor** and run all SQL from `schema.sql`.
3. In **Project Settings → API**, copy the Project URL and publishable/anon key.
4. Put them into `config.js`.
5. In **Authentication → Providers → Email**, enable Email authentication.
6. Push these files to a GitHub repository.
7. In **Repository → Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.

Your site will normally be:

```text
https://YOUR_USERNAME.github.io/work-task-tracker/
```

## Security

The browser-side publishable/anon key is expected to be public. Security is enforced by Supabase RLS policies in `schema.sql`.

Never put the Supabase `service_role` key in `config.js` or GitHub Pages.

## Local test

You can test without Node.js:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
