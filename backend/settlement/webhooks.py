from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from backend.core.audit import audit
from backend.core.database import db_session

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
    else:
        audit.log(session_id, "PAYMENT_FAILED", "razorpay",
                  {"payment_status": payment_status})


@router.post("/mock/notify")
async def mock_notify(request: Request):
    payload = await request.json()
    session_id = payload.get("session_id")
    payment_status = payload.get("payment_status", "captured")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    _process_event(session_id, "mock", payment_status)
    return {"status": "processed"}
