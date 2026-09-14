import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4


@pytest.fixture(autouse=True)
def required_settings(monkeypatch):
    """Keep unit tests independent from a developer's real .env file."""
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setenv("ORCHESTRATION_SHARED_SECRET", "test-orchestration-secret")
    from app.core.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def mock_supabase():
    with patch("app.db.supabase.create_client") as mock:
        yield mock


@pytest.fixture
def mock_anthropic():
    with patch("app.services.llm_service.AsyncAnthropic") as mock:
        yield mock


class TestConfig:
    def test_settings_load(self):
        from app.core.config import Settings
        # Test that settings can be instantiated with required fields
        settings = Settings(
            supabase_url="https://test.supabase.co",
            supabase_service_role_key="test-key",
            openai_api_key="sk-test",
            gemini_api_key="test-gemini-key",
            orchestration_shared_secret="test-orchestration-secret",
        )
        assert settings.supabase_url == "https://test.supabase.co"
        assert settings.embedding_model == "gemini-embedding-001"
        assert settings.kb_extraction_model == "gemini-2.5-flash"


class TestDatabaseModels:
    def test_voice_agent_config_defaults(self):
        from app.models.database import VoiceAgentConfig
        config = VoiceAgentConfig(service_id=uuid4())
        assert config.llm_provider == "openai"
        assert config.llm_model == "gpt-4o-mini"
        # None means "not explicitly configured" - the caller (LLMService)
        # picks a provider-appropriate default rather than this model
        # baking in one fixed (and possibly wrong-provider) model name.
        assert config.llm_model_escalated is None
        assert config.kb_enabled is True
        assert config.functions_enabled["check_availability"] is True


class TestPromptTemplates:
    def test_build_system_prompt(self):
        from app.prompts.templates import build_system_prompt, INJECTION_MITIGATION_BLOCK
        from app.schemas.api import OrgConfig, RetrievedKBChunk
        from app.models.database import BusinessProfile, VoiceAgentConfig
        from uuid import uuid4
        
        org_config = OrgConfig(
            org_id=uuid4(),
            service_id=uuid4(),
            business_profile=BusinessProfile(
                org_id=uuid4(),
                display_name="Test Business",
                description="A test business",
                address={"street": "123 Main St"},
                business_hours={"monday": "9-5"},
                languages=["en"]
            ),
            voice_agent_config=VoiceAgentConfig(
                service_id=uuid4(),
                persona_name="Test Assistant",
                functions_enabled={"check_availability": True, "take_message": True}
            )
        )
        
        chunks = [
            RetrievedKBChunk(
                id=uuid4(),
                title="Hours",
                content="We are open Monday-Friday 9-5",
                similarity=0.9
            )
        ]
        
        prompt = build_system_prompt(org_config, chunks, ["check_availability", "take_message"])

        assert "Test Assistant" in prompt
        assert "Test Business" in prompt
        assert "Monday-Friday 9-5" in prompt
        assert "check_availability" in prompt
        assert INJECTION_MITIGATION_BLOCK in prompt


class TestGeminiEmbeddings:
    """Embeddings moved from OpenAI to Gemini (free tier) - the live voice
    call stays on OpenAI/Anthropic, but nothing else should touch it."""

    @pytest.mark.asyncio
    async def test_embed_text_uses_configured_model_and_dimension(self):
        from types import SimpleNamespace
        from app.services.embedding_service import EmbeddingService, EMBEDDING_DIMENSIONS

        service = EmbeddingService()
        fake_response = SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1, 0.2, 0.3])])
        service.client.aio.models.embed_content = AsyncMock(return_value=fake_response)

        result = await service.embed_text("hello world")

        assert result == [0.1, 0.2, 0.3]
        call_kwargs = service.client.aio.models.embed_content.call_args.kwargs
        assert call_kwargs["model"] == service.settings.embedding_model
        assert call_kwargs["config"].output_dimensionality == EMBEDDING_DIMENSIONS

    @pytest.mark.asyncio
    async def test_embed_texts_returns_one_vector_per_input(self):
        from types import SimpleNamespace
        from app.services.embedding_service import EmbeddingService

        service = EmbeddingService()
        fake_response = SimpleNamespace(
            embeddings=[SimpleNamespace(values=[1.0]), SimpleNamespace(values=[2.0])]
        )
        service.client.aio.models.embed_content = AsyncMock(return_value=fake_response)

        result = await service.embed_texts(["a", "b"])

        assert result == [[1.0], [2.0]]


