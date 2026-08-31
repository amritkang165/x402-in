from backend.config import settings


def is_mock() -> bool:
    """True when real Razorpay keys are NOT configured (simulated settlement)."""
    return not settings.razorpay_enabled


def create_payment_link(amount_paise: int, description: str, customer_email: str, idempotency_key: str) -> dict:
    if is_mock():
        return {
            "id": f"mock_link_{idempotency_key}",
            "order_id": f"mock_order_{idempotency_key}",
            "short_url": f"mock://pay/{idempotency_key}",
            "status": "MOCK_INITIATED",
        }

    try:
        import razorpay
    except ImportError:
        raise RuntimeError("razorpay package not installed but keys are set")

    client = razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )
    # Idempotency: Reuse the same Razorpay payment link for a given
    # session+offer so retries never create duplicates.
    link = client.payment_link.create(
        {
            "amount": amount_paise,
            "currency": "INR",
            "description": description,
            "customer": {"email": customer_email},
            "notify": {"email": True},
        },
        headers={"X-Razorpay-Idempotency-Key": idempotency_key},
    )
    return {
        "id": link.get("id"),
        "order_id": link.get("order_id"),
        "short_url": link.get("short_url"),
        "status": link.get("status"),
    }


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    if is_mock():
        return bool(signature)
    try:
        import razorpay
        client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        client.utility.verify_webhook_signature(
            body, signature, settings.RAZORPAY_KEY_SECRET
        )
        return True
    except Exception:
        return False


def extract_payment_event(payload: dict) -> str | None:
    """Return payment_status ('captured' | ...) for a Razorpay webhook payload.

    Handles both `payment` events (payment.entity) and `payment_link` events
    (payment_link.entity.payments), matching real Razorpay payload shapes.
    """
    body = payload.get("payload", {})
    payment = body.get("payment", {}).get("entity")
    if payment:
        return payment.get("status")
    link_payments = body.get("payment_link", {}).get("entity", {}).get("payments")
    if isinstance(link_payments, list) and link_payments:
        return link_payments[0].get("status")
    return None


def extract_link_refs(payload: dict) -> dict:
    """Find identifiers that map a webhook to our stored session."""
    body = payload.get("payload", {})
    refs: dict = {"order_id": None, "payment_link_id": None}
    payment = body.get("payment", {}).get("entity")
    link = body.get("payment_link", {}).get("entity")
    if payment:
        refs["order_id"] = payment.get("order_id")
    if link:
        refs["payment_link_id"] = link.get("id")
    return refs