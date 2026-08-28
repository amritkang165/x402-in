import json
import uuid
from datetime import datetime

from backend.core.database import db_session


class OfferService:
    def create(
        self,
        session_id: str,
        merchant_id: str,
        buyer_id: str,
        items: list[dict],
        pricing: dict,
        ttl_minutes: int = 10,
    ) -> dict:
        offer_id = uuid.uuid4().hex
        created_at = datetime.utcnow().isoformat()
        from datetime import timedelta
        expires_at = (datetime.utcnow() + timedelta(minutes=ttl_minutes)).isoformat()
        with db_session() as conn:
            conn.execute(
                """
                INSERT INTO offers
                    (id, session_id, merchant_id, buyer_id, items, pricing,
                     status, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
                """,
                (
                    offer_id, session_id, merchant_id, buyer_id,
                    json.dumps(items), json.dumps(pricing),
                    created_at, expires_at,
                ),
            )
        return {
            "id": offer_id, "session_id": session_id, "merchant_id": merchant_id,
            "buyer_id": buyer_id, "items": items, "pricing": pricing,
            "status": "PENDING", "created_at": created_at, "expires_at": expires_at,
        }

    def get(self, offer_id: str) -> dict | None:
        with db_session() as conn:
            row = conn.execute(
                "SELECT * FROM offers WHERE id = ?", (offer_id,)
            ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["items"] = json.loads(d["items"])
        d["pricing"] = json.loads(d["pricing"])
        return d

    def set_status(self, offer_id: str, status: str):
        with db_session() as conn:
            conn.execute(
                "UPDATE offers SET status = ? WHERE id = ?", (status, offer_id)
            )

    def get_by_session(self, session_id: str) -> list[dict]:
        with db_session() as conn:
            rows = conn.execute(
                "SELECT * FROM offers WHERE session_id = ? ORDER BY created_at", (session_id,)
            ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["items"] = json.loads(d["items"])
            d["pricing"] = json.loads(d["pricing"])
            result.append(d)
        return result


offer_service = OfferService()
