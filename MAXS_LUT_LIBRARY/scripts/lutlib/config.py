"""Paths and configuration loading."""

from __future__ import annotations

import tomllib
from pathlib import Path

from .look import LookParams, params_from_config

ROOT = Path(__file__).resolve().parents[2]
TECH_DIR = ROOT / "00_TECHNICAL"
TECH_SOURCE_DIR = TECH_DIR / "source"
LOOKS_DIR = ROOT / "01_LOOKS"
TESTS_DIR = ROOT / "02_TESTS"
IMAGES_DIR = TESTS_DIR / "images"
RENDERS_DIR = TESTS_DIR / "renders"
REPORTS_DIR = TESTS_DIR / "reports"
CONFIG_PATH = ROOT / "config" / "looks.toml"


def load_config(path: Path = CONFIG_PATH) -> dict:
    with open(path, "rb") as fh:
        return tomllib.load(fh)


def load_looks(cfg: dict | None = None) -> list[LookParams]:
    cfg = cfg or load_config()
    g = cfg.get("global", {})
    return [params_from_config(name, body, g) for name, body in cfg.get("looks", {}).items()]


MASTER_SIZE = 65   # 65^3 = version MASTER ; 33^3 = compatibilite


def look_path(name: str, size: int) -> Path:
    if size == MASTER_SIZE:
        return LOOKS_DIR / f"{name}.cube"
    return LOOKS_DIR / f"{size}_compat" / f"{name}_{size}.cube"


def all_cube_files() -> list[Path]:
    return sorted(p for d in (TECH_DIR, LOOKS_DIR) for p in d.rglob("*.cube")
                  if "source" not in p.relative_to(ROOT).parts)
