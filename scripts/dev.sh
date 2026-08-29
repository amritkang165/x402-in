#!/bin/bash
# One-command dev launcher: central gateway + merchant(s) + seed + frontend.
# Each service runs in its own log file. Ctrl+C stops them.
set -e
cd "$(dirname "$0")/.."

LOG="${LOG_DIR:-/tmp}/x402"
mkdir -p "$LOG"

echo "Starting x402-IN dev stack..."

source venv/bin/activate

# 1. Central gateway (buyer + registry + settlement + theatre)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 > "$LOG/central.log" 2>&1 &
CENTRAL=$!
echo "  central gateway  ->  http://localhost:8000  (pid $CENTRAL)"

# 2. Merchant agents
python -m backend.merchant_agent.standalone --port 8001 \
  --config backend/merchant_agent/merchant.yaml > "$LOG/merchant1.log" 2>&1 &
M1=$!
echo "  merchant pottery ->  http://localhost:8001  (pid $M1)"

python -m backend.merchant_agent.standalone --port 8002 \
  --config backend/merchant_agent/merchant_candles.yaml > "$LOG/merchant2.log" 2>&1 &
M2=$!
echo "  merchant candles->  http://localhost:8002  (pid $M2)"

# Wait for the gateway to be ready, then seed the registry
for i in {1..30}; do
  if curl -sf localhost:8000/ >/dev/null 2>&1; then break; fi
  sleep 0.3
done
python scripts/seed_registry.py > "$LOG/seed.log" 2>&1 \
  && echo "  registry seeded" || echo "  WARN: seed failed (see $LOG/seed.log)"

# 3. Frontend
( cd frontend && npm run dev ) > "$LOG/frontend.log" 2>&1 &
FE=$!
echo "  frontend         ->  http://localhost:5173  (pid $FE)"

echo
echo "All services started. Logs in $LOG"
echo "Open http://localhost:5173  (API docs: http://localhost:8000/docs)"
echo
echo "Press Ctrl+C to stop all services."
trap "kill $CENTRAL $M1 $M2 $FE 2>/dev/null" INT TERM
wait
