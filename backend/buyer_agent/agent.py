import asyncio
import uuid
from datetime import datetime

import httpx

from backend.core.audit import audit
from backend.core.database import db_session
from backend.core.models import (
    BuyerIntent,
    NegotiateRequest,
    NegotiateResponse,
    RequestedItem,
)
from backend.offers.service import offer_service
from backend.theatre.websocket_manager import broadcast_event


class BuyerAgent:
    def __init__(self, registry_url: str, offer_expiry_minutes: int = 10):
        self.registry_url = registry_url
        self.offer_expiry_minutes = offer_expiry_minutes

    async def discover_merchants(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{self.registry_url}/list")
            resp.raise_for_status()
            return resp.json()

    async def negotiate_with_merchant(
        self,
        merchant: dict,
        session_id: str,
        buyer_id: str,
        intent: BuyerIntent,
    ) -> NegotiateResponse | dict:
        payload = NegotiateRequest(
            buyer_id=buyer_id,
            session_id=session_id,
            intent=intent,
            round=1,
        ).model_dump()
        url = merchant["endpoint_url"].rstrip("/") + "/acp/negotiate"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                data["merchant_id"] = merchant["id"]
                return data
        except httpx.TimeoutException:
            return {
                "merchant_id": merchant["id"],
                "status": "TIMEOUT",
                "reasoning": f"Merchant at {merchant['endpoint_url']} did not respond in time",
            }
        except httpx.HTTPStatusError as e:
            return {
                "merchant_id": merchant["id"],
                "status": "ERROR",
                "reasoning": f"Merchant returned {e.response.status_code}",
            }
        except Exception as e:
            return {
                "merchant_id": merchant["id"],
                "status": "ERROR",
                "reasoning": str(e),
            }

    async def find_best_deal(
        self, buyer_id: str, intent: BuyerIntent, session_id: str | None = None
    ) -> dict:
        merchants = await self.discover_merchants()
        if not merchants:
            return {
                "status": "NO_DEAL",
                "recommendation": "No merchants registered",
                "all_offers": [],
            }

        session_id = session_id or uuid.uuid4().hex
        with db_session() as conn:
            conn.execute(
                "INSERT INTO sessions (id, buyer_id, status) VALUES (?, ?, 'ACTIVE')",
                (session_id, buyer_id),
            )
        audit.log(session_id, "SESSION_STARTED", "buyer_agent",
                  {"buyer_id": buyer_id, "intent": intent.model_dump()})
        broadcast_event(session_id, "buyer_agent", "SESSION_STARTED",
                        {"buyer_id": buyer_id, "intent": intent.model_dump()})

        broadcast_event(session_id, "buyer_agent", "DISCOVERY",
                        {"merchants": [m["id"] for m in merchants]})
        await asyncio.sleep(0.3)

        tasks = [
            self.negotiate_with_merchant(m, session_id, buyer_id, intent)
            for m in merchants
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_offers = []
        best_offer = None
        for merchant, result in zip(merchants, results):
            if isinstance(result, Exception):
                result = {
                    "merchant_id": merchant["id"],
                    "status": "ERROR",
                    "reasoning": str(result),
                }
            elif "merchant_id" not in result:
                result["merchant_id"] = merchant["id"]

            all_offers.append(result)
            audit.log(session_id, "NEGOTIATION_RESULT", merchant["id"], result)
            broadcast_event(
                session_id,
                "merchant_agent",
                "NEGOTIATION",
                {
                    "merchant_id": merchant["id"],
                    "status": result.get("status"),
                    "reasoning": result.get("reasoning", ""),
                    "total_paise": result.get("pricing", {}).get("total_paise")
                    if result.get("pricing") else None,
                },
            )
            await asyncio.sleep(0.4)

            if result.get("status") == "OFFER":
                price = result["pricing"]["total_paise"]
                if price <= intent.budget_paise:
                    if best_offer is None or price < best_offer["pricing"]["total_paise"]:
                        best_offer = result

        if best_offer:
            offer_service.create(
                session_id=session_id,
                merchant_id=best_offer["merchant_id"],
                buyer_id=buyer_id,
                items=[
                    {"item_id": r["item_id"], "quantity": r["quantity"]}
                    for r in best_offer.get("items", [])
                ],
                pricing=best_offer["pricing"],
                ttl_minutes=self.offer_expiry_minutes,
            )
            best_offer["offer_id"] = offer_service.get_by_session(session_id)[-1]["id"]
            audit.log(session_id, "OFFER_STORED", "buyer_agent",
                      {"offer_id": best_offer["offer_id"],
                       "total_paise": best_offer["pricing"]["total_paise"]})
            broadcast_event(
                session_id, "buyer_agent", "OFFER_STORED",
                {"offer_id": best_offer["offer_id"],
                 "merchant_id": best_offer["merchant_id"],
                 "total_paise": best_offer["pricing"]["total_paise"]},
            )
            return {
                "status": "SUCCESS",
                "session_id": session_id,
                "buyer_id": buyer_id,
                "best_offer": best_offer,
                "all_offers": all_offers,
                "recommendation": (
                    f"Best deal from {best_offer['merchant_id']}: "
                    f"Rs. {best_offer['pricing']['total_paise'] // 100}"
                ),
            }

        broadcast_event(session_id, "buyer_agent", "NO_DEAL",
                        {"recommendation": "No merchant can meet your budget."})
        return {
            "status": "NO_DEAL",
            "session_id": session_id,
            "buyer_id": buyer_id,
            "all_offers": all_offers,
            "recommendation": (
                "No merchant can meet your budget. "
                "Try increasing budget or reducing items."
            ),
        }


_agent = None


def get_agent() -> BuyerAgent:
    global _agent
    if _agent is None:
        from backend.config import settings
        _agent = BuyerAgent(
            registry_url=f"http://localhost:{settings.BUYER_AGENT_PORT}/registry",
            offer_expiry_minutes=settings.OFFER_EXPIRY_MINUTES,
        )
    return _agent
