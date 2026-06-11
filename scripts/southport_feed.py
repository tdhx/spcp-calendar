#!/usr/bin/env python3

from calendar import monthrange
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import parish_feed


ROOT = Path(__file__).resolve().parent.parent
PARISH_URL = "https://scp.org.au/"
NEWSLETTERS_URL = "https://scp.org.au/newsletters-2026/"
PARISH_OUTPUT_PATH = ROOT / "feeds" / "v1" / "southport" / "parish.json"
CALENDAR_OUTPUT_PATH = ROOT / "feeds" / "v1" / "southport" / "calendar.json"
BRISBANE = ZoneInfo("Australia/Brisbane")


def build_parish_feed():
    return parish_feed.validate_feed({
        "schema_version": parish_feed.SCHEMA_VERSION,
        "id": "southport",
        "name": "Southport Catholic Parish",
        "summary": (
            "Serving Southport, Labrador, Ashmore and the Gold Coast University "
            "Hospital community."
        ),
        "contact": {
            "phone": "(07) 5510 2222",
            "email": "parish@scp.org.au",
            "website": PARISH_URL,
        },
        "office": {
            "address": "115 Scarborough Street, Southport QLD 4215",
            "hours": {
                "monday": "09:00-16:30",
                "tuesday": "09:00-16:30",
                "wednesday": "09:00-16:30",
                "thursday": "09:00-16:30",
                "friday": "09:00-16:30",
            },
        },
        "clergy": [
            {"role": "Parish Priest", "name": "Fr Gerard McMorrow"},
            {
                "role": "Associate Pastor and Hospital Chaplain",
                "name": "Fr John Hong Xuan Nguyen",
            },
        ],
        "churches": [
            {
                "id": "guardian-angels",
                "name": "Guardian Angels Church",
                "address": "99 Scarborough Street, Southport QLD 4215",
                "is_primary_site": True,
                "location_type": "church",
            },
            {
                "id": "st-joseph-the-worker",
                "name": "St Joseph the Worker Church",
                "address": "44 Imperial Parade, Labrador QLD 4215",
                "is_primary_site": False,
                "location_type": "church",
            },
            {
                "id": "mary-immaculate",
                "name": "Mary Immaculate Church",
                "address": "31 Edmund Rice Drive, Ashmore QLD 4214",
                "is_primary_site": False,
                "location_type": "church",
            },
            {
                "id": "gold-coast-university-hospital",
                "name": "Gold Coast University Hospital",
                "address": "1 Hospital Boulevard, Southport QLD 4215",
                "is_primary_site": False,
                "location_type": "chaplaincy",
            },
        ],
    })


# This normalized list is the stable boundary for a future newsletter parser.
# A later adapter can return the same shape and leave calendar generation unchanged.
def normalized_service_definitions(source=None):
    if source is not None:
        return list(source)
    return [
        weekly("guardian-angels-friday-rosary", "Guardian Angels", 4, "12:00", "rosary", 30),
        weekly("guardian-angels-friday-mass", "Guardian Angels", 4, "12:30", "mass"),
        weekly("guardian-angels-reconciliation", "Guardian Angels", 5, "16:30", "confession", 30),
        weekly("guardian-angels-vigil", "Guardian Angels", 5, "17:30", "mass"),
        weekly("guardian-angels-sunday-7", "Guardian Angels", 6, "07:00", "mass"),
        weekly("guardian-angels-sunday-9", "Guardian Angels", 6, "09:00", "mass"),
        monthly(
            "guardian-angels-filipino",
            "Guardian Angels",
            6,
            1,
            "12:00",
            "multicultural",
            subtype="filipino",
        ),
        weekly("guardian-angels-adoration", "Guardian Angels", 3, "12:00", "adoration", 24 * 60),
        weekly("st-joseph-monday-mass", "St Joseph the Worker", 0, "07:00", "mass"),
        weekly("st-joseph-wednesday-mass", "St Joseph the Worker", 2, "07:00", "mass"),
        weekly("st-joseph-sunday-mass", "St Joseph the Worker", 6, "08:00", "mass"),
        monthly("st-joseph-first-wednesday-mass", "St Joseph the Worker", 2, 1, "19:00", "mass"),
        monthly("st-joseph-first-saturday-mass", "St Joseph the Worker", 5, 1, "09:00", "mass"),
        weekly("st-joseph-monday-rosary", "St Joseph the Worker", 0, "06:00", "rosary", 30),
        weekly("st-joseph-wednesday-rosary", "St Joseph the Worker", 2, "06:00", "rosary", 30),
        monthly("st-joseph-first-wednesday-rosary", "St Joseph the Worker", 2, 1, "18:00", "rosary", 30),
        monthly("st-joseph-first-saturday-rosary", "St Joseph the Worker", 5, 1, "08:30", "rosary", 30),
        weekly("st-joseph-novena", "St Joseph the Worker", 2, "18:00", "novena", 30),
        weekly("mary-immaculate-tuesday-mass", "Mary Immaculate", 1, "09:00", "mass"),
        weekly("mary-immaculate-thursday-mass", "Mary Immaculate", 3, "09:00", "mass"),
        weekly("mary-immaculate-vigil", "Mary Immaculate", 5, "16:30", "mass"),
        weekly("mary-immaculate-sunday-930", "Mary Immaculate", 6, "09:30", "mass"),
        weekly("mary-immaculate-korean", "Mary Immaculate", 6, "15:00", "multicultural", subtype="korean"),
        weekly("mary-immaculate-sunday-530", "Mary Immaculate", 6, "17:30", "mass"),
        weekly("mary-immaculate-tuesday-adoration", "Mary Immaculate", 1, "07:45", "adoration", 45),
        weekly("mary-immaculate-thursday-adoration", "Mary Immaculate", 3, "07:45", "adoration", 45),
        weekly("hospital-friday-rosary", "Gold Coast University Hospital", 4, "10:00", "rosary", 30),
        weekly("hospital-friday-mass", "Gold Coast University Hospital", 4, "10:30", "mass"),
    ]