class TestKnowledgeExtractionUsesGemini:
    @pytest.mark.asyncio
    async def test_extract_and_insert_entries_embeds_via_gemini(self):
        from types import SimpleNamespace
        from app.services.kb_service import KBService
        from app.services.database_service import DatabaseService
        from app.services.embedding_service import EmbeddingService
        from app.models.database import KnowledgeBaseEntry
        from datetime import datetime, timezone

        db_mock = MagicMock(spec=DatabaseService)

        async def fake_insert(entries):
            return [
                KnowledgeBaseEntry(
                    id=uuid4(),
                    org_id=uuid4(),
                    type=e["type"],
                    title=e["title"],
                    content=e["content"],
                    created_at=datetime.now(timezone.utc),
                )
                for e in entries
            ]

        db_mock.insert_kb_entries = AsyncMock(side_effect=fake_insert)

        embedding_service = MagicMock(spec=EmbeddingService)
        embedding_service.embed_kb_entry = AsyncMock(return_value=[0.5, 0.6])

        with patch("app.services.kb_service.create_client"):
            kb_service = KBService(db_mock, embedding_service)

        fake_extraction = SimpleNamespace(
            text='[{"type": "hours", "title": "Hours", "content": "Open 9-5 Mon-Fri"}]'
        )
        kb_service.genai_client.aio.models.generate_content = AsyncMock(
            return_value=fake_extraction
        )

        result = await kb_service.parse_text(uuid4(), "x" * 60)

        assert result["success"] is True
        assert result["entries_created"] == 1
        # The extraction call must go through Gemini, using the configured
        # extraction model - not gpt-4o-mini / AsyncOpenAI.
        generate_call = kb_service.genai_client.aio.models.generate_content.call_args.kwargs
        assert generate_call["model"] == kb_service.settings.kb_extraction_model
        assert generate_call["config"].response_mime_type == "application/json"
        # And the extracted entry must have been embedded before insert, not
        # left for the (never automatically called) reembed endpoint.
        inserted_entry = db_mock.insert_kb_entries.call_args.args[0][0]
        assert inserted_entry["embedding"] == [0.5, 0.6]
        assert inserted_entry["embedded_at"] is not None


