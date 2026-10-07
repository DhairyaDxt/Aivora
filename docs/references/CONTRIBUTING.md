# 🤝 Contributing to Aivora

Welcome! This guide will help you contribute to Aivora in a structured and professional way.

---

## 📋 Before You Start

### Read the Documentation
- [`docs/quickstart/GETTING_STARTED.md`](../quickstart/GETTING_STARTED.md) - Project overview
- [`README.md`](../../README.md) - Architecture & design
- [`docs/references/FOLDER_STRUCTURE.md`](FOLDER_STRUCTURE.md) - Project organization
- [`docs/references/QUICK_COMMANDS.md`](QUICK_COMMANDS.md) - Development commands

### Setup Development Environment
```bash
# Follow docs/quickstart/LOCAL_RUN.md
# Get Aivora running locally first
```

---

## 🏗️ Project Structure

```
aivora-rag-service/
├── app/
│   ├── api/                    # HTTP routes
│   ├── services/               # Business logic ⭐
│   │   ├── orchestration_service.py    # LangGraph state machine
│   │   ├── intent_classifier.py        # NLP models
│   │   ├── llm_service.py
│   │   ├── kb_service.py
│   │   └── ...
│   ├── tools/                  # Tool execution
│   ├── prompts/                # Prompt templates
│   ├── models/                 # Data models
│   └── ...
├── tests/
│   └── test_orchestration.py   # ⭐ LangGraph tests
└── ...
```

---

## 🐛 Types of Contributions

### Bug Fixes
- [ ] Create issue describing the bug
- [ ] Create branch: `bugfix/issue-title`
- [ ] Write test that reproduces bug
- [ ] Fix the bug
- [ ] Ensure all tests pass
- [ ] Submit PR with description

### Features
- [ ] Create issue describing feature
- [ ] Create branch: `feature/feature-name`
- [ ] Implement feature
- [ ] Write tests for feature
- [ ] Update documentation
- [ ] Submit PR

### Documentation
- [ ] Create branch: `docs/doc-name`
- [ ] Write or update documentation
- [ ] Check formatting and links
- [ ] Submit PR

### Tests
- [ ] Create branch: `test/test-name`
- [ ] Add comprehensive tests
- [ ] Ensure high coverage
- [ ] Submit PR

---

## 🔄 Development Workflow

### 1. Create Branch
```bash
git checkout -b feature/your-feature-name

# Naming conventions:
# feature/feature-name          # New feature
# bugfix/issue-title            # Bug fix
# enhancement/enhancement-name   # Enhancement
# docs/documentation-title       # Documentation
# test/test-description         # Tests
```

### 2. Make Changes

**For Backend Code:**
```bash
cd aivora-rag-service

# Edit files in app/services/ or app/api/

# Test your changes
pytest tests/test_orchestration.py -v

# Run linter (if configured)
# Check formatting
```

**For Frontend Code:**
```bash
cd Frontend

# Edit files in src/

# Check for errors
npm run lint

# Build to check for errors
npm run build
```

### 3. Commit Changes
```bash
# Commit with descriptive message
git add .
git commit -m "feat: Add intent classification for booking"

# Commit message format:
# feat: New feature
# fix: Bug fix
# docs: Documentation update
# test: Test additions
# refactor: Code refactoring
# style: Code style changes
# perf: Performance improvements
```

### 4. Push & Create PR
```bash
git push origin feature/your-feature-name

# Create pull request on GitHub
# Fill in description:
# - What changed
# - Why it changed
# - How to test
# - Any breaking changes
```

---

## ✅ Code Standards

### Python (Backend)

**Style:**
```python
# Use PEP 8 style
# 4-space indentation
# Clear variable names
# Type hints where helpful

from typing import Optional, List
from uuid import UUID

def process_message(
    message: str,
    org_id: UUID,
    metadata: Optional[dict] = None
) -> dict:
    """
    Process customer message through orchestration.
    
    Args:
        message: Customer message text
        org_id: Organization ID
        metadata: Additional metadata
        
    Returns:
        Response dict with intent, sentiment, response
    """
    pass
```