def weekly(service_id, church, weekday, start, event_type, duration=60, subtype=None):
    return {
        "id": service_id,
        "church": church,
        "recurrence": {"frequency": "weekly", "weekday": weekday},
        "start": start,
        "duration_minutes": duration,
        "event_type": event_type,
        "event_subtype": subtype,
    }


def monthly(service_id, church, weekday, ordinal, start, event_type, duration=60, subtype=None):
    return {
        "id": service_id,
        "church": church,
        "recurrence": {
            "frequency": "monthly",
            "weekday": weekday,
            "ordinal": ordinal,
        },
        "start": start,
        "duration_minutes": duration,
        "event_type": event_type,
        "event_subtype": subtype,
    }


def first_matching_weekday(year, month, weekday, ordinal):
    matches = [
        day
        for day in range(1, monthrange(year, month)[1] + 1)
        if datetime(year, month, day).weekday() == weekday
    ]
    return matches[ordinal - 1]


def service_dates(service, window_start, window_end):
    recurrence = service["recurrence"]
    cursor = window_start.date()
    if recurrence["frequency"] == "weekly":
        cursor += timedelta(days=(recurrence["weekday"] - cursor.weekday()) % 7)
        while cursor < window_end.date():
            yield cursor
            cursor += timedelta(days=7)
        return

    year, month = cursor.year, cursor.month
    while datetime(year, month, 1, tzinfo=BRISBANE) < window_end:
        day = first_matching_weekday(
            year,
            month,
            recurrence["weekday"],
            recurrence["ordinal"],
        )
        candidate = datetime(year, month, day, tzinfo=BRISBANE).date()
        if window_start.date() <= candidate < window_end.date():
            yield candidate
        month += 1
        if month == 13:
            year += 1
            month = 1


def title_for(service):
    subtype = service.get("event_subtype")
    names = {
        "mass": "Mass",
        "confession": "Reconciliation",
        "adoration": "Adoration",
        "rosary": "Rosary",
        "novena": "Novena",
    }
    service_name = f"{subtype.title()} Mass" if subtype else names[service["event_type"]]
    return f'{service["church"]} - {service_name}'


def build_records(window_start, window_end, definitions=None):
    records = []
    for service in normalized_service_definitions(definitions):
        hour, minute = (int(value) for value in service["start"].split(":"))
        for service_date in service_dates(service, window_start, window_end):
            start = datetime.combine(service_date, time(hour, minute), BRISBANE)
            end = start + timedelta(minutes=service["duration_minutes"])
            records.append({
                "start": start.isoformat(timespec="seconds"),
                "end": end.isoformat(timespec="seconds"),
                "all_day": False,
                "timezone": "Australia/Brisbane",
                "church": service["church"],
                "event_type": service["event_type"],
                "event_subtype": service.get("event_subtype"),
                "associated_devotions": [],
                "title": title_for(service),
                "presiders": [],
                "location": service["church"],
                "description": None,
                "source_id": f'southport-schedule:{service["id"]}#{start.isoformat()}',
            })
    return sorted(records, key=lambda item: (item["start"], item["end"], item["title"]))


def write_parish_feed(feed):
    PARISH_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = PARISH_OUTPUT_PATH.with_suffix(".json.tmp")
    temporary.write_text(parish_feed.encode_feed(feed), encoding="utf-8")
    temporary.replace(PARISH_OUTPUT_PATH)