class TestToolExecutor:
    @pytest.mark.asyncio
    async def test_check_availability_without_org_falls_back(self):
        """No org means no Calendly connection to look up - the caller should
        still get a sensible spoken reply rather than an error."""
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import CheckAvailabilityArgs

        db_mock = MagicMock(spec=DatabaseService)
        executor = ToolExecutor(db_mock)

        args = CheckAvailabilityArgs(requested_time="2026-01-15T15:00:00", service="haircut")

        result = await executor.check_availability(
            args, org_id=None, conversation_id=None, tz_name="UTC"
        )

        assert result["success"] is True
        assert "Booking isn't set up yet" in result["confirmation"]

    @pytest.mark.asyncio
    async def test_check_availability_without_calendly_connection(self):
        """Org exists but has never connected Calendly."""
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import CheckAvailabilityArgs

        db_mock = MagicMock(spec=DatabaseService)
        executor = ToolExecutor(db_mock)
        executor.calendly.get_access = AsyncMock(return_value=None)

        args = CheckAvailabilityArgs(requested_time="2026-01-15T15:00:00")

        result = await executor.check_availability(
            args, org_id=uuid4(), conversation_id=None, tz_name="America/New_York"
        )

        assert result["success"] is True
        assert "Booking isn't set up yet" in result["confirmation"]

    @pytest.mark.asyncio
    async def test_check_availability_returns_real_slots(self):
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import CheckAvailabilityArgs

        db_mock = MagicMock(spec=DatabaseService)
        executor = ToolExecutor(db_mock)
        executor.calendly.get_access = AsyncMock(
            return_value=("token", {"event_type_uri": "https://api.calendly.com/event_types/x"})
        )
        executor.calendly.get_available_times = AsyncMock(
            return_value=[
                {"status": "available", "start_time": "2099-01-15T20:00:00Z"},
                {"status": "available", "start_time": "2099-01-15T21:00:00Z"},
            ]
        )

        args = CheckAvailabilityArgs(requested_time="2099-01-15T15:00:00")
        result = await executor.check_availability(
            args, org_id=uuid4(), conversation_id=None, tz_name="America/New_York"
        )

        assert result["success"] is True
        # 20:00Z rendered in New York time (EST, UTC-5)
        assert "3:00 PM" in result["confirmation"]

    @pytest.mark.asyncio
    async def test_book_appointment_requires_valid_email(self):
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import BookAppointmentArgs

        db_mock = MagicMock(spec=DatabaseService)
        executor = ToolExecutor(db_mock)
        executor.calendly.get_access = AsyncMock(
            return_value=("token", {"event_type_uri": "https://api.calendly.com/event_types/x"})
        )

        args = BookAppointmentArgs(
            customer_name="Ada", customer_email="not-an-email", requested_time="2099-01-15T15:00:00"
        )
        result = await executor.book_appointment(
            args, org_id=uuid4(), conversation_id=None, tz_name="UTC"
        )

        assert "valid email" in result["confirmation"]

    @pytest.mark.asyncio
    async def test_book_appointment_rejects_slot_that_is_gone(self):
        """The slot may have been taken since check_availability ran, so the
        booking path must re-check instead of trusting the model."""
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import BookAppointmentArgs

        db_mock = MagicMock(spec=DatabaseService)
        executor = ToolExecutor(db_mock)
        executor.calendly.get_access = AsyncMock(
            return_value=("token", {"event_type_uri": "https://api.calendly.com/event_types/x"})
        )
        executor.calendly.get_available_times = AsyncMock(return_value=[])
        executor.calendly.create_invitee = AsyncMock()

        args = BookAppointmentArgs(
            customer_name="Ada",
            customer_email="ada@example.com",
            requested_time="2099-01-15T15:00:00",
        )
        result = await executor.book_appointment(
            args, org_id=uuid4(), conversation_id=None, tz_name="UTC"
        )

        assert "isn't available anymore" in result["confirmation"]
        executor.calendly.create_invitee.assert_not_called()

    @pytest.mark.asyncio
    async def test_book_appointment_books_and_confirms(self):
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import BookAppointmentArgs

        db_mock = MagicMock(spec=DatabaseService)
        db_mock.add_message = AsyncMock(return_value=None)
        executor = ToolExecutor(db_mock)
        executor.calendly.get_access = AsyncMock(
            return_value=("token", {"event_type_uri": "https://api.calendly.com/event_types/x"})
        )
        executor.calendly.get_available_times = AsyncMock(
            return_value=[{"status": "available", "start_time": "2099-01-15T15:00:00Z"}]
        )
        executor.calendly.create_invitee = AsyncMock(return_value={"resource": {"uri": "x"}})

        args = BookAppointmentArgs(
            customer_name="Ada",
            customer_email="ada@example.com",
            requested_time="2099-01-15T15:00:00Z",
        )
        result = await executor.book_appointment(
            args, org_id=uuid4(), conversation_id=uuid4(), tz_name="UTC"
        )

        assert result["success"] is True
        assert "ada@example.com" in result["confirmation"]
        executor.calendly.create_invitee.assert_awaited_once()
    
    @pytest.mark.asyncio
    async def test_transfer_call(self):
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import TransferCallArgs
        
        db_mock = MagicMock(spec=DatabaseService)
        executor = ToolExecutor(db_mock)
        
        args = TransferCallArgs(phone_number="+15551234567", reason="Customer requested human")
        
        result = await executor.transfer_call(args, escalation_number="+15559876543")
        
        assert result["success"] is True
        assert result["transfer"]["phoneNumber"] == "+15551234567"
    
    @pytest.mark.asyncio
    async def test_transfer_call_uses_escalation_number(self):
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        from app.schemas.api import TransferCallArgs
        
        db_mock = MagicMock(spec=DatabaseService)
        executor = ToolExecutor(db_mock)
        
        args = TransferCallArgs(reason="Customer requested human")
        
        result = await executor.transfer_call(args, escalation_number="+15559876543")
        
        assert result["success"] is True
        assert result["transfer"]["phoneNumber"] == "+15559876543"