**Logging:**
```python
import logging

logger = logging.getLogger(__name__)

logger.info("Processing message for org: %s", org_id)
logger.warning("Sentiment negative, escalating")
logger.error("Failed to process message: %s", error)
```

**Error Handling:**
```python
try:
    result = process_something()
except SpecificException as e:
    logger.error("Specific error: %s", e)
    # Handle gracefully
except Exception as e:
    logger.error("Unexpected error: %s", e)
    raise
```

### TypeScript/React (Frontend)

**Style:**
```typescript
// Use TypeScript for type safety
// Clear naming conventions
// Props interfaces

interface MessageProps {
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export function MessageComponent({ content, sender, timestamp }: MessageProps) {
  return (
    <div className="message">
      {content}
    </div>
  );
}
```

### Documentation

**Docstrings (Python):**
```python
def classify_intent(message: str) -> dict:
    """
    Classify customer message intent.
    
    Uses zero-shot classification to detect:
    - booking: Customer wants to schedule
    - info: Customer asking for information
    - complaint: Customer expressing dissatisfaction
    - escalate: Customer needs human help
    
    Args:
        message: Customer message text
        
    Returns:
        Dictionary with:
        - intent: Detected intent category
        - confidence: Confidence score (0.0-1.0)
        - sentiment: POSITIVE/NEGATIVE/NEUTRAL
    """
```

**Comments:**
```python
# Use comments to explain WHY, not WHAT
# Code should be clear enough to explain what it does

# WHY: Escalate immediately if multiple urgency keywords found
# GOOD: Makes urgent customers feel heard
if urgent_count > 2:
    escalate()

# BAD: Just restates what code does
# Set escalate to True
escalate = True
```

---

## 🧪 Testing

### Write Tests for New Features
```python
import pytest

class TestIntentClassification:
    @pytest.mark.asyncio
    async def test_classify_booking_intent(self):
        """Test booking intent is correctly classified"""
        classifier = IntentClassifier()
        message = "I want to book an appointment"
        
        result = await classifier.classify_intent(message)
        
        assert result["primary_intent"] == "booking an appointment"
        assert result["confidence"] > 0.7
```

### Test Coverage
- [ ] Unit tests for individual functions
- [ ] Integration tests for services
- [ ] End-to-end tests for flows
- [ ] Error handling tests

### Run Tests Before Submitting
```bash
cd aivora-rag-service
pytest tests/ -v --cov=app

# Should see: X passed, Y skipped
# No failures!
```

---

## 📝 Commit Message Guidelines

### Format
```
type(scope): subject

body (optional)

footer (optional)
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation
- **test**: Test addition/modification
- **refactor**: Code refactoring
- **perf**: Performance improvement
- **style**: Code style

### Examples
```
feat(orchestration): Add sentiment escalation logic
fix(intent-classifier): Handle None values in entity extraction
docs(readme): Update LangGraph integration section
test(orchestration): Add negative sentiment escalation tests
refactor(llm-service): Simplify prompt building
```

---

## 🔍 Code Review Checklist

Before submitting a PR, ensure:

### Functionality
- [ ] Feature/fix works as intended
- [ ] No breaking changes (or documented)
- [ ] Handles edge cases
- [ ] Error handling present

### Code Quality
- [ ] Code follows project style
- [ ] No unused imports
- [ ] Clear variable names
- [ ] DRY (Don't Repeat Yourself)

### Testing
- [ ] Tests written and passing
- [ ] Edge cases covered
- [ ] Error cases handled
- [ ] Good test coverage

### Documentation
- [ ] Docstrings added
- [ ] Comments explain WHY
- [ ] README updated if needed
- [ ] API docs updated if needed

### Performance
- [ ] No performance regressions
- [ ] Efficient algorithms used
- [ ] No unnecessary loops/queries

---

## 🚀 Adding New Features

### Example: Add New Intent Type

1. **Update Intent Classifier**
```python
# app/services/intent_classifier.py

