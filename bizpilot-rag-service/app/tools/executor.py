from typing import Dict, Any, Optional
from uuid import UUID
from app.services.database_service import DatabaseService
from app.schemas.api import (
    CheckAvailabilityArgs, BookAppointmentArgs, 
    TransferCallArgs, TakeMessageArgs
)
import logging

logger = logging.getLogger(__name__)


class ToolExecutor:
    def __init__(self, db_service: DatabaseService):
        self.db = db_service
    
    async def check_availability(self, args: CheckAvailabilityArgs) -> Dict[str, Any]:
        """
        Stub for check_availability - Booking Engine isn't built yet.
        Returns graceful message and falls through to take_message.
        """
        logger.info(f"check_availability called for service {args.service_id} on {args.date}")
        return {
            "available": False,
            "message": "Booking isn't available yet. I'll take a message instead.",
            "fallback_to_take_message": True
        }
    
    async def book_appointment(self, args: BookAppointmentArgs) -> Dict[str, Any]:
        """
        Stub for book_appointment - Booking Engine isn't built yet.
        Returns graceful message and falls through to take_message.
        """
        logger.info(f"book_appointment called for service {args.service_id}")
        return {
            "success": False,
            "message": "Booking isn't available yet. I'll take a message instead.",
            "fallback_to_take_message": True
        }
    
    async def transfer_call(self, args: TransferCallArgs, escalation_number: Optional[str] = None) -> Dict[str, Any]:
        """
        Real implementation: Return Vapi's transfer-call tool response.
        Uses voice_agent_configs.escalation_number if phone_number not provided.
        """
        phone_number = args.phone_number or escalation_number
        
        if not phone_number:
            return {
                "success": False,
                "error": "No escalation number configured"
            }
        
        logger.info(f"transfer_call to {phone_number}, reason: {args.reason}")
        
        # Return Vapi-compatible transfer response
        return {
            "success": True,
            "transfer": {
                "phoneNumber": phone_number
            }
        }
    
    async def take_message(self, args: TakeMessageArgs) -> Dict[str, Any]:
        """
        Real implementation: Insert a row into messages table.
        """
        logger.info(f"take_message for conversation {args.conversation_id}")
        
        # Build message content
        message_parts = []
        if args.customer_name:
            message_parts.append(f"Customer: {args.customer_name}")
        if args.customer_phone:
            message_parts.append(f"Phone: {args.customer_phone}")
        message_parts.append(f"Message: {args.summary}")
        if args.callback_requested:
            message_parts.append("Callback requested: Yes")
        
        content = "\n".join(message_parts)
        
        # Insert into messages table
        message = await self.db.add_message(
            conversation_id=args.conversation_id,
            sender="customer",
            content=content
        )
        
        if message:
            return {
                "success": True,
                "message_id": str(message.id),
                "confirmation": "I've taken your message. The business will get back to you soon."
            }
        else:
            return {
                "success": False,
                "error": "Failed to save message"
            }
    
    async def execute_tool(
        self, 
        tool_name: str, 
        arguments: Dict[str, Any], 
        escalation_number: Optional[str] = None,
        conversation_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Execute a tool by name with arguments"""
        
        if tool_name == "check_availability":
            args = CheckAvailabilityArgs(**arguments)
            return await self.check_availability(args)
        
        elif tool_name == "book_appointment":
            args = BookAppointmentArgs(**arguments)
            return await self.book_appointment(args)
        
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