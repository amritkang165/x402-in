import asyncio
import hmac
import secrets
import uuid

from fastapi import APIRouter, HTTPException

from backend.buyer_agent.agent import get_agent
from backend.core.audit import audit
from backend.core.database import db_session
from backend.core.models import BuyerIntent, SettlementRequest
from backend.offers.service import offer_service
from backend.settlement.service import settlement_service

router = APIRouter(prefix="/buyer", tags=["buyer"])

_searches: dict[str, dict] = {}


class SearchBody(BuyerIntent):
    buyer_id: str = "priya_demo"


@router.post("/search")
async def search(body: SearchBody):
    session_id = uuid.uuid4().hex
    buyer_token = secrets.token_urlsafe(32)
    _searches[session_id] = {"status": "RUNNING", "result": None,
                             "buyer_token": buyer_token}
    agent = get_agent()

    async def run():
        try:
            result = await agent.find_best_deal(body.buyer_id, body, session_id)
            _searches[session_id]["result"] = result
            _searches[session_id]["status"] = "DONE"
        except Exception as e:
            _searches[session_id]["status"] = "ERROR"
            _searches[session_id]["result"] = {"status": "ERROR", "reasoning": str(e)}

    task = asyncio.create_task(run())
    _searches[session_id]["task"] = task
    return {"session_id": session_id, "status": "RUNNING", "buyer_token": buyer_token}


@router.get("/session/{session_id}")
def get_session(session_id: str):
    with db_session() as conn:
        session = conn.execute(
            "SELECT * FROM sessions WHERE id=?", (session_id,)
        ).fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    offers = offer_service.get_by_session(session_id)
    search = _searches.get(session_id)
    return {
        "session": dict(session),
        "offers": offers,
        "search_status": search["status"] if search else None,
        "result": search["result"] if search else None,
    }


@router.post("/approve/{session_id}")
def approve(session_id: str, body: dict):
    offer_id = body.get("offer_id")
    buyer_id = body.get("buyer_id", "priya_demo")
    buyer_email = body.get("buyer_email", "buyer@example.com")
    if not offer_id:
        raise HTTPException(status_code=400, detail="offer_id required")

    provided_token = body.get("buyer_token")
    search = _searches.get(session_id)
    expected = search.get("buyer_token") if search else None
    if not provided_token or not expected or not hmac.compare_digest(
        provided_token, expected
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired buyer_token (from the /buyer/search response)",
        )

    req = SettlementRequest(
        session_id=session_id,
        offer_id=offer_id,
        buyer_id=buyer_id,
        buyer_email=buyer_email,
    )
    return settlement_service.initiate(req)


@router.get("/session/{session_id}/audit")
def get_audit(session_id: str):
    return audit.get_chain(session_id)


@router.get("/session/{session_id}/audit/verify")
def verify_audit(session_id: str):
    ok, message = audit.verify_chain(session_id)
    return {"verified": ok, "message": message}