intent_labels = [
    "booking an appointment",  # existing
    "asking for information",   # existing
    "new_intent_type",         # ADD THIS
]
```

2. **Write Tests**
```python
# tests/test_orchestration.py

async def test_classify_new_intent(self):
    classifier = IntentClassifier()
    result = await classifier.classify_intent("customer message for new intent")
    assert result["primary_intent"] == "new_intent_type"
```

3. **Add Handler in Orchestrator**
```python
# app/services/orchestration_service.py

workflow.add_conditional_edges(
    "classify_intent",
    self._route_after_classify,
    {
        "new_intent_type": "handle_new_intent",  # ADD THIS
        # ... other routes
    }
)

async def _handle_new_intent(self, state: ConversationState):
    """Handle new intent type"""
    # implementation
```

4. **Update Documentation**
- Add to docs/guides/README_LANGGRAPH.md
- Update docs/references/QUICK_COMMANDS.md if needed
- Add comment to code

5. **Create PR**
- Include tests
- Include documentation updates
- Clear description of changes

---

## 📚 Adding New Endpoints

### Example: Add New API Endpoint

1. **Create Route**
```python
# app/api/routes.py

@router.post("/v1/new-endpoint")
async def new_endpoint(
    request: NewRequest,
    auth_verified: None = Depends(verify_orchestration_auth),
    db_service: DatabaseService = Depends(get_db_service)
):
    """
    New endpoint description.
    """
    try:
        result = await db_service.process_something()
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Error in new_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

2. **Create Schema**
```python
# app/schemas/api.py

class NewRequest(BaseModel):
    param1: str
    param2: Optional[int] = None
    
class NewResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
```

3. **Add Tests**
```python
# tests/test_service.py

def test_new_endpoint():
    response = client.post(
        "/v1/new-endpoint",
        json={"param1": "value"},
        headers={"Authorization": f"Bearer {SHARED_SECRET}"}
    )
    assert response.status_code == 200
    assert response.json()["success"] is True
```

4. **Document**
- Update API docs
- Add curl example to docs/references/QUICK_COMMANDS.md

---

## 🔄 Pull Request Process

### Before Submitting
1. Sync with main branch
2. Run full test suite
3. Check documentation
4. Review code once more

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Related Issues
Closes #123

## How to Test
Steps to verify the changes work

## Breaking Changes
None / Describe any breaking changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Follows code style
- [ ] All tests passing
```

### After Submitting
- Respond to review comments promptly
- Make requested changes
- Push updates to same branch
- Request re-review when ready

---

## 🎯 Priority Areas for Contributions

### High Priority
- Bug fixes (always welcome)
- Performance improvements
- Missing tests
- Documentation gaps

### Medium Priority
- New LangGraph nodes
- Additional intent types
- New tool types
- Enhanced error handling

### Nice to Have
- UI/UX improvements
- Documentation enhancements
- Code refactoring
- Developer experience improvements

---

## 🛠️ Development Tools

### Recommended Extensions (VS Code)
```json
{
  "python.defaultInterpreterPath": "./venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "[python]": {
    "editor.defaultFormatter": "ms-python.python",
    "editor.formatOnSave": true
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  }
}
```

### Useful Commands
```bash
# Format code
black aivora-rag-service/

# Lint
pylint aivora-rag-service/

# Type check
mypy aivora-rag-service/

# Test coverage
pytest --cov=app tests/
```

---

## 📞 Questions?

### Resources
- [`docs/INDEX.md`](../INDEX.md) - Documentation hub
- [`docs/references/QUICK_COMMANDS.md`](QUICK_COMMANDS.md) - Command reference
- [`docs/references/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) - Common issues

### Communication
- Check existing issues first
- Create new issue with detailed description
- Tag with appropriate labels

---

## ✨ Recognition

Contributors are recognized in:
- Commit history
- Pull request history
- Project documentation (coming soon)

Thank you for contributing! 🙏

---

**Last Updated:** October 2026
**Status:** Active & Welcoming
