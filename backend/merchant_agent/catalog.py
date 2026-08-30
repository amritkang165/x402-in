"""
OpenAI-powered catalog builder.

Core principle: the LLM PROPOSES a structured catalog; deterministic code
VALIDATES and clamps it. The LLM never decides a price that can break a
merchant's guardrails (floor prices, stock) — those come from config and are
enforced here and in negotiation.
"""

import json
from typing import List, Optional

import yaml
from pydantic import ValidationError

from backend.core.models import BundleRule, CatalogItem, CatalogResponse
from backend.config import settings
from backend.merchant_agent.agent import MerchantAgent


class CatalogBuildError(Exception):
    pass


def build_catalog_from_text(
    merchant_text: str,
    merchant_id: str,
    merchant_name: str,
    floor_prices: dict[str, int],
    bundle_rules: Optional[list[dict]] = None,
    model: str = "gpt-4o-mini",
) -> CatalogResponse:
    """Ask the LLM to structure a catalog, then clamp prices to floors."""
    if not settings.OPENAI_API_KEY:
        raise CatalogBuildError(
            "OPENAI_API_KEY not set. Add it to .env to use the LLM catalog builder."
        )

    try:
        from openai import OpenAI
    except ImportError:
        raise CatalogBuildError(
            "The 'openai' package is not installed. Run: pip install openai"
        )

    system = _SYSTEM_PROMPT
    user = _build_user_prompt(merchant_text, merchant_id, merchant_name, floor_prices)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
    except Exception as e:
        raise CatalogBuildError(f"OpenAI API call failed: {e}")

    content = resp.choices[0].message.content
    try:
        raw = json.loads(content)
    except json.JSONDecodeError as e:
        raise CatalogBuildError(f"LLM returned invalid JSON: {e}")

    return validate_and_clamp(
        raw,
        merchant_id=merchant_id,
        merchant_name=merchant_name,
        floor_prices=floor_prices,
        bundle_rules=bundle_rules,
    )


def validate_and_clamp(
    raw: dict,
    merchant_id: str,
    merchant_name: str,
    floor_prices: dict[str, int],
    bundle_rules: Optional[list[dict]] = None,
) -> CatalogResponse:
    """Deterministically validate the LLM's proposal and clamp to guardrails."""
    raw_items = raw.get("items") or []
    items: list[CatalogItem] = []
    for ri in raw_items:
        try:
            item = CatalogItem(
                id=str(ri.get("id") or ri.get("item_id")),
                name=ri.get("name") or "Untitled item",
                description=ri.get("description"),
                base_price_paise=int(ri.get("base_price_paise") or 0),
                stock=int(ri.get("stock") or 0),
                # The LLM may omit a floor; ONLY a merchant floor is authoritative.
                floor_price_paise=floor_prices.get(item_id_str(ri), 0),
                variants=ri.get("variants") or [],
            )
        except (ValidationError, ValueError, TypeError) as e:
            raise CatalogBuildError(f"LLM item did not pass validation: {ri} -> {e}")

        # Hard guardrail: an item may never be listed below its floor.
        if item.floor_price_paise > 0 and item.base_price_paise < item.floor_price_paise:
            item.base_price_paise = item.floor_price_paise

        if item.base_price_paise <= 0:
            raise CatalogBuildError(f"Item {item.id} has a non-positive price after validation")

        items.append(item)

    if not items:
        raise CatalogBuildError("LLM produced no valid items")

    bundles = _validate_bundles(bundle_rules or [], items)

    return CatalogResponse(
        merchant_id=merchant_id,
        merchant_name=merchant_name,
        items=items,
        bundle_rules=bundles,
    )


def _validate_bundles(rules, items: List[CatalogItem]) -> list[BundleRule]:
    known = {i.id for i in items}
    valid: list[BundleRule] = []
    for r in rules:
        try:
            b = BundleRule(**r)
        except ValidationError:
            continue
        if set(b.item_ids).issubset(known):
            valid.append(b)
    return valid


def item_id_str(ri: dict) -> str:
    return str(ri.get("id") or ri.get("item_id"))


_SYSTEM_PROMPT = """You are a strict catalog parser for an agentic commerce protocol.
Convert the merchant's plain-English inventory into a JSON object with EXACTLY this shape:

{
  "items": [
    {
      "id": "short_snake_case_id",
      "name": "Human readable name",
      "description": "short description",
      "base_price_paise": 30000,
      "stock": 15,
      "variants": ["blue", "brown"]
    }
  ]
}

Rules:
- base_price_paise is in INDIAN PAISE (Rs. 300 = 30000 paise). Always express prices in paise.
- base_price_paise should be a sensible list price (the merchant's asked price). It may be higher than any floor price.
- stock must be a non-negative integer.
- Only include items actually described by the merchant.
- Use only snake_case ids. Do not invent items not in the description.
- Output ONLY valid JSON. No markdown, no commentary."""


def _build_user_prompt(text, merchant_id, merchant_name, floor_prices) -> str:
    floor_block = json.dumps(floor_prices, indent=2) if floor_prices else "None provided"
    required_ids = ", ".join(floor_prices.keys()) if floor_prices else "any snake_case id of your choice"
    return (
        f"Merchant id: {merchant_id}\n"
        f"Merchant name: {merchant_name}\n\n"
        f"Merchant's plain-English inventory:\n---\n{text}\n---\n\n"
        f"Merchant floor prices (minimum sale price per item id, in paise):\n{floor_block}\n\n"
        "Structuralize the inventory into the required JSON. Prices in paise. "
        "You MUST use exactly these item ids (if the merchant sells an item matching a "
        f"floor-price key): {required_ids}. Do not invent different ids for those items. "
        "For items not in the floor-price list, set base_price_paise to a sensible list price."
    )


def load_llm_merchant_from_yaml(path, max_rounds: int = 2) -> MerchantAgent:
    """Load an LLM-powered merchant configured via merchant_llm.yaml.

    Raises CatalogBuildError if the LLM catalog cannot be built.
    """
    from pathlib import Path

    path = Path(path)
    with open(path) as f:
        data = yaml.safe_load(f)

    merchant = data["merchant"]
    floor_prices = {
        str(k): int(v) for k, v in data.get("floor_prices_paise", {}).items()
    }

    catalog = build_catalog_from_text(
        merchant_text=data.get("plain_text_catalog", ""),
        merchant_id=merchant["id"],
        merchant_name=merchant["name"],
        floor_prices=floor_prices,
        bundle_rules=data.get("bundle_rules", []),
        model=settings.OPENAI_MODEL,
    )

    items = [
        {
            "id": i.id,
            "name": i.name,
            "base_price_paise": i.base_price_paise,
            "floor_price_paise": i.floor_price_paise,
            "stock": i.stock,
            "variants": i.variants,
            "description": i.description,
        }
        for i in catalog.items
    ]
    return MerchantAgent(
        merchant=merchant,
        inventory=items,
        bundle_rules=[b.model_dump() for b in catalog.bundle_rules],
        max_rounds=max_rounds,
    )
