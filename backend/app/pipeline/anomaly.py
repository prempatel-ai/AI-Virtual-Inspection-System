"""Anomaly detection for rate signals using robust z-scores. Pure functions."""

from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd


def robust_z(
    x: float,
    baseline: np.ndarray,
    min_scale: float,
) -> Tuple[float, float, float]:
    """Computes robust z-score: z = (x - median) / max(1.4826 * MAD, min_scale).

    Returns (z, median, mad).
    """
    if len(baseline) == 0:
        return 0.0, float(x), min_scale
    med = float(np.median(baseline))
    mad = float(np.median(np.abs(baseline - med)))
    scale = max(1.4826 * mad, min_scale)
    z = (x - med) / scale
    return float(z), med, mad


def compute_anomalies_for_week(
    df_features: pd.DataFrame,
    target_week: str,
    config: Dict[str, Any],
) -> pd.DataFrame:
    """Computes robust z-scores and strengths for rate signals in target_week.

    df_features must contain at least:
    shop_id, week_start, district, taluka, size_band,
    auth_fail_rate, unauth_share, complaints_rate.
    """
    anomaly_cfg = config.get("anomaly", {})
    z_cap = float(anomaly_cfg.get("z_cap", 4.0))
    own_window = int(anomaly_cfg.get("own_window", 8))
    min_own_window = int(anomaly_cfg.get("min_own_window", 4))
    min_peers = int(anomaly_cfg.get("min_peers", 5))
    min_scales = anomaly_cfg.get("min_scale", {})

    rate_signals = ["auth_fail_rate", "unauth_share", "complaints_rate"]

    # Split target week and historical data
    df_target = df_features[df_features["week_start"] == target_week].copy()
    df_history = df_features[df_features["week_start"] < target_week].copy()

    # Pre-index history by shop_id for fast lookup
    # Keep the most recent own_window weeks
    df_history_sorted = df_history.sort_values(["shop_id", "week_start"], ascending=[True, False])
    shop_histories = {
        s_id: group.head(own_window)
        for s_id, group in df_history_sorted.groupby("shop_id")
    }

    # Pre-group target week for fast peer lookup
    # 1. By (taluka, size_band)
    taluka_size_groups = {
        key: group
        for key, group in df_target.groupby(["taluka", "size_band"])
    }
    # 2. By (district, size_band) for widening
    district_size_groups = {
        key: group
        for key, group in df_target.groupby(["district", "size_band"])
    }
    # 3. By district for second widening
    district_groups = {
        key: group
        for key, group in df_target.groupby("district")
    }

    # Results collectors
    results: List[Dict[str, Any]] = []

    for row in df_target.itertuples(index=False):
        shop_id = str(row.shop_id)
        taluka = str(row.taluka)
        district = str(row.district)
        size_band = str(getattr(row, "size_band", "medium"))

        row_res: Dict[str, Any] = {
            "shop_id": shop_id,
            "week_start": target_week,
        }

        # 1. Peer baseline selection
        ts_group = taluka_size_groups.get((taluka, size_band))
        # Exclude self
        peers = (
            ts_group[ts_group["shop_id"] != shop_id]
            if ts_group is not None
            else pd.DataFrame()
        )

        if len(peers) < min_peers:
            ds_group = district_size_groups.get((district, size_band))
            peers = (
                ds_group[ds_group["shop_id"] != shop_id]
                if ds_group is not None
                else pd.DataFrame()
            )

        if len(peers) < min_peers:
            d_group = district_groups.get(district)
            peers = (
                d_group[d_group["shop_id"] != shop_id]
                if d_group is not None
                else pd.DataFrame()
            )

        # 2. Own history selection
        hist = shop_histories.get(shop_id)

        for sig in rate_signals:
            val = float(getattr(row, sig))
            min_scale = float(min_scales.get(sig, 0.02))

            # Peer z
            peer_vals = peers[sig].to_numpy(dtype=float) if len(peers) > 0 else np.array([])
            z_peer, peer_med, _ = robust_z(val, peer_vals, min_scale)

            # Own z
            if hist is not None and len(hist) >= min_own_window:
                own_vals = hist[sig].to_numpy(dtype=float)
                z_own, own_med, _ = robust_z(val, own_vals, min_scale)
            else:
                z_own = z_peer
                own_med = None

            z_min = min(z_own, z_peer)
            strength = float(np.clip(z_min / z_cap, 0.0, 1.0))

            row_res[f"{sig}_val"] = val
            row_res[f"{sig}_peer_med"] = peer_med
            row_res[f"{sig}_own_med"] = own_med
            row_res[f"{sig}_z_peer"] = z_peer
            row_res[f"{sig}_z_own"] = z_own
            row_res[f"{sig}_z"] = z_min
            row_res[f"{sig}_strength"] = strength

        results.append(row_res)

    return pd.DataFrame(results)
