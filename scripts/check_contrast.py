#!/usr/bin/env python3
"""WCAG AA Contrast Checker for design tokens in frontend/styles/tokens.css.

Checks:
- Normal text pairs: contrast ratio >= 4.5:1
- UI element pairs: contrast ratio >= 3.0:1
"""

import re
import sys
from pathlib import Path


def hex_to_rgb(hex_code: str) -> tuple[int, int, int]:
    clean_hex = hex_code.strip().lstrip("#")
    if len(clean_hex) == 3:
        clean_hex = "".join(c * 2 for c in clean_hex)
    return int(clean_hex[0:2], 16), int(clean_hex[2:4], 16), int(clean_hex[4:6], 16)


def srgb_channel_to_linear(val: float) -> float:
    c = val / 255.0
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    r = srgb_channel_to_linear(rgb[0])
    g = srgb_channel_to_linear(rgb[1])
    b = srgb_channel_to_linear(rgb[2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(color1: str, color2: str) -> float:
    rgb1 = hex_to_rgb(color1)
    rgb2 = hex_to_rgb(color2)
    l1 = relative_luminance(rgb1)
    l2 = relative_luminance(rgb2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def load_tokens(tokens_path: Path) -> dict[str, str]:
    content = tokens_path.read_text(encoding="utf-8")
    color_pattern = re.compile(r"(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;")
    tokens = {}
    for match in color_pattern.finditer(content):
        name, val = match.groups()
        tokens[name] = val.upper()
    return tokens


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    tokens_path = repo_root / "frontend" / "styles" / "tokens.css"

    if not tokens_path.exists():
        print(f"Error: {tokens_path} not found")
        return 1

    tokens = load_tokens(tokens_path)

    # Pairs to verify with minimum required contrast ratio
    text_pairs = [
        ("--color-text", "--color-bg", 4.5, "Text on white background"),
        ("--color-text", "--color-surface", 4.5, "Text on surface background"),
        ("--color-text-muted", "--color-bg", 4.5, "Muted text on white background"),
        ("--color-text-muted", "--color-surface", 4.5, "Muted text on surface background"),
        ("--color-accent", "--color-bg", 4.5, "Accent text/links on white background"),
        ("--color-accent", "--color-surface", 4.5, "Accent text on surface background"),
        ("--color-accent", "--color-accent-subtle", 4.5, "Accent text on subtle accent bg"),
        ("--color-accent-fg", "--color-accent", 4.5, "Button text on accent background"),
        ("--risk-high", "--risk-high-bg", 4.5, "High risk badge text on high risk bg"),
        ("--risk-high", "--color-bg", 4.5, "High risk text on white background"),
        ("--risk-medium", "--risk-medium-bg", 4.5, "Medium risk badge text on medium risk bg"),
        ("--risk-medium", "--color-bg", 4.5, "Medium risk text on white background"),
        ("--risk-low", "--risk-low-bg", 4.5, "Low risk badge text on low risk bg"),
        ("--risk-low", "--color-bg", 4.5, "Low risk text on white background"),
    ]

    ui_pairs = [
        ("--color-accent", "--color-bg", 3.0, "Focus ring against white background"),
        ("--color-accent", "--color-surface", 3.0, "Focus ring against surface"),
    ]

    all_passed = True
    print("=" * 60)
    print("WCAG AA Contrast Check")
    print("=" * 60)

    for fg_name, bg_name, min_ratio, description in text_pairs + ui_pairs:
        fg = tokens.get(fg_name)
        bg = tokens.get(bg_name)
        if not fg or not bg:
            print(f"[FAIL] Missing token: {fg_name} or {bg_name}")
            all_passed = False
            continue

        ratio = contrast_ratio(fg, bg)
        passed = ratio >= min_ratio
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False

        print(
            f"[{status}] {description:42} | {fg} on {bg} | "
            f"Ratio: {ratio:.2f}:1 (Target: >= {min_ratio}:1)"
        )

    print("=" * 60)
    if all_passed:
        print("ALL CONTRAST PAIRS PASS WCAG AA.")
        return 0
    else:
        print("SOME CONTRAST PAIRS FAILED. ADJUST TOKENS IN tokens.css.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
