import uuid
from datetime import datetime, timedelta

from backend.core.database import db_session


class InventoryManager:
    def __init__(self, merchant_id: str, offer_expiry_minutes: int = 10):
        self.merchant_id = merchant_id
        self.expiry_minutes = offer_expiry_minutes

    def held_qty(self, item_id: str) -> int:
        with db_session() as conn:
            row = conn.execute(
                """
                SELECT COALESCE(SUM(quantity), 0) s FROM inventory_reservations
                WHERE merchant_id = ? AND item_id = ? AND status = 'HELD'
                """,
                (self.merchant_id, item_id),
            ).fetchone()
            return row["s"]

    def available_stock(self, item_id: str, base_stock: int) -> int:
        """Base configured stock minus reservations held by other sessions."""
        return base_stock - self.held_qty(item_id)

    def reserve(self, item_id: str, quantity: int, session_id: str, ttl_minutes=None) -> str:
        ttl = ttl_minutes or self.expiry_minutes
        reservation_id = uuid.uuid4().hex
        expires_at = (datetime.utcnow() + timedelta(minutes=ttl)).isoformat()
        with db_session() as conn:
            conn.execute(
                """
                INSERT INTO inventory_reservations
                    (id, merchant_id, item_id, quantity, session_id, status, expires_at)
                VALUES (?, ?, ?, ?, ?, 'HELD', ?)
                """,
                (reservation_id, self.merchant_id, item_id, quantity, session_id, expires_at),
            )
        return reservation_id

    def release(self, session_id: str):
        with db_session() as conn:
            conn.execute(
                """
                UPDATE inventory_reservations SET status = 'RELEASED'
                WHERE session_id = ? AND status = 'HELD'
                """,
                (session_id,),
            )

    def consume(self, session_id: str):
        with db_session() as conn:
            conn.execute(
                """
                UPDATE inventory_reservations SET status = 'CONSUMED'
                WHERE session_id = ? AND status = 'HELD'
                """,
                (session_id,),
            )
