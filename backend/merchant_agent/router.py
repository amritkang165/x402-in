import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.models import NegotiateRequest, NegotiateResponse
from backend.merchant_agent.agent import MerchantAgent
from backend.merchant_agent.inventory import InventoryManager


class MerchantAPIModels(BaseModel):
    pass


def build_merchant_router(
    agent: MerchantAgent,
    inventory: InventoryManager,
    offer_expiry_minutes: int = 10,
) -> APIRouter:
    router = APIRouter(prefix="/acp", tags=["merchant"])

    @router.get("/catalog", response_model=None)
    def get_catalog():
        return agent.catalog().model_dump()

    @router.post("/negotiate", response_model=NegotiateResponse)
    def negotiate(req: NegotiateRequest):
        base_stock = {i.id: i.stock for i in agent.items.values()}
        for item in req.intent.items_requested:
            if item.item_id not in base_stock:
                continue  # let the agent's availability logic produce a clean REJECT
            available = inventory.available_stock(item.item_id, base_stock[item.item_id])
            if item.quantity > available:
                raise HTTPException(
                    status_code=503,
                    detail=f"Item {item.item_id} has only {available} available",
                )

        result = agent.negotiate(req)
        result_dict = result.model_dump()

        if result_dict["status"] in ("OFFER", "COUNTER"):
            offer_id = uuid.uuid4().hex
            expires_at = datetime.utcnow() + timedelta(minutes=offer_expiry_minutes)
            for item in req.intent.items_requested:
                inventory.reserve(item.item_id, item.quantity, req.session_id)
            result_dict["offer_id"] = offer_id
            result_dict["expires_at"] = expires_at.isoformat()

        return result_dict

    @router.post("/settle")
    def settle(payload: dict):
        # Merchant acknowledges an offer; real settlement handled centrally.
        offer_id = payload.get("offer_id")
        session_id = payload.get("session_id")
        if not offer_id or not session_id:
            raise HTTPException(status_code=400, detail="offer_id and session_id required")
        return {
            "merchant_id": agent.id,
            "status": "ACKNOWLEDGED",
            "session_id": session_id,
            "offer_id": offer_id,
        }

    return router
