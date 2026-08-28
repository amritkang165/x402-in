def create_payment_link(amount_paise: int, description: str,
                       customer_email: str, idempotency_key: str) -> dict:
    return {
        "id": f"mock_link_{idempotency_key}",
        "order_id": f"mock_order_{idempotency_key}",
        "short_url": f"mock://pay/{idempotency_key}",
        "status": "MOCK_INITIATED",
    }
