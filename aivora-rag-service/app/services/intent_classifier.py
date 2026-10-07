"""
Intent Classification Service using zero-shot classification and NLP

This service classifies customer messages into intents and extracts entities.
Uses HuggingFace transformers for efficient, on-device NLP.
"""

import logging
from typing import Dict, List, Tuple
from transformers import pipeline
import json

logger = logging.getLogger(__name__)


class IntentClassifier:
    """
    Multi-level intent classification with entity extraction
    """
    
    def __init__(self):
        # Zero-shot classification for flexible intent detection
        self.classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli"
        )
        
        # Sentiment analysis for detecting frustration/urgency
        self.sentiment_analyzer = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english"
        )
    
    async def classify_intent(self, message: str) -> Dict:
        """
        Classify message intent with confidence scores
        
        Returns: {
            "primary_intent": str,
            "confidence": float,
            "all_intents": [{"label": str, "score": float}, ...],
            "sentiment": str,
            "sentiment_score": float,
            "requires_urgency_escalation": bool
        }
        """
        
        intent_labels = [
            "booking an appointment",
            "asking for information",
            "cancelling an appointment",
            "rescheduling an appointment",
            "making a complaint",
            "requesting a callback",
            "urgent help needed",
            "small talk"
        ]
        
        try:
            # Zero-shot classification
            result = self.classifier(
                message,
                intent_labels,
                multi_class=False
            )
            
            # Sentiment analysis
            sentiment_result = self.sentiment_analyzer(message)[0]
            
            # Check for urgency indicators
            urgency_keywords = [
                "urgent", "asap", "emergency", "immediately",
                "critical", "now", "help", "problem", "error",
                "angry", "frustrated", "furious", "terrible"
            ]
            message_lower = message.lower()
            has_urgency = any(keyword in message_lower for keyword in urgency_keywords)
            
            # If sentiment is negative + urgency keywords, escalate
            should_escalate = (
                sentiment_result["label"] == "NEGATIVE" and has_urgency
            )
            
            return {
                "primary_intent": result["labels"][0],
                "confidence": float(result["scores"][0]),
                "all_intents": [
                    {"label": label, "score": float(score)}
                    for label, score in zip(result["labels"], result["scores"])
                ],
                "sentiment": sentiment_result["label"],
                "sentiment_score": float(sentiment_result["score"]),
                "requires_urgency_escalation": should_escalate,
                "urgency_indicators_found": has_urgency
            }
            
        except Exception as e:
            logger.error(f"Error in intent classification: {e}")
            return {
                "primary_intent": "unknown",
                "confidence": 0.0,
                "all_intents": [],
                "sentiment": "NEUTRAL",
                "sentiment_score": 0.0,
                "requires_urgency_escalation": False,
                "urgency_indicators_found": False,
                "error": str(e)
            }
    
    async def extract_entities(self, message: str) -> Dict:
        """
        Extract useful entities from message:
        dates, times, services, phone numbers, emails
        
        Returns: {
            "dates": [str],
            "times": [str],
            "services": [str],
            "contact_info": [str]
        }
        """
        import re
        from datetime import datetime, timedelta
        
        entities = {
            "dates": [],
            "times": [],
            "services": [],
            "contact_info": [],
            "names": []
        }
        
        # Email pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, message)
        entities["contact_info"].extend(emails)
        
        # Phone pattern (basic US format)
        phone_pattern = r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b'
        phones = re.findall(phone_pattern, message)
        entities["contact_info"].extend(phones)
        
        # Common service types
        service_keywords = {
            "haircut": ["haircut", "hair cut", "trim", "styling"],
            "massage": ["massage", "spa", "therapeutic"],
            "consultation": ["consult", "consultation", "appointment"],
            "cleaning": ["clean", "cleaning", "cleaning service"],
            "repair": ["repair", "fix", "service"],
            "dental": ["dentist", "dental", "teeth cleaning"],
            "medical": ["doctor", "appointment", "checkup"]
        }
        
        message_lower = message.lower()
        for service_type, keywords in service_keywords.items():
            if any(kw in message_lower for kw in keywords):
                if service_type not in entities["services"]:
                    entities["services"].append(service_type)
        
        # Time expressions (simplified)
        time_keywords = {
            "today": "today",
            "tomorrow": "tomorrow",
            "this week": "this week",
            "next week": "next week",
            "this month": "this month",
            "asap": "asap",
            "morning": "morning",
            "afternoon": "afternoon",
            "evening": "evening"
        }
        
        for keyword, time_expr in time_keywords.items():
            if keyword in message_lower:
                entities["times"].append(time_expr)
        
        return entities
    
    async def detect_sentiment_trend(self, messages: List[str]) -> Dict:
        """
        Analyze sentiment trend across multiple messages
        Returns escalation signal if trend is negative
        """
        if not messages:
            return {
                "trend": "neutral",
                "overall_sentiment": "NEUTRAL",
                "messages_analyzed": 0,
                "escalation_score": 0.0
            }
        
        sentiments = []
        for msg in messages:
            result = self.sentiment_analyzer(msg[:512])[0]  # Truncate to avoid length issues
            sentiments.append(result["label"])
        
        negative_count = sentiments.count("NEGATIVE")
        positive_count = sentiments.count("POSITIVE")
        
        # Escalation score: if >50% of messages are negative
        escalation_score = negative_count / len(sentiments) if sentiments else 0.0
        
        trend = "improving" if positive_count > negative_count else "declining"
        if positive_count == negative_count:
            trend = "mixed"
        
        overall = "NEGATIVE" if escalation_score > 0.5 else "POSITIVE" if positive_count > negative_count else "NEUTRAL"
        
        return {
            "trend": trend,
            "overall_sentiment": overall,
            "negative_percentage": negative_count / len(sentiments) * 100 if sentiments else 0,
            "messages_analyzed": len(sentiments),
            "escalation_score": escalation_score,
            "should_escalate": escalation_score > 0.5
        }
