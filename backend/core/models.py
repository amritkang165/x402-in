from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class CatalogItem(BaseModel):
    id: str
    name: str
    base_price_paise: int = Field(..., gt=0)
    floor_price_paise: int = Field(..., gt=0)
    currency: Literal["INR"] = "INR"
    available: bool = True
    stock: int = Field(default=0, ge=0)
    variants: List[str] = Field(default_factory=list)
    description: Optional[str] = None


class BundleRule(BaseModel):
    id: str
    name: str
    description: str = ""
    item_ids: List[str] = Field(default_factory=list)
    min_quantity: int = Field(..., ge=1)
    discount_type: Literal["PERCENT", "FIXED"] = "PERCENT"
    discount_value: int = Field(..., ge=0)


class CatalogResponse(BaseModel):
    merchant_id: str
    merchant_name: str
    protocol_version: str = "0.1.0"
    capabilities: List[str] = Field(
        default_factory=lambda: ["CATALOG", "NEGOTIATION", "RAZORPAY_SETTLEMENT"]
    )
    items: List[CatalogItem] = Field(default_factory=list)
    bundle_rules: List[BundleRule] = Field(default_factory=list)
    payment_methods: List[str] = Field(default_factory=lambda: ["razorpay"])


class RequestedItem(BaseModel):
    item_id: str
    quantity: int = Field(..., ge=1, le=100)


class BuyerIntent(BaseModel):
    type: Literal["purchase", "inquiry"] = "purchase"
    items_requested: List[RequestedItem]
    budget_paise: int = Field(..., gt=0)
    currency: Literal["INR"] = "INR"
    preferences: Optional[dict] = None


class NegotiateRequest(BaseModel):
    buyer_id: str
    session_id: str
    intent: BuyerIntent
    round: int = Field(..., ge=1, le=10)
    previous_offer_id: Optional[str] = None


class DiscountDetail(BaseModel):
    rule: str
    amount_paise: int
    description: str


class PricingBreakdown(BaseModel):
    subtotal_paise: int
    discounts: List[DiscountDetail] = Field(default_factory=list)
    total_paise: int
    currency: Literal["INR"] = "INR"


class NegotiateResponse(BaseModel):
    merchant_id: str
    session_id: str
    offer_id: Optional[str] = None
    status: Literal["OFFER", "COUNTER", "REJECT", "ACCEPT"]
    items: List[RequestedItem] = Field(default_factory=list)
    pricing: Optional[PricingBreakdown] = None
    reasoning: str
    round: int
    next_action: Optional[str] = None
    suggested_alternatives: Optional[List[dict]] = None
    expires_at: Optional[datetime] = None


class SettlementRequest(BaseModel):
    session_id: str
    offer_id: str
    buyer_id: str
    buyer_email: str
    buyer_phone: Optional[str] = None
    shipping_address: Optional[dict] = None


class SettlementResponse(BaseModel):
    merchant_id: Optional[str] = None
    status: Literal[
        "SETTLEMENT_INITIATED", "FAILED", "OFFER_EXPIRED", "OFFER_NOT_FOUND"
    ]
    razorpay_order_id: Optional[str] = None
    payment_link: Optional[str] = None
    amount_paise: int
    currency: Literal["INR"] = "INR"
    expires_at: Optional[datetime] = None
    audit_hash: Optional[str] = None


class AuditEntry(BaseModel):
    timestamp: datetime
    session_id: str
    action_type: str
    actor: str
    details: dict
    previous_hash: str
    current_hash: str
