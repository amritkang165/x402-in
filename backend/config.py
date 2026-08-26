import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", f"sqlite:///{BASE_DIR / 'x402_in.db'}"
    )
    MERCHANT_AGENT_PORT: int = int(os.getenv("MERCHANT_AGENT_PORT", "8001"))
    BUYER_AGENT_PORT: int = int(os.getenv("BUYER_AGENT_PORT", "8000"))
    MAX_NEGOTIATION_ROUNDS: int = int(os.getenv("MAX_NEGOTIATION_ROUNDS", "2"))
    OFFER_EXPIRY_MINUTES: int = int(os.getenv("OFFER_EXPIRY_MINUTES", "10"))

    RAZORPAY_KEY_ID: str | None = os.getenv("RAZORPAY_KEY_ID")
    RAZORPAY_KEY_SECRET: str | None = os.getenv("RAZORPAY_KEY_SECRET")

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.RAZORPAY_KEY_ID and self.RAZORPAY_KEY_SECRET)

    @property
    def database_path(self) -> Path:
        return Path(self.DATABASE_URL.split("sqlite:///", 1)[-1])


settings = Settings()
