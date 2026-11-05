"""Pytest configuration and environment fixtures."""

import os

# Ensure testing environment has JWT_SECRET set
os.environ.setdefault("JWT_SECRET", "test-secret-key-at-least-32-characters-long")
os.environ.setdefault("DEMO_PASSWORD", "demoPassword123")
