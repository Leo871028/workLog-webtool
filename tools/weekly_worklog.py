#!/usr/bin/env python3
"""Save last week's Work Logs plus the current Todo/Ongoing task snapshot."""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import requests

API_URL = "https://dgztbxwkluufwtvhvcue.supabase.co/functions/v1/export-log"

# Fill in the same API key configured as EXPORT_API_KEY in Supabase.
# IMPORTANT: this repository is public. Do not commit your real API key.
API_KEY = "YOUR_API_KEY"

OUTPUT_DIR = Path("weekly_worklogs")


def last_complete_week() -> tuple[date, date]:
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    return this_monday - timedelta(days=7), this_monday - timedelta(days=1)


def fetch_week(start: date, end: date) -> dict:
    response = requests.get(
        API_URL,
        headers={"X-API-Key": API_KEY},
        params={
            "start": start.isoformat(),
            "end": end.isoformat(),
            "format": "json",
            "include_tasks": "true",
        },
        timeout=30,
    )

    if response.ok:
        return response.json()

    try:
        detail = json.dumps(response.json(), ensure_ascii=False)
    except ValueError:
        detail = response.text.strip() or "No response body"
    raise RuntimeError(f"HTTP {response.status_code}: {detail}")


def save_snapshot(data: dict, start: date, end: date) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"weekly_worklog_{start.isoformat()}_to_{end.isoformat()}.json"
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def print_summary(data: dict) -> None:
    logs = data.get("logs", [])
    tasks = data.get("tasks", {})
    ongoing = tasks.get("ongoing", [])
    todo = tasks.get("todo", [])

    print(f"Work Logs : {len(logs)}")
    print(f"Ongoing   : {len(ongoing)}")
    print(f"Todo      : {len(todo)}")

    if ongoing:
        print("\nOngoing Tasks")
        print("-" * 50)
        for task in ongoing:
            deadline = task.get("deadline") or "No deadline"
            print(f"- {task.get('title', '')} [{task.get('priority', '')}] ({deadline})")

    if todo:
        print("\nTodo Tasks")
        print("-" * 50)
        for task in todo:
            deadline = task.get("deadline") or "No deadline"
            print(f"- {task.get('title', '')} [{task.get('priority', '')}] ({deadline})")


def main() -> int:
    if not API_KEY or API_KEY == "YOUR_API_KEY":
        print("Error: Set API_KEY at the top of tools/weekly_worklog.py first.", file=sys.stderr)
        return 2

    start, end = last_complete_week()
    print(f"Fetching {start.isoformat()} ~ {end.isoformat()}...")

    try:
        data = fetch_week(start, end)
    except requests.RequestException as exc:
        print(f"Network error: {exc}", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        return 1

    path = save_snapshot(data, start, end)
    print_summary(data)
    print(f"\nSaved: {path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
