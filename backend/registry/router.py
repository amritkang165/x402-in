import json
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.core.database import db_session


class RegisterRequest(BaseModel):
    merchant_id: str
    merchant_name: str
    endpoint_url: str
    description: str = ""
    categories: list[str] = Field(default_factory=list)
    protocol_version: str = "0.1.0"
    capabilities: list[str] = Field(default_factory=list)


router = APIRouter(prefix="/registry", tags=["registry"])


@router.post("/register")
def register(req: RegisterRequest):
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO merchant_registry
                (id, name, endpoint_url, description, categories,
                 protocol_version, capabilities, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                endpoint_url=excluded.endpoint_url,
                description=excluded.description,
                categories=excluded.categories,
                capabilities=excluded.capabilities,
                last_seen=excluded.last_seen
            """,
            (
                req.merchant_id,
                req.merchant_name,
                req.endpoint_url,
                req.description,
                json.dumps(req.categories),
                req.protocol_version,
                json.dumps(req.capabilities),
                datetime.utcnow().isoformat(),
            ),
        )
    return {"status": "registered", "merchant_id": req.merchant_id}


@router.get("/list")
def list_merchants():
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM merchant_registry ORDER BY added_at"
        ).fetchall()
    return [
        {**dict(r), "categories": json.loads(r["categories"] or "[]"),
         "capabilities": json.loads(r["capabilities"] or "[]")}
        for r in rows
    ]


@router.get("/search")
def search(category: str | None = None):
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM merchant_registry").fetchall()
    merchants = []
    for r in rows:
        m = dict(r)
        cats = json.loads(m["categories"] or "[]")
        if category and category not in cats:
            continue
        merchants.append({**m, "categories": cats,
                         "capabilities": json.loads(m["capabilities"] or "[]")})
    return merchants
