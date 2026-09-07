#!/usr/bin/env python3
"""CLI client for the WorkTaskTracker Daily Work Log export API."""

import argparse
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path

import requests

API_URL = "https://dgztbxwkluufwtvhvcue.supabase.co/functions/v1/export-log"
FORMATS = ("json", "csv", "xlsx", "md", "txt")


def valid_date(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from exc
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export saved Daily Work Logs through the WorkTaskTracker API."
    )
    parser.add_argument("--start", required=True, type=valid_date, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=valid_date, help="End date (YYYY-MM-DD). Defaults to today")
    parser.add_argument("--format", choices=FORMATS, default="json", help="Export format (default: json)")
    parser.add_argument("--output", "-o", help="Output file or directory for non-JSON formats")
    parser.add_argument(
        "--api-key",
        help="API key. Prefer the WORKLOG_API_KEY environment variable instead.",
    )
    return parser


def request_export(start: str, end: str, export_format: str, api_key: str) -> requests.Response:
    response = requests.get(
        API_URL,
        headers={"X-API-Key": api_key},
        params={"start": start, "end": end, "format": export_format},
        timeout=30,
    )
    if response.ok:
        return response

    try:
        detail = response.json()
        detail_text = json.dumps(detail, ensure_ascii=False)
    except ValueError:
        detail_text = response.text.strip() or "No response body"
    raise RuntimeError(f"HTTP {response.status_code}: {detail_text}")


def output_path_for(output: str | None, start: str, end: str, export_format: str) -> Path:
    filename = f"daily_work_log_{start}_to_{end}.{export_format}"
    if not output:
        return Path.cwd() / filename
    path = Path(output).expanduser()
    if path.exists() and path.is_dir():
        return path / filename
    if output.endswith(("/", "\\")):
        path.mkdir(parents=True, exist_ok=True)
        return path / filename
    return path


def main() -> int:
    args = build_parser().parse_args()
    end = args.end or date.today().isoformat()
    if args.start > end:
        print("Error: --start cannot be later than --end.", file=sys.stderr)
        return 2

    api_key = args.api_key or os.getenv("WORKLOG_API_KEY")
    if not api_key:
        print(
            "Error: API key not found. Set WORKLOG_API_KEY or pass --api-key.",
            file=sys.stderr,
        )
        return 2

    try:
        response = request_export(args.start, end, args.format, api_key)
    except requests.RequestException as exc:
        print(f"Network error: {exc}", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        return 1

    if args.format == "json":
        payload = response.json()
        if args.output:
            path = Path(args.output).expanduser()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"Saved: {path.resolve()}")
        else:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    path = output_path_for(args.output, args.start, end, args.format)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    count = response.headers.get("X-Export-Count")
    suffix = f" ({count} logs)" if count else ""
    print(f"Saved: {path.resolve()}{suffix}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
