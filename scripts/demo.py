"""scripts/demo.py - PDS Self-Auditing / AI Virtual Inspection System Demo Launcher.

Ensures synthetic dataset is generated, scores are computed for the latest week,
and starts both backend (FastAPI) and frontend (Next.js) servers with a single command.
"""

from __future__ import annotations

import argparse
import signal
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATA_DIR = PROJECT_ROOT / "data"

sys.path.insert(0, str(BACKEND_DIR))

from app.data.generator import generate_pds_data
from app.db import get_connection, get_db_path, init_db
from app.pipeline.run import run_pipeline_for_week


def ensure_data_and_run(force: bool = False, shops: int = 500, weeks: int = 12, seed: int = 42) -> None:
    """Ensure seeded data and scoring run exist in SQLite database."""
    db_path = get_db_path()
    needs_data = force or not db_path.exists()

    if not needs_data:
        try:
            conn = get_connection(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM shops")
            shop_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM scores")
            score_count = cursor.fetchone()[0]
            conn.close()
            if shop_count < shops or score_count == 0:
                needs_data = True
        except (sqlite3.Error, OSError):
            needs_data = True

    if needs_data:
        print("[DEMO] Generating synthetic PDS dataset (shops=500, weeks=12, seed=42)...")
        init_db(db_path)
        generate_pds_data(num_shops=shops, num_weeks=weeks, seed=seed, db_path=db_path)

        print("[DEMO] Running scoring pipeline for latest week...")
        run_pipeline_for_week(db_path=db_path)
        print("[DEMO] Dataset and scores generated successfully.")
    else:
        print(f"[DEMO] Found existing dataset and scores at {db_path}.")


def get_server_commands() -> tuple[list[str], list[str]]:
    """Determine the backend and frontend launch commands based on platform."""
    python_exe = sys.executable
    backend_cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "app.main:app",
        "--app-dir",
        str(BACKEND_DIR),
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--reload",
    ]

    is_windows = sys.platform.startswith("win")
    npm_cmd = "npm.cmd" if is_windows else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]

    return backend_cmd, frontend_cmd


def print_banner() -> None:
    banner = """
================================================================================
   PDS Self-Auditing / AI Virtual Inspection System - Demo Server
================================================================================
  Web UI:        http://localhost:3000
  API Docs:      http://localhost:8000/docs
  Walkthrough:   docs/DEMO.md

  Seeded Scenarios for Walkthrough:
  - S1 Stock Diversion:       FPS-00183 (Mehsana) - Unaccounted closing stock deficit
  - S2 Board Discrepancy:     FPS-00125 (Patan)   - Display board vs ePoS mismatch
  - S3 Override Spike:        FPS-00122 (Mehsana) - High biometric auth overrides
  - S4 Complaint Surge:       FPS-00001 (Mehsana) - Denied rations / short weight
  - S5 Multi-Signal Severe:   FPS-00167 (Mehsana) - Stock deficit + overrides + complaints
  - S6 Vulnerable Priority:   FPS-00131 (Mehsana) - High vulnerability index uplift
  - S7 Outage Taluka Trap:    Kadi Taluka         - Filtered from false alarms

  Press Ctrl+C to terminate both servers.
================================================================================
"""
    print(banner)


def run_demo(setup_only: bool = False, timeout: int | None = None) -> None:
    """Run data setup and optionally start backend and frontend servers."""
    ensure_data_and_run()

    if setup_only:
        print("[DEMO] Setup-only mode complete. Exiting.")
        return

    backend_cmd, frontend_cmd = get_server_commands()
    print_banner()

    print("[DEMO] Starting FastAPI backend on http://127.0.0.1:8000 ...")
    backend_proc = subprocess.Popen(backend_cmd, cwd=str(PROJECT_ROOT))

    print("[DEMO] Starting Next.js frontend on http://localhost:3000 ...")
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=str(FRONTEND_DIR))

    def cleanup(signum=None, frame=None):
        print("\n[DEMO] Shutting down demo servers...")
        if sys.platform.startswith("win"):
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(backend_proc.pid)], check=False, capture_output=True)
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], check=False, capture_output=True)
        else:
            backend_proc.terminate()
            frontend_proc.terminate()
        print("[DEMO] Demo stopped. Goodbye.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, cleanup)

    start_time = time.time()
    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print(f"[DEMO] Backend process exited unexpectedly with code {backend_proc.returncode}.")
                cleanup()
                break
            if frontend_proc.poll() is not None:
                print(f"[DEMO] Frontend process exited unexpectedly with code {frontend_proc.returncode}.")
                cleanup()
                break
            if timeout and (time.time() - start_time) > timeout:
                print(f"[DEMO] Reached timeout of {timeout}s.")
                cleanup()
                break
    except KeyboardInterrupt:
        cleanup()


def main() -> None:
    parser = argparse.ArgumentParser(description="PDS Self-Auditing Demo Launcher")
    parser.add_argument("--setup-only", action="store_true", help="Generate data and runs without starting servers")
    parser.add_argument("--timeout", type=int, default=None, help="Stop servers automatically after N seconds (for testing)")
    parser.add_argument("--force", action="store_true", help="Force regenerate dataset and run")
    args = parser.parse_args()

    if args.force:
        ensure_data_and_run(force=True)

    run_demo(setup_only=args.setup_only, timeout=args.timeout)


if __name__ == "__main__":
    main()
