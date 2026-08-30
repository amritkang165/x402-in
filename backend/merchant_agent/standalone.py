import argparse
from pathlib import Path

import uvicorn
from fastapi import FastAPI

from backend.merchant_agent.agent import load_merchant_from_yaml
from backend.merchant_agent.catalog import (
    CatalogBuildError,
    load_llm_merchant_from_yaml,
)
from backend.merchant_agent.inventory import InventoryManager
from backend.merchant_agent.router import build_merchant_router
from backend.config import settings


def create_app(
    config_path: str,
    offer_expiry_minutes: int,
    use_llm: bool = False,
) -> FastAPI:
    if use_llm:
        agent = load_llm_merchant_from_yaml(
            config_path, max_rounds=settings.MAX_NEGOTIATION_ROUNDS
        )
    else:
        agent = load_merchant_from_yaml(
            config_path, max_rounds=settings.MAX_NEGOTIATION_ROUNDS
        )
    inventory = InventoryManager(agent.id, offer_expiry_minutes)
    app = FastAPI(title=f"Merchant Agent: {agent.name}")
    app.include_router(build_merchant_router(agent, inventory, offer_expiry_minutes))
    return app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=str(
        Path(__file__).parent / "merchant.yaml"
    ))
    parser.add_argument("--port", type=int, default=settings.MERCHANT_AGENT_PORT)
    parser.add_argument("--offer-expiry-minutes", type=int,
                        default=settings.OFFER_EXPIRY_MINUTES)
    parser.add_argument("--llm", action="store_true",
                        help="Build the catalog from plain text via OpenAI "
                             "(config must use plain_text_catalog + floor_prices_paise)")
    args = parser.parse_args()

    try:
        app = create_app(args.config, args.offer_expiry_minutes, use_llm=args.llm)
    except CatalogBuildError as e:
        print(f"Catalog build failed: {e}")
        raise SystemExit(1)

    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()