class TestModelRouting:
    def test_should_escalate_booking_keywords(self):
        from app.services.llm_service import LLMService
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        
        db_mock = MagicMock(spec=DatabaseService)
        tool_executor = ToolExecutor(db_mock)
        llm_service = LLMService(db_mock, tool_executor)
        
        functions_enabled = {"check_availability": True, "book_appointment": True}
        
        # Should escalate for booking keywords
        assert llm_service._should_escalate("I want to book an appointment", 1, functions_enabled) is True
        assert llm_service._should_escalate("Can I reschedule my booking?", 1, functions_enabled) is True
        assert llm_service._should_escalate("Cancel my appointment please", 1, functions_enabled) is True
    
    def test_should_escalate_long_conversation(self):
        from app.services.llm_service import LLMService
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        
        db_mock = MagicMock(spec=DatabaseService)
        tool_executor = ToolExecutor(db_mock)
        llm_service = LLMService(db_mock, tool_executor)
        
        functions_enabled = {"check_availability": True}
        
        # Should escalate after 6 turns
        assert llm_service._should_escalate("Hello", 6, functions_enabled) is True
        assert llm_service._should_escalate("Hello", 5, functions_enabled) is False
    
    def test_should_escalate_long_message(self):
        from app.services.llm_service import LLMService
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService
        
        db_mock = MagicMock(spec=DatabaseService)
        tool_executor = ToolExecutor(db_mock)
        llm_service = LLMService(db_mock, tool_executor)
        
        functions_enabled = {"check_availability": True}
        long_message = "x" * 600  # Longer than 500 threshold
        
        assert llm_service._should_escalate(long_message, 1, functions_enabled) is True
        assert llm_service._should_escalate("short message", 1, functions_enabled) is False

    def test_resolve_model_stays_within_provider_family(self):
        """Escalating an Anthropic-configured org must never hand an OpenAI
        model name to the Anthropic API (and vice versa) - that's a
        guaranteed request failure, not a graceful degradation."""
        from app.services.llm_service import LLMService
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService

        db_mock = MagicMock(spec=DatabaseService)
        llm_service = LLMService(db_mock, ToolExecutor(db_mock))

        assert llm_service._resolve_model("openai", "gpt-4o-mini", None, False) == "gpt-4o-mini"
        assert llm_service._resolve_model("openai", "gpt-4o-mini", None, True) == "gpt-4o"
        assert llm_service._resolve_model("anthropic", "claude-3-haiku", None, True) == "claude-3-5-sonnet-20241022"
        # An explicit override always wins over the provider default.
        assert llm_service._resolve_model("anthropic", "claude-3-haiku", "claude-3-opus", True) == "claude-3-opus"


