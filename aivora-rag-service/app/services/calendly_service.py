"""Calendly booking for the orchestration (custom-LLM) voice path.

This mirrors Frontend/src/lib/calendly.server.ts + voiceTools.server.ts so a
call booked through the RAG service behaves identically to one booked through
the frontend's webhook path - same token vault, same refresh-before-expiry
rule, same availability re-check before writing a booking. Keep the two in
sync: a caller should never get different booking behaviour depending on
which path happens to be switched on.
"""

from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo
import logging
import re

import httpx

from app.core.config import get_settings
from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

CALENDLY_AUTH_BASE = "https://auth.calendly.com"
CALENDLY_API_BASE = "https://api.calendly.com"

# Refresh ~2 minutes before actual expiry to absorb request latency, matching
# EXPIRY_SKEW_MS in calendly.server.ts.
EXPIRY_SKEW = timedelta(minutes=2)

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# Returned verbatim by the tools when no booking engine is reachable, so the
# assistant always has something sensible to say.
NO_BOOKING_ENGINE_MESSAGE = (
    "Booking isn't set up yet. I've taken your details as a message instead."
)


class CalendlyService:
    def __init__(self):
        self.settings = get_settings()
        self.client = get_supabase_client()

    # ------------------------------------------------------------------
    # Token handling
    # ------------------------------------------------------------------

    def _get_connection(self, org_id: UUID) -> Optional[Dict[str, Any]]:
        try:
            result = (
                self.client.table("calendly_connections")
                .select("*")
                .eq("org_id", str(org_id))
                .maybe_single()
                .execute()
            )
            return result.data if result and result.data else None
        except Exception as e:
            logger.error(f"Error loading calendly connection for org {org_id}: {e}")
            return None

    def _read_secret(self, name: str) -> Optional[str]:
        try:
            result = self.client.rpc("read_calendly_secret", {"p_name": name}).execute()
            return result.data if result and result.data else None
        except Exception as e:
            logger.error(f"Error reading calendly secret {name}: {e}")
            return None

    def _store_secret(self, name: str, secret: str) -> None:
        try:
            self.client.rpc(
                "store_calendly_secret", {"p_name": name, "p_secret": secret}
            ).execute()
        except Exception as e:
            logger.error(f"Error storing calendly secret {name}: {e}")

    async def _refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        if not (self.settings.calendly_oauth_client_id and self.settings.calendly_oauth_client_secret):
            logger.error("Calendly OAuth credentials are not configured; cannot refresh token")
            return None
        try:
            async with httpx.AsyncClient(timeout=15) as http:
                res = await http.post(
                    f"{CALENDLY_AUTH_BASE}/oauth/token",
                    data={
                        "client_id": self.settings.calendly_oauth_client_id,
                        "client_secret": self.settings.calendly_oauth_client_secret,
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                    },
                )
            if res.status_code >= 400:
                logger.error(f"Calendly token refresh failed: {res.status_code} {res.text}")
                return None
            return res.json()
        except Exception as e:
            logger.error(f"Error refreshing calendly token: {e}")
            return None

    async def get_access(self, org_id: UUID) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Live access token + connection row, refreshing first if it's expired
        or about to be. Returns None when the org simply has no Calendly
        connection - callers fall back to taking a message."""
        connection = self._get_connection(org_id)
        if not connection:
            return None

        expires_at_raw = connection.get("token_expires_at")
        expires_at = None
        if expires_at_raw:
            try:
                expires_at = datetime.fromisoformat(str(expires_at_raw).replace("Z", "+00:00"))
            except ValueError:
                expires_at = None

        now = datetime.now(dt_timezone.utc)
        if expires_at and now < expires_at - EXPIRY_SKEW:
            token = self._read_secret(connection["access_token_secret_ref"])
            if token:
                return token, connection

        refresh_token = self._read_secret(connection["refresh_token_secret_ref"])
        if not refresh_token:
            return None

        refreshed = await self._refresh_token(refresh_token)
        if not refreshed:
            return None

        self._store_secret(connection["access_token_secret_ref"], refreshed["access_token"])
        self._store_secret(connection["refresh_token_secret_ref"], refreshed["refresh_token"])

        new_expiry = now + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
        try:
            self.client.table("calendly_connections").update(
                {"token_expires_at": new_expiry.isoformat(), "updated_at": now.isoformat()}
            ).eq("org_id", str(org_id)).execute()
        except Exception as e:
            logger.error(f"Error updating calendly token expiry for org {org_id}: {e}")

        connection["token_expires_at"] = new_expiry.isoformat()
        return refreshed["access_token"], connection

    # ------------------------------------------------------------------
    # Calendly API
    # ------------------------------------------------------------------

    async def get_available_times(
        self, access_token: str, event_type_uri: str, start: datetime, end: datetime
    ) -> List[Dict[str, Any]]:
        """Calendly caps each availability window at 31 days per request."""
        async with httpx.AsyncClient(timeout=20) as http:
            res = await http.get(
                f"{CALENDLY_API_BASE}/event_type_available_times",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "event_type": event_type_uri,
                    "start_time": _iso_z(start),
                    "end_time": _iso_z(end),
                },
            )
        if res.status_code >= 400:
            logger.error(f"Calendly availability error: {res.status_code} {res.text}")
            raise RuntimeError("calendly availability request failed")
        collection = res.json().get("collection", [])
        return [slot for slot in collection if slot.get("status") == "available"]

    async def create_invitee(
        self,
        access_token: str,
        event_type_uri: str,
        start_time: str,
        name: str,
        email: str,
        tz_name: str,
        sms_reminder_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        invitee: Dict[str, Any] = {"name": name, "email": email, "timezone": tz_name}
        if sms_reminder_number:
            invitee["text_reminder_number"] = sms_reminder_number

        async with httpx.AsyncClient(timeout=20) as http:
            res = await http.post(
                f"{CALENDLY_API_BASE}/invitees",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "event_type": event_type_uri,
                    "start_time": start_time,
                    "invitee": invitee,
                    "location": {"kind": "physical"},
                },
            )
        if res.status_code >= 400:
            logger.error(f"Calendly booking error: {res.status_code} {res.text}")
            raise RuntimeError("calendly booking request failed")
        return res.json()


def _iso_z(value: datetime) -> str:
    return value.astimezone(dt_timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def resolve_caller_time(requested_time: str, tz_name: str) -> Optional[datetime]:
    """The model resolves caller-relative times ("tomorrow at 3pm") against the
    current-time line in the system prompt and returns an ISO 8601 string, but
    it usually omits a UTC offset - which would otherwise be read as the
    *server's* local time, not the business's. Mirrors resolveCallerTime() in
    voice.server.ts."""
    value = (requested_time or "").strip()
    if not value:
        return None

    has_offset = bool(re.search(r"(Z|[+-]\d{2}:?\d{2})$", value))
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None

    if has_offset or parsed.tzinfo is not None:
        return parsed.astimezone(dt_timezone.utc)

    try:
        return parsed.replace(tzinfo=ZoneInfo(tz_name)).astimezone(dt_timezone.utc)
    except Exception:
        return parsed.replace(tzinfo=dt_timezone.utc)


def format_slots(iso_times: List[str], tz_name: str) -> str:
    try:
        zone = ZoneInfo(tz_name)
    except Exception:
        zone = dt_timezone.utc
    formatted = []
    for value in iso_times:
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(zone)
        except (ValueError, TypeError):
            continue
        # Built without strftime's %-d / %-I padding flags: those are
        # glibc-only, so on Windows they raise and every slot gets skipped.
        day = moment.strftime("%a %b") + f" {moment.day}"
        hour = moment.hour % 12 or 12
        formatted.append(f"{day}, {hour}:{moment.strftime('%M %p')}")
    return ", ".join(formatted)


def is_valid_email(value: str) -> bool:
    return bool(EMAIL_PATTERN.match(value or ""))
