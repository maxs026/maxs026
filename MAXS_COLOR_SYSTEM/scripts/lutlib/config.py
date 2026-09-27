"""Paths and configuration loading."""

from __future__ import annotations

import tomllib
from pathlib import Path

from .look import LookParams, params_from_config

SYSTEM_NAME = "MAXS COLOR SYSTEM"
MASTER_SIZE = 65   # 65^3 = MASTER
COMPAT_SIZE = 33   # 33^3 = compatibilite

ROOT = Path(__file__).resolve().parents[2]
TECH_DIR = ROOT / "00_TECHNICAL"
APPLE_DIR = TECH_DIR / "APPLE_OFFICIAL"          # LUT officielle Apple (fournie par l'utilisateur)
TECH_SOURCE_DIR = APPLE_DIR / "source"            # fichier original, jamais modifie
ACES_DIR = TECH_DIR / "ACES2_NON-APPLE"           # reference documentee NON Apple
LOOKS_DIR = ROOT / "01_LOOKS"
TESTS_DIR = ROOT / "02_TESTS"
IMAGES_DIR = TESTS_DIR / "images"
RENDERS_DIR = TESTS_DIR / "renders"
REPORTS_DIR = TESTS_DIR / "reports"
REAL_FOOTAGE_DIR = TESTS_DIR / "REAL_FOOTAGE"
DAVINCI_DIR = ROOT / "03_DAVINCI"
CONFIG_PATH = ROOT / "config" / "looks.toml"


def load_config(path: Path = CONFIG_PATH) -> dict:
    with open(path, "rb") as fh:
        return tomllib.load(fh)


def load_looks(cfg: dict | None = None) -> list[LookParams]:
    cfg = cfg or load_config()
    g = cfg.get("global", {})
    return [params_from_config(name, body, g) for name, body in cfg.get("looks", {}).items()]


def system_version(cfg: dict | None = None) -> str:
    return str((cfg or load_config())["global"]["version"])


def look_dir(name: str) -> Path:
    return LOOKS_DIR / name


def look_path(name: str, size: int) -> Path:
    """01_LOOKS/MAXS_Name/MAXS_Name_65.cube (MASTER) or ..._33.cube (compat)."""
    return look_dir(name) / f"{name}_{size}.cube"


def all_cube_files() -> list[Path]:
    """Every delivered .cube (current versions). Excludes the untouched Apple
    source file and archived versions."""
    return sorted(p for d in (TECH_DIR, LOOKS_DIR) for p in d.rglob("*.cube")
                  if not {"source", "versions"} & set(p.relative_to(ROOT).parts))