class TestStreamingToolCallAccumulation:
    """OpenAI streams tool-call arguments as incremental string fragments
    across many deltas, and Anthropic streams tool inputs the same way as
    partial JSON per content block - in both cases, the fragments are not
    valid JSON until concatenated. These tests simulate that fragmentation
    end to end and assert a single, fully-formed tool call comes out, since
    parsing each fragment independently is exactly the bug that shipped."""

    @pytest.mark.asyncio
    async def test_openai_stream_accumulates_fragmented_arguments(self):
        from types import SimpleNamespace
        from app.services.llm_service import LLMService
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService

        def delta(content=None, tool_calls=None):
            return SimpleNamespace(content=content, tool_calls=tool_calls)

        def tool_call_delta(index, id=None, name=None, arguments=None):
            return SimpleNamespace(
                index=index,
                id=id,
                function=SimpleNamespace(name=name, arguments=arguments),
            )

        chunks = [
            SimpleNamespace(choices=[SimpleNamespace(delta=delta(content="Sure, "))]),
            SimpleNamespace(choices=[SimpleNamespace(delta=delta(
                tool_calls=[tool_call_delta(0, id="call_1", name="check_availability", arguments="")]
            ))]),
            SimpleNamespace(choices=[SimpleNamespace(delta=delta(
                tool_calls=[tool_call_delta(0, arguments='{"da')]
            ))]),
            SimpleNamespace(choices=[SimpleNamespace(delta=delta(
                tool_calls=[tool_call_delta(0, arguments='te": "2026-09-10"}')]
            ))]),
        ]

        async def fake_stream(*args, **kwargs):
            for c in chunks:
                yield c

        db_mock = MagicMock(spec=DatabaseService)
        llm_service = LLMService(db_mock, ToolExecutor(db_mock))
        llm_service.openai_client.chat.completions.create = AsyncMock(return_value=fake_stream())

        events = [event async for event in llm_service._stream_openai_response(
            model="gpt-4o-mini", messages=[], tools=[], temperature=0.5
        )]

        text_events = [e for e in events if e[0] == "text"]
        tool_events = [e for e in events if e[0] == "tool_call"]

        assert "".join(t for _, t in text_events) == "Sure, "
        assert len(tool_events) == 1
        _, tool_call = tool_events[0]
        assert tool_call["name"] == "check_availability"
        # This is the crux of the bug: only the fully concatenated string is
        # valid JSON. Parsing any single fragment on its own raises.
        assert json.loads(tool_call["arguments"]) == {"date": "2026-09-10"}

    @pytest.mark.asyncio
    async def test_anthropic_stream_accumulates_fragmented_input(self):
        from types import SimpleNamespace
        from app.services.llm_service import LLMService
        from app.tools.executor import ToolExecutor
        from app.services.database_service import DatabaseService

        chunks = [
            SimpleNamespace(
                type="content_block_start",
                index=0,
                content_block=SimpleNamespace(type="tool_use", id="toolu_1", name="take_message"),
            ),
            SimpleNamespace(
                type="content_block_delta",
                index=0,
                delta=SimpleNamespace(type="input_json_delta", partial_json='{"summ'),
            ),
            SimpleNamespace(
                type="content_block_delta",
                index=0,
                delta=SimpleNamespace(type="input_json_delta", partial_json='ary": "call back"}'),
            ),
            SimpleNamespace(type="content_block_stop", index=0),
        ]

        async def fake_stream(*args, **kwargs):
            for c in chunks:
                yield c

        db_mock = MagicMock(spec=DatabaseService)
        llm_service = LLMService(db_mock, ToolExecutor(db_mock))
        llm_service.anthropic_client = MagicMock()
        llm_service.anthropic_client.messages.create = AsyncMock(return_value=fake_stream())

        events = [event async for event in llm_service._stream_anthropic_response(
            model="claude-3-5-sonnet-20241022", messages=[], tools=[], temperature=0.5
        )]

        tool_events = [e for e in events if e[0] == "tool_call"]
        assert len(tool_events) == 1
        _, tool_call = tool_events[0]
        assert tool_call["name"] == "take_message"
        assert json.loads(tool_call["arguments"]) == {"summary": "call back"}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
