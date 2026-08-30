import os

import httpx

BASE = os.getenv("X402_BASE", "http://localhost:8000")

MERCHANTS = [
    {
        "merchant_id": "pottery_rahul_001",
        "merchant_name": "Rahul's Handmade Pottery",
        "endpoint_url": "http://localhost:8001",
        "description": "Handcrafted ceramic mugs and bowls from Bangalore",
        "categories": ["pottery", "home"],
    },
    {
        "merchant_id": "candles_sneha_002",
        "merchant_name": "Sneha's Soy Candles",
        "endpoint_url": "http://localhost:8002",
        "description": "Artisanal soy wax candles",
        "categories": ["candles", "home"],
    },
]


# LLM-powered merchant (plain text -> OpenAI -> validated catalog).
# Only register this if you run the merchant with `--llm` on port 8003.
LLM_MERCHANT = {
    "merchant_id": "spices_meera_003",
    "merchant_name": "Meera's Spice Emporium",
    "endpoint_url": "http://localhost:8003",
    "description": "Artisanal spice blends and teas from Kerala (LLM-built catalog)",
    "categories": ["spices", "groceries"],
}


def seed():
    import sys
    merchants = list(MERCHANTS)
    if "--with-llm" in sys.argv:
        merchants.append(LLM_MERCHANT)
    with httpx.Client(timeout=5.0) as client:
        for m in merchants:
            resp = client.post(f"{BASE}/registry/register", json=m)
            print(resp.status_code, resp.json())


if __name__ == "__main__":
    seed()
