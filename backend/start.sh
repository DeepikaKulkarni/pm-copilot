#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
"$SCRIPT_DIR/venv/bin/uvicorn" main:app --reload --port 8000
