#!/usr/bin/env python3

import argparse
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import calendar_feed
import parish_feed
import refresh_calendar
import refresh_liturgical_calendar
import refresh_parish
import southport_feed


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / "feeds" / "v1" / "calendar.json"
PARISH_REGISTRY_PATH = ROOT / "feeds" / "v1" / "parishes.json"
BRISBANE = ZoneInfo("Australia/Brisbane")


def read_json_lines(path):
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def write_calendar(path, feed):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(calendar_feed.encode_feed(feed), encoding="utf-8")
    temporary.replace(path)


def parish_registry():
    return {
        "schema_version": 1,
        "default_parish": "surfers-paradise",
        "parishes": [
            {
                "id": "surfers-paradise",
                "name": "Surfers Paradise Catholic Parish",
                "short_name": "SPCP",
                "theme": "spcp",
                "logo": "assets/spcp-logo.png",
                "calendar_feed": "feeds/v1/calendar.json",
                "parish_feed": "feeds/v1/parish.json",
            },
            {
                "id": "southport",
                "name": "Southport Catholic Parish",
                "short_name": "Southport",
                "theme": "southport",
                "logo": "assets/southport-logo.png",
                "calendar_feed": "feeds/v1/southport/calendar.json",
                "parish_feed": "feeds/v1/southport/parish.json",
            },
        ],
    }


def build(offline=False, generated_at=None):
    warnings = []
    if offline:
        events = read_json_lines(refresh_calendar.OUTPUT_PATH)
        liturgical = read_json_lines(refresh_liturgical_calendar.OUTPUT_PATH)
        parish = parish_feed.validate_feed(
            json.loads(refresh_parish.OUTPUT_PATH.read_text(encoding="utf-8"))
        )
        sources = [
            {"name": "SPCP Google Calendar", "url": refresh_calendar.ICS_URL, "status": "cached"},
            {"name": "Universalis Brisbane", "url": refresh_liturgical_calendar.CALENDAR_URL, "status": "cached"},
        ]
    else:
        window_start, window_end = refresh_calendar.default_window()
        events = refresh_calendar.build_records(
            refresh_calendar.fetch_calendar_text(), window_start, window_end
        )
        refresh_calendar.write_records(events)
        liturgical = refresh_liturgical_calendar.build_calendar_records(
            refresh_liturgical_calendar.fetch_calendar_html()
        )
        refresh_liturgical_calendar.write_records(liturgical)
        parish = refresh_parish.parse_homepage(refresh_parish.fetch_homepage())
        refresh_parish.write_feed(parish)
        sources = [
            {"name": "SPCP Google Calendar", "url": refresh_calendar.ICS_URL, "status": "fresh"},
            {"name": "Universalis Brisbane", "url": refresh_liturgical_calendar.CALENDAR_URL, "status": "fresh"},
        ]

    generated_at = generated_at or datetime.now(BRISBANE).isoformat(timespec="seconds")
    feed = calendar_feed.build_feed(events, liturgical, generated_at, warnings, sources)
    write_calendar(OUTPUT_PATH, feed)

    southport_parish = southport_feed.build_parish_feed()
    southport_feed.write_parish_feed(southport_parish)
    window_start, window_end = refresh_calendar.default_window()
    southport_events = southport_feed.build_records(window_start, window_end)
    southport_calendar = calendar_feed.build_feed(
        southport_events,
        liturgical,
        generated_at,
        [],
        [
            {
                "name": "Southport published recurring schedule",
                "url": southport_feed.PARISH_URL,
                "status": "baseline",
            },
            {
                "name": "Southport parish newsletters",
                "url": southport_feed.NEWSLETTERS_URL,
                "status": "future-automation",
            },
            {
                "name": "Universalis Brisbane",
                "url": refresh_liturgical_calendar.CALENDAR_URL,
                "status": "cached" if offline else "fresh",
            },
        ],
    )
    write_calendar(southport_feed.CALENDAR_OUTPUT_PATH, southport_calendar)
    write_json(PARISH_REGISTRY_PATH, parish_registry())
    return feed, southport_calendar


def main():
    parser = argparse.ArgumentParser(description="Build the SPCP versioned calendar feed.")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Build from the checked-in JSONL inputs without downloading sources.",
    )
    args = parser.parse_args()
    feed, southport_calendar = build(offline=args.offline)
    print(
        f'Wrote {len(feed["events"])} events covering '
        f'{feed["coverage"]["start"]} to {feed["coverage"]["end"]} to {OUTPUT_PATH}'
    )
    print(f"Validated parish data at {refresh_parish.OUTPUT_PATH}")
    print(
        f'Wrote {len(southport_calendar["events"])} Southport events to '
        f"{southport_feed.CALENDAR_OUTPUT_PATH}"
    )
    print(f"Wrote parish registry to {PARISH_REGISTRY_PATH}")


if __name__ == "__main__":
    main()
