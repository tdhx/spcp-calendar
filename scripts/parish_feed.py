#!/usr/bin/env python3

import json
import re


SCHEMA_VERSION = 1
WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday")


def validate_feed(feed):
    if feed.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("Unsupported parish feed schema")

    required_text = (
        ("id", feed.get("id")),
        ("name", feed.get("name")),
        ("contact.phone", feed.get("contact", {}).get("phone")),
        ("contact.email", feed.get("contact", {}).get("email")),
        ("contact.website", feed.get("contact", {}).get("website")),
        ("office.address", feed.get("office", {}).get("address")),
    )
    missing = [name for name, value in required_text if not isinstance(value, str) or not value]
    if missing:
        raise ValueError(f'Parish feed is missing {", ".join(missing)}')

    hours = feed.get("office", {}).get("hours", {})
    if set(hours) != set(WEEKDAYS):
        raise ValueError("Parish office hours must cover Monday to Friday")
    if any(not re.fullmatch(r"\d{2}:\d{2}-\d{2}:\d{2}", value) for value in hours.values()):
        raise ValueError("Parish office hours must use HH:MM-HH:MM")

    clergy = feed.get("clergy")
    if not isinstance(clergy, list) or not clergy:
        raise ValueError("Parish feed must include clergy")
    if any(not member.get("role") or not member.get("name") for member in clergy):
        raise ValueError("Each clergy member must include a role and name")

    churches = feed.get("churches")
    if not isinstance(churches, list) or not churches:
        raise ValueError("Parish feed must include churches")
    church_ids = [church.get("id") for church in churches]
    if any(
        not church.get("id")
        or not church.get("name")
        or not church.get("address")
        or not isinstance(church.get("is_primary_site"), bool)
        or church.get("location_type", "church") not in {"church", "chaplaincy"}
        for church in churches
    ):
        raise ValueError(
            "Each location must include its id, name, address, valid location type "
            "and primary-site flag"
        )
    if len(church_ids) != len(set(church_ids)):
        raise ValueError("Parish feed contains duplicate church IDs")
    if sum(church["is_primary_site"] for church in churches) != 1:
        raise ValueError("Parish feed must identify exactly one primary church")

    return feed


def encode_feed(feed):
    validate_feed(feed)
    return json.dumps(feed, ensure_ascii=False, indent=2) + "\n"
