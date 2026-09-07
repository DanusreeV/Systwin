#!/usr/bin/env bash
# start.sh — Start SysTwin AI (backend + frontend) in one command
# Usage: chmod +x start.sh && ./start.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "  ███████╗██╗   ██╗███████╗████████╗██╗    ██╗██╗███╗   ██╗     █████╗ ██╗"
echo "  ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██║    ██║██║████╗  ██║    ██╔══██╗██║"
echo "  ███████╗ ╚████╔╝ ███████╗   ██║   ██║ █╗ ██║██║██╔██╗ ██║    ███████║██║"
echo "  ╚════██║  ╚██╔╝  ╚════██║   ██║   ██║███╗██║██║██║╚██╗██║    ██╔══██║██║"
echo "  ███████║   ██║   ███████║   ██║   ╚███╔███╔╝██║██║ ╚████║    ██║  ██║██║"
echo "  ╚══════╝   ╚═╝   ╚══════╝   ╚═╝    ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝   ╚═╝  ╚═╝╚═╝"
echo ""
echo "  AI-Powered Digital Twin OS Monitor"
echo "  ─────────────────────────────────────────────────────────────"
echo ""

# ── Check Python ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "  ✗ Python 3 not found. Install from https://python.org"
  exit 1
fi

# ── Check Node ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

# ── Backend setup ─────────────────────────────────────────────────────────────
echo "  [1/4] Setting up backend virtual environment..."
cd "$BACKEND"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "        Created .venv"
fi

source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null

echo "  [2/4] Installing Python dependencies..."
pip install -q -r requirements.txt

# Seed DB if empty
DB_FILE="$BACKEND/data/metrics.db"
if [ ! -f "$DB_FILE" ]; then
  echo "  [2b]  Generating sample training data..."
  python ml_model/generate_sample_data.py
fi

# ── Frontend setup ────────────────────────────────────────────────────────────
echo "  [3/4] Installing frontend dependencies..."
cd "$FRONTEND"
if [ ! -d "node_modules" ]; then
  npm install --silent
fi

# ── Launch ────────────────────────────────────────────────────────────────────
echo "  [4/4] Starting servers..."
echo ""
echo "  Backend  → http://localhost:8000"
echo "  API docs → http://localhost:8000/docs"
echo "  Frontend → http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo "  ─────────────────────────────────────────────────────────────"
echo ""

# Start backend in background
cd "$BACKEND"
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null
python app.py &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start frontend in foreground (Ctrl+C will kill both via trap)
cd "$FRONTEND"
npm run dev &
FRONTEND_PID=$!

# Trap Ctrl+C to kill both
cleanup() {
  echo ""
  echo "  Shutting down SysTwin AI..."
  kill $BACKEND_PID  2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
