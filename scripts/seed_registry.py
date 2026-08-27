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


def seed():
    with httpx.Client(timeout=5.0) as client:
        for m in MERCHANTS:
            resp = client.post(f"{BASE}/registry/register", json=m)
            print(resp.status_code, resp.json())


if __name__ == "__main__":
    seed()
