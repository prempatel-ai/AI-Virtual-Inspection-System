#!/usr/bin/env python3
"""Performance benchmarking script for 17,000 Fair Price Shops dataset.

Measures:
1. Data generation duration (17,000 shops x 12 weeks, target: < 120s)
2. Run pipeline duration for 17,000 shops (target: < 60s)
3. Ranked shops endpoint p95 latency (target: < 300ms)
"""

import time
from pathlib import Path
import numpy as np
from fastapi.testclient import TestClient

from app.config import get_db_path
from app.data.generator import generate_pds_data
from app.db import init_db
from app.main import app as fastapi_app
from app.pipeline.run import run_pipeline_for_week


def benchmark_perf() -> dict[str, float]:
    repo_root = Path(__file__).resolve().parent.parent
    bench_db = repo_root / "data" / "perf_bench.db"
    if bench_db.exists():
        bench_db.unlink()

    init_db(bench_db)

    print("=" * 60)
    print("1. Benchmarking Data Generation (17,000 shops x 12 weeks)...")
    t0 = time.perf_counter()
    gen_summary = generate_pds_data(
        num_shops=17000,
        num_weeks=12,
        seed=42,
        db_path=bench_db,
    )
    t_gen = time.perf_counter() - t0
    print(f"-> Generated {gen_summary['num_shops']} shops in {t_gen:.2f} s (Target: < 120 s)")

    print("\n2. Benchmarking Scoring Run for 17,000 shops (1 week)...")
    target_week = gen_summary["latest_week"]
    t0 = time.perf_counter()
    run_res = run_pipeline_for_week(
        week_start=target_week,
        db_path=bench_db,
        top_k=20,
    )
    t_run = time.perf_counter() - t0
    print(
        f"-> Scored {run_res['shops_scored']} shops in {t_run:.2f} s "
        f"(Target: < 60 s, Pipeline internal: {run_res['duration_ms']} ms)"
    )

    print("\n3. Benchmarking GET /shops/ranked p95 latency...")
    # Monkey-patch db path for test client
    import app.config
    orig_get_db = app.config.get_db_path
    app.config.get_db_path = lambda: bench_db

    client = TestClient(fastapi_app)
    latencies: list[float] = []
    for _ in range(25):
        t0 = time.perf_counter()
        resp = client.get(f"/shops/ranked?week={target_week}&page=1&page_size=50")
        lat = (time.perf_counter() - t0) * 1000.0  # ms
        assert resp.status_code == 200
        latencies.append(lat)

    app.config.get_db_path = orig_get_db

    # Exclude warmup (first 5 calls)
    eval_latencies = latencies[5:]
    p95_latency = float(np.percentile(eval_latencies, 95))
    p50_latency = float(np.percentile(eval_latencies, 50))
    print(f"-> Latency: p50 = {p50_latency:.1f} ms, p95 = {p95_latency:.1f} ms (Target: < 300 ms)")

    # Clean up benchmark db
    if bench_db.exists():
        try:
            bench_db.unlink()
        except Exception:
            pass

    print("=" * 60)
    print("RESULTS SUMMARY:")
    print(f"Data Generation:   {t_gen:.2f} s  {'[PASS]' if t_gen < 120 else '[FAIL]'}")
    print(f"One-Week Run:      {t_run:.2f} s  {'[PASS]' if t_run < 60 else '[FAIL]'}")
    print(f"Ranked List p95:   {p95_latency:.1f} ms {'[PASS]' if p95_latency < 300 else '[FAIL]'}")
    print("=" * 60)

    return {
        "gen_sec": t_gen,
        "run_sec": t_run,
        "p95_ms": p95_latency,
        "p50_ms": p50_latency,
    }


if __name__ == "__main__":
    benchmark_perf()
