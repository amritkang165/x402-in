#!/bin/bash
# Start a merchant agent. Usage: ./start_merchant.sh [port] [config]
set -e
PORT="${1:-8001}"
CONFIG="${2:-$(dirname "$0")/../backend/merchant_agent/merchant.yaml}"

cd "$(dirname "$0")/.."
source venv/bin/activate
python -m backend.merchant_agent.standalone --port "$PORT" --config "$CONFIG"
