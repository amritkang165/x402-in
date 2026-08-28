from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from backend.core.database import init_db
from backend.buyer_agent.router import router as buyer_router
from backend.registry.router import router as registry_router
from backend.settlement.webhooks import router as webhook_router
from backend.theatre.router import router as theatre_router
from backend.theatre.websocket_manager import manager
from backend.config import settings

app = FastAPI(title="x402-IN Agentic Commerce Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(buyer_router)
app.include_router(registry_router)
app.include_router(webhook_router)
app.include_router(theatre_router)


@app.on_event("startup")
def on_startup():
    init_db()
    manager.set_loop(asyncio.get_event_loop())


@app.get("/")
def root():
    return {
        "service": "x402-in",
        "protocol_version": "0.1.0",
        "payment_method": "mock" if not settings.razorpay_enabled else "razorpay",
        "docs": "/docs",
    }
