from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Dict, Any, Optional
from uuid import UUID
import logging

from app.services.database_service import DatabaseService
from app.services.calendly_service import (
    CalendlyService,
    NO_BOOKING_ENGINE_MESSAGE,
    format_slots,
    is_valid_email,
    resolve_caller_time,
)
from app.schemas.api import (
    CheckAvailabilityArgs,
    BookAppointmentArgs,
    TransferCallArgs,
    TakeMessageArgs,
)

logger = logging.getLogger(__name__)


class ToolExecutor:
    def __init__(self, db_service: DatabaseService):
        self.db = db_service
        self.calendly = CalendlyService()

    async def check_availability(
        self,
        args: CheckAvailabilityArgs,
        org_id: Optional[UUID],
        conversation_id: Optional[UUID],
        tz_name: str,
    ) -> Dict[str, Any]:
        """Real availability lookup against the org's connected Calendly."""
        if not org_id:
            return {"success": True, "confirmation": NO_BOOKING_ENGINE_MESSAGE}

        access = await self.calendly.get_access(org_id)
        if not access or not access[1].get("event_type_uri"):
            if conversation_id:
                await self.take_message(
                    TakeMessageArgs(
                        conversation_id=conversation_id,
                        summary=f"Customer tried to check availability{f' for {args.service}' if args.service else ''}.",
                        callback_requested=True,
                    )
                )
            return {"success": True, "confirmation": NO_BOOKING_ENGINE_MESSAGE}

        token, connection = access
        resolved = resolve_caller_time(args.requested_time, tz_name) if args.requested_time else None
        now = datetime.now(dt_timezone.utc)
        anchor = resolved if resolved and resolved > now else now
        window_end = anchor + timedelta(days=7)

        try:
            slots = await self.calendly.get_available_times(
                token, connection["event_type_uri"], anchor, window_end
            )
        except Exception as e:
            logger.error(f"Calendly availability error: {e}")
            return {
                "success": True,
                "confirmation": "I'm having trouble reaching the calendar right now. Would you like me to take a message instead?",
            }

        if not slots:
            return {
                "success": True,
                "confirmation": "There's nothing open in the next week. Would you like me to take a message so the team can follow up?",
            }

        formatted = format_slots([s["start_time"] for s in slots[:5]], tz_name)
        return {
            "success": True,
            "confirmation": f"Here are the next open times: {formatted}. Which works best?",
        }

    async def book_appointment(
        self,
        args: BookAppointmentArgs,
        org_id: Optional[UUID],
        conversation_id: Optional[UUID],
        tz_name: str,
    ) -> Dict[str, Any]:
        """Books a real Calendly invitee, re-checking the slot first."""
        if not org_id:
            return {"success": True, "confirmation": NO_BOOKING_ENGINE_MESSAGE}

        access = await self.calendly.get_access(org_id)
        if not access or not access[1].get("event_type_uri"):
            if conversation_id:
                await self.take_message(
                    TakeMessageArgs(
                        conversation_id=conversation_id,
                        summary=f"Customer tried to book {args.service or 'an appointment'}.",
                        callback_requested=True,
                    )
                )
            return {"success": True, "confirmation": NO_BOOKING_ENGINE_MESSAGE}

        token, connection = access

        name = (args.customer_name or "").strip()
        email = (args.customer_email or "").strip()
        phone = (args.customer_phone or "").strip()

        if not name or not args.requested_time:
            return {
                "success": True,
                "confirmation": "I still need the caller's name and a specific day and time before I can book that.",
            }
        if not is_valid_email(email):
            return {
                "success": True,
                "confirmation": "I need a valid email address for the confirmation - could you ask the caller for one?",
            }

        requested = resolve_caller_time(args.requested_time, tz_name)
        now = datetime.now(dt_timezone.utc)
        if not requested or requested < now - timedelta(minutes=1):
            return {
                "success": True,
                "confirmation": "That time doesn't look valid or has already passed - could you confirm a specific upcoming day and time with the caller?",
            }

        try:
            # Defensive re-check: the slot may have been taken since the model
            # last called check_availability, so never trust it blindly.
            slots = await self.calendly.get_available_times(
                token, connection["event_type_uri"], requested, requested + timedelta(days=1)
            )
            still_open = any(
                abs(
                    (
                        datetime.fromisoformat(s["start_time"].replace("Z", "+00:00")) - requested
                    ).total_seconds()
                )
                < 60
                for s in slots
            )
            if not still_open:
                return {
                    "success": True,
                    "confirmation": "That exact time isn't available anymore - please check availability again and offer the caller a different slot.",
                }

            await self.calendly.create_invitee(
                token,
                connection["event_type_uri"],
                requested.isoformat().replace("+00:00", "Z"),
                name,
                email,
                tz_name,
                phone or None,
            )
        except Exception as e:
            logger.error(f"Calendly booking error: {e}")
            if conversation_id:
                await self.take_message(
                    TakeMessageArgs(
                        conversation_id=conversation_id,
                        customer_name=name,
                        summary=f"Wanted to book {args.service or 'an appointment'} at {args.requested_time}, but automatic booking failed.",
                        callback_requested=True,
                    )
                )
            return {
                "success": True,
                "confirmation": "Something went wrong booking that automatically. I've taken a message so the team can confirm it with you directly.",
            }

        if conversation_id:
            await self.db.add_message(
                conversation_id=conversation_id,
                sender="ai",
                content=f"Booked via Calendly: {name} ({email}) at {requested.isoformat()}.",
            )

        when = format_slots([requested.isoformat().replace("+00:00", "Z")], tz_name)
        return {
            "success": True,
            "confirmation": f"Booked for {when}. A confirmation email is on its way to {email}.",
        }

    async def transfer_call(
        self, args: TransferCallArgs, escalation_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """Returns Vapi's transfer-call tool response, falling back to the
        configured escalation number when the model didn't supply one."""
        phone_number = args.phone_number or escalation_number

        if not phone_number:
            return {"success": False, "error": "No escalation number configured"}

        logger.info(f"transfer_call to {phone_number}, reason: {args.reason}")
        return {"success": True, "transfer": {"phoneNumber": phone_number}}

    async def take_message(self, args: TakeMessageArgs) -> Dict[str, Any]:
        """Real implementation: Insert a row into messages table."""
        logger.info(f"take_message for conversation {args.conversation_id}")

        message_parts = []
        if args.customer_name:
            message_parts.append(f"Customer: {args.customer_name}")
        if args.customer_phone:
            message_parts.append(f"Phone: {args.customer_phone}")
        message_parts.append(f"Message: {args.summary}")
        if args.callback_requested:
            message_parts.append("Callback requested: Yes")

        content = "\n".join(message_parts)

        message = await self.db.add_message(
            conversation_id=args.conversation_id,
            sender="customer",
            content=content,
        )

        if message:
            return {
                "success": True,
                "message_id": str(message.id),
                "confirmation": "I've taken your message. The business will get back to you soon.",
            }
        return {"success": False, "error": "Failed to save message"}

    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        escalation_number: Optional[str] = None,
        conversation_id: Optional[UUID] = None,
        org_id: Optional[UUID] = None,
        tz_name: str = "UTC",
    ) -> Dict[str, Any]:
        """Execute a tool by name with arguments"""

        if tool_name == "check_availability":
            args = CheckAvailabilityArgs(**arguments)
            return await self.check_availability(args, org_id, conversation_id, tz_name)

        elif tool_name == "book_appointment":
            args = BookAppointmentArgs(**arguments)
            return await self.book_appointment(args, org_id, conversation_id, tz_name)

        elif tool_name == "transfer_call":
            args = TransferCallArgs(**arguments)
            return await self.transfer_call(args, escalation_number)

        elif tool_name == "take_message":
            if not conversation_id:
                return {"success": False, "error": "conversation_id required for take_message"}
            args = TakeMessageArgs(conversation_id=conversation_id, **arguments)
            return await self.take_message(args)

        else:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

    def get_available_tools(self, functions_enabled: Dict[str, bool]) -> list[str]:
        """Get list of enabled tool names"""
        return [name for name, enabled in functions_enabled.items() if enabled]
