"""Configuration loader for backend settings, scoring, anomaly detection, bands, auth, and cases."""

import os
from pathlib import Path
from typing import Any, Dict

import yaml

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
CONFIG_PATH = BASE_DIR / "config.yaml"
CHECKLISTS_PATH = BASE_DIR / "checklists.yaml"
DEFAULT_DB_PATH = REPO_ROOT / "data" / "pds.db"


def get_db_path() -> Path:
    """Returns the database path from environment or default."""
    env_path = os.getenv("DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


def load_config() -> Dict[str, Any]:
    """Loads backend/config.yaml."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_checklists() -> Dict[str, Any]:
    """Loads backend/checklists.yaml."""
    with open(CHECKLISTS_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_auth_config() -> Dict[str, Any]:
    """Returns the auth configuration sub-dictionary."""
    return load_config().get("auth", {})


def get_cases_config() -> Dict[str, Any]:
    """Returns the cases configuration sub-dictionary."""
    return load_config().get("cases", {})
