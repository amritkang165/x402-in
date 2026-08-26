from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PROTOCOL_NAME = "x402-in"
PROTOCOL_VERSION = "0.1.0"


class ProtocolMessage(BaseModel):
    protocol: Literal["x402-in"] = "x402-in"
    version: str = PROTOCOL_VERSION
    message_id: str
    session_id: str
    sender: str
    recipient: str
    type: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: dict


def wrap(
    session_id: str,
    sender: str,
    recipient: str,
    type: str,
    payload: dict,
    message_id: str | None = None,
) -> ProtocolMessage:
    return ProtocolMessage(
        message_id=message_id or f"{sender}-{datetime.utcnow().timestamp()}",
        session_id=session_id,
        sender=sender,
        recipient=recipient,
        type=type,
        payload=payload,
    )
