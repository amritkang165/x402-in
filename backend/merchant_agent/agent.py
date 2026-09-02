import yaml
from pathlib import Path

from backend.core.models import (
    BundleRule,
    CatalogItem,
    CatalogResponse,
    DiscountDetail,
    NegotiateResponse,
    PricingBreakdown,
    RequestedItem,
)


class MerchantAgent:
    def __init__(self, merchant: dict, inventory: list, bundle_rules: list, max_rounds: int = 2):
        self.id = merchant["id"]
        self.name = merchant["name"]
        self.description = merchant.get("description", "")
        self.items = {i["id"]: CatalogItem(**i) for i in inventory}
        self.bundles = [BundleRule(**b) for b in bundle_rules]
        self.max_rounds = max_rounds

    def catalog(self) -> CatalogResponse:
        return CatalogResponse(
            merchant_id=self.id,
            merchant_name=self.name,
            items=list(self.items.values()),
            bundle_rules=self.bundles,
        )

    def _suggest_alternatives(self, requested: list[RequestedItem], max_budget_paise=None):
        alternatives = []
        for req in requested:
            item = self.items.get(req.item_id)
            if item is None:
                alternatives.append({
                    "item_id": req.item_id,
                    "quantity": req.quantity,
                    "reason": "Item not in my catalog",
                })
                continue
            line_total = item.base_price_paise * req.quantity
            if max_budget_paise is not None and line_total <= max_budget_paise:
                continue  # this line fits the budget as-is
            reduced_qty = max(1, req.quantity // 2)
            alternatives.append({
                "item_id": req.item_id,
                "quantity": reduced_qty,
                "reason": "Reduce quantity to fit budget",
            })
        return alternatives

    def negotiate(self, request) -> NegotiateResponse:
        results = self._negotiate_logic(request)
        return NegotiateResponse(
            merchant_id=self.id,
            session_id=request.session_id,
            **results,
        )

    def _negotiate_logic(self, request) -> dict:
        if request.round > self.max_rounds:
            return {
                "status": "REJECT",
                "reasoning": "Max negotiation rounds reached. Please start new session.",
                "round": request.round,
            }

        unavailable = []
        for req in request.intent.items_requested:
            item = self.items.get(req.item_id)
            if item is None:
                unavailable.append(f"Item {req.item_id} not found")
            elif item.stock < req.quantity:
                unavailable.append(
                    f"Item {req.item_id} out of stock "
                    f"(requested {req.quantity}, have {item.stock})"
                )

        if unavailable:
            return {
                "status": "REJECT",
                "reasoning": "Some items unavailable: " + "; ".join(unavailable),
                "suggested_alternatives": self._suggest_alternatives(
                    request.intent.items_requested
                ),
                "round": request.round,
            }

        subtotal_paise = 0
        for req in request.intent.items_requested:
            item = self.items[req.item_id]
            subtotal_paise += item.base_price_paise * req.quantity

        discounts = []
        for bundle in self.bundles:
            requested_ids = {r.item_id for r in request.intent.items_requested}
            # A multi-item bundle (true combo) requires every listed item present.
            if len(bundle.item_ids) > 1 and not set(bundle.item_ids).issubset(requested_ids):
                continue

            eligible_qty = 0
            eligible_subtotal = 0
            for req in request.intent.items_requested:
                if req.item_id in bundle.item_ids:
                    eligible_qty += req.quantity
                    item = self.items[req.item_id]
                    eligible_subtotal += item.base_price_paise * req.quantity

            if eligible_qty >= bundle.min_quantity and eligible_subtotal > 0:
                if bundle.discount_type == "PERCENT":
                    amount = int(eligible_subtotal * (bundle.discount_value / 100))
                else:
                    amount = bundle.discount_value
                discounts.append(DiscountDetail(
                    rule=bundle.name,
                    amount_paise=amount,
                    description=(
                        f"{bundle.discount_value}% off eligible items"
                        if bundle.discount_type == "PERCENT"
                        else f"Rs. {bundle.discount_value // 100} off"
                    ),
                ))

        total_discount = sum(d.amount_paise for d in discounts)
        final_price = subtotal_paise - total_discount

        total_floor = 0
        for req in request.intent.items_requested:
            item = self.items[req.item_id]
            total_floor += item.floor_price_paise * req.quantity

        if final_price < total_floor:
            final_price = total_floor
            discounts = []
            reasoning = f"Price adjusted to floor price of Rs. {total_floor // 100}"
        else:
            reasoning = (
                f"Base: Rs. {subtotal_paise // 100}, "
                f"Discounts: Rs. {total_discount // 100}, "
                f"Final: Rs. {final_price // 100}"
            )

        pricing = PricingBreakdown(
            subtotal_paise=subtotal_paise,
            discounts=discounts,
            total_paise=final_price,
            currency="INR",
        )

        budget_paise = request.intent.budget_paise
        if final_price > budget_paise:
            if budget_paise >= total_floor:
                return {
                    "status": "COUNTER",
                    "pricing": pricing,
                    "reasoning": (
                        f"My best price is Rs. {final_price // 100}. Your budget is "
                        f"Rs. {budget_paise // 100}. Can you meet my price?"
                    ),
                    "round": request.round,
                    "next_action": "ACCEPT or COUNTER",
                }
            return {
                "status": "REJECT",
                "reasoning": (
                    f"Lowest I can go is Rs. {total_floor // 100}. Your budget is "
                    f"Rs. {budget_paise // 100}. Cannot fulfill."
                ),
                "suggested_alternatives": self._suggest_alternatives(
                    request.intent.items_requested, max_budget_paise=budget_paise
                ),
                "round": request.round,
            }

        return {
            "status": "OFFER",
            "items": [
                RequestedItem(item_id=r.item_id, quantity=r.quantity)
                for r in request.intent.items_requested
            ],
            "pricing": pricing,
            "reasoning": reasoning,
            "round": request.round,
            "next_action": "ACCEPT or COUNTER",
        }


def load_merchant_from_yaml(path: str | Path, max_rounds: int = 2) -> MerchantAgent:
    with open(path) as f:
        data = yaml.safe_load(f)
    return MerchantAgent(
        merchant=data["merchant"],
        inventory=data["inventory"],
        bundle_rules=data["bundle_rules"],
        max_rounds=max_rounds,
    )
