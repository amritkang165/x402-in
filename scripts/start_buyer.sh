#!/bin/bash
# Start the central gateway (registry + buyer + settlement + theatre).
set -e
cd "$(dirname "$0")/.."
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
