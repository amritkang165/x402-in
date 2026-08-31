from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from backend.core.audit import audit
from backend.core.database import db_session
from backend.theatre.websocket_manager import broadcast_event
from backend.config import settings
from backend.settlement.razorpay_client import (
    extract_link_refs,
    extract_payment_event,
    verify_webhook_signature,
)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _process_event(session_id: str, event_type: str, payment_status: str):
    with db_session() as conn:
        session = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if payment_status == "captured":
            conn.execute(
                "UPDATE sessions SET status='PAID', settled_at=? WHERE id=?",
                (datetime.utcnow().isoformat(), session_id),
            )
        else:
            conn.execute(
                "UPDATE sessions SET status='PAYMENT_FAILED' WHERE id=?",
                (session_id,),
            )

    if payment_status == "captured":
        audit.log(session_id, "PAYMENT_CAPTURED", "razorpay",
                  {"payment_status": payment_status})
        broadcast_event(session_id, "razorpay", "PAYMENT_CAPTURED",
                        {"payment_status": payment_status, "amount_paise": session["final_amount_paise"]})
    else:
        audit.log(session_id, "PAYMENT_FAILED", "razorpay",
                  {"payment_status": payment_status})
        broadcast_event(session_id, "razorpay", "PAYMENT_FAILED",
                        {"payment_status": payment_status})


@router.post("/razorpay")
async def razorpay_webhook(request: Request, x_razorpay_signature: str):
    if not settings.razorpay_enabled:
        raise HTTPException(status_code=400, detail="Razorpay is disabled in mock mode")
    body = await request.body()
    if not verify_webhook_signature(body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    payload = await request.json()
    event_id = payload.get("id")
    event_type = payload.get("event")
    payment_status = extract_payment_event(payload)
    refs = extract_link_refs(payload)

    with db_session() as conn:
        dup = conn.execute(
            "SELECT 1 FROM processed_webhooks WHERE event_id=?", (event_id,)
        ).fetchone()
        if dup:
            return {"status": "already_processed"}
        conn.execute(
            "INSERT INTO processed_webhooks (event_id) VALUES (?)", (event_id,)
        )

    with db_session() as conn:
        session = None
        if refs["order_id"]:
            session = conn.execute(
                "SELECT * FROM sessions WHERE razorpay_order_id=?", (refs["order_id"],)
            ).fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    _process_event(session["id"], event_type, payment_status)
    return {"status": "processed"}


@router.post("/mock/notify")
async def mock_notify(request: Request):
    """Mock endpoint to simulate a Razorpay webhook in mock mode."""
    payload = await request.json()
    session_id = payload.get("session_id")
    payment_status = payload.get("payment_status", "captured")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    _process_event(session_id, "mock", payment_status)
    return {"status": "processed"}
