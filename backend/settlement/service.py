from datetime import datetime

from backend.core.audit import audit
from backend.core.database import db_session
from backend.core.models import SettlementRequest, SettlementResponse
from backend.offers.service import offer_service
from backend.settlement.razorpay_client import create_payment_link
from backend.theatre.websocket_manager import broadcast_event


class SettlementService:
    def initiate(self, request: SettlementRequest) -> dict:
        offer = offer_service.get(request.offer_id)
        if not offer:
            return SettlementResponse(
                status="OFFER_NOT_FOUND", amount_paise=0
            ).model_dump()

        if offer["session_id"] != request.session_id:
            self._fail(request, "Offer does not belong to session")
            return SettlementResponse(
                status="FAILED", amount_paise=0, audit_hash=None
            ).model_dump()

        if offer["buyer_id"] != request.buyer_id:
            self._fail(request, "Offer does not belong to buyer")
            return SettlementResponse(status="FAILED", amount_paise=0).model_dump()

        now = datetime.utcnow()
        expires_at = datetime.fromisoformat(offer["expires_at"])
        if now > expires_at:
            offer_service.set_status(offer["id"], "EXPIRED")
            return SettlementResponse(
                status="OFFER_EXPIRED", amount_paise=offer["pricing"]["total_paise"], expires_at=offer["expires_at"]
            ).model_dump()

        if offer["status"] in ("SETTLED", "SETTLEMENT_INITIATED"):
            return SettlementResponse(status="FAILED", amount_paise=0).model_dump()

        amount_paise = offer["pricing"]["total_paise"]
        idempotency_key = f"{request.session_id}:{request.offer_id}"

        link = create_payment_link(
            amount_paise=amount_paise,
            description=f"Payment for session {request.session_id}",
            customer_email=request.buyer_email,
            idempotency_key=idempotency_key,
        )

        with db_session() as conn:
            conn.execute(
                """
                UPDATE sessions SET status='SETTLEMENT_INITIATED',
                    razorpay_order_id=?, razorpay_payment_link_id=?,
                    final_amount_paise=?
                WHERE id=?
                """,
                (link["order_id"], link["id"], amount_paise, request.session_id),
            )
        offer_service.set_status(offer["id"], "SETTLEMENT_INITIATED")

        entry = audit.log(
            request.session_id,
            "SETTLEMENT_INITIATED",
            "system",
            {
                "offer_id": offer["id"],
                "amount_paise": amount_paise,
                "razorpay_order_id": link["order_id"],
                "razorpay_payment_link_id": link["id"],
            },
        )

        broadcast_event(
            request.session_id, "system", "SETTLEMENT_INITIATED",
            {"offer_id": offer["id"], "amount_paise": amount_paise,
             "payment_link": link["short_url"]},
        )

        return SettlementResponse(
            merchant_id=offer["merchant_id"],
            status="SETTLEMENT_INITIATED",
            razorpay_order_id=link["order_id"],
            payment_link=link["short_url"],
            amount_paise=amount_paise,
            currency="INR",
            expires_at=offer["expires_at"],
            audit_hash=entry["current_hash"],
        ).model_dump()

    def _fail(self, request: SettlementRequest, reason: str):
        audit.log(request.session_id, "SETTLEMENT_FAILED", "system", {"reason": reason})


settlement_service = SettlementService()
