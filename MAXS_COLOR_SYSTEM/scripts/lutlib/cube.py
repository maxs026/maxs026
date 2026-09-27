"""Strict reader / writer for Adobe / Resolve style 3D ``.cube`` files.

Convention used everywhere in this library
------------------------------------------
``table`` is a float64 array of shape ``(N, N, N, 3)`` indexed
``table[r, g, b]``: the output RGB for the input node
``(r / (N-1), g / (N-1), b / (N-1))`` (scaled to DOMAIN_MIN..DOMAIN_MAX).

In the file, data lines are ordered with **red varying fastest**, then green,
then blue (Adobe Cube LUT Specification 1.0).
"""

from __future__ import annotations

from dataclasses import dataclass, field
import unicodedata
from pathlib import Path

import numpy as np

MIN_SIZE = 2
MAX_SIZE = 256


class CubeError(ValueError):
    """Raised when a .cube file is malformed."""


@dataclass
class Cube:
    table: np.ndarray
    title: str = ""
    domain_min: np.ndarray = field(default_factory=lambda: np.zeros(3))
    domain_max: np.ndarray = field(default_factory=lambda: np.ones(3))
    comments: list[str] = field(default_factory=list)

    @property
    def size(self) -> int:
        return int(self.table.shape[0])


def identity_table(size: int) -> np.ndarray:
    v = np.linspace(0.0, 1.0, size)
    r, g, b = np.meshgrid(v, v, v, indexing="ij")
    return np.stack([r, g, b], axis=-1)


def read_cube(path: str | Path) -> Cube:
    """Parse a 3D .cube file. Raises CubeError on any structural problem."""
    path = Path(path)
    title = ""
    size = None
    dmin = np.zeros(3)
    dmax = np.ones(3)
    comments: list[str] = []
    rows: list[list[float]] = []

    with path.open("r", encoding="utf-8", errors="strict") as fh:
        for lineno, raw in enumerate(fh, 1):
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#"):
                comments.append(line[1:].strip())
                continue
            head = line.split()[0]
            if head == "TITLE":
                title = line[len("TITLE"):].strip().strip('"')
            elif head == "LUT_3D_SIZE":
                if rows:
                    raise CubeError(f"{path}:{lineno}: LUT_3D_SIZE after data")
                try:
                    size = int(line.split()[1])
                except (IndexError, ValueError) as exc:
                    raise CubeError(f"{path}:{lineno}: bad LUT_3D_SIZE") from exc
                if not MIN_SIZE <= size <= MAX_SIZE:
                    raise CubeError(f"{path}:{lineno}: LUT_3D_SIZE {size} out of range")
            elif head == "LUT_1D_SIZE":
                raise CubeError(f"{path}:{lineno}: 1D LUTs are not supported here")
            elif head in ("DOMAIN_MIN", "DOMAIN_MAX"):
                vals = _floats(line.split()[1:], path, lineno)
                if len(vals) != 3:
                    raise CubeError(f"{path}:{lineno}: {head} needs 3 values")
                if head == "DOMAIN_MIN":
                    dmin = np.array(vals)
                else:
                    dmax = np.array(vals)
            elif not _is_number(head):
                raise CubeError(f"{path}:{lineno}: unknown keyword {head!r}")
            else:
                # NaN / Inf are parsed on purpose so that validators can report them.
                vals = _floats(line.split(), path, lineno)
                if len(vals) != 3:
                    raise CubeError(f"{path}:{lineno}: data line needs 3 values, got {len(vals)}")
                rows.append(vals)

    if size is None:
        raise CubeError(f"{path}: missing LUT_3D_SIZE")
    if len(rows) != size ** 3:
        raise CubeError(f"{path}: expected {size ** 3} data lines, found {len(rows)}")
    if np.any(dmax <= dmin):
        raise CubeError(f"{path}: DOMAIN_MAX must be > DOMAIN_MIN")

    data = np.asarray(rows, dtype=np.float64)
    # file order: r fastest -> reshape to [b, g, r] then transpose to [r, g, b]
    table = data.reshape(size, size, size, 3).transpose(2, 1, 0, 3).copy()
    return Cube(table=table, title=title, domain_min=dmin, domain_max=dmax, comments=comments)


def _is_number(token: str) -> bool:
    try:
        float(token)
    except ValueError:
        return False
    return True


def _floats(tokens, path, lineno):
    out = []
    for t in tokens:
        try:
            out.append(float(t))
        except ValueError as exc:
            raise CubeError(f"{path}:{lineno}: not a number: {t!r}") from exc
    return out


def _ascii(text: str) -> str:
    """Headers are written in plain ASCII: some applications reject UTF-8 in .cube files."""
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return folded.replace('"', "'")


def write_cube(path: str | Path, cube: Cube, decimals: int = 6) -> None:
    """Write a 3D .cube file (red fastest). Refuses non-finite data."""
    table = np.asarray(cube.table, dtype=np.float64)
    n = table.shape[0]
    if table.shape != (n, n, n, 3):
        raise CubeError(f"bad table shape {table.shape}")
    if not np.all(np.isfinite(table)):
        raise CubeError("refusing to write a LUT containing NaN/Inf")

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    comments = [_ascii(c) for c in cube.comments]
    data = table.transpose(2, 1, 0, 3).reshape(-1, 3)
    fmt = f"%.{decimals}f %.{decimals}f %.{decimals}f"
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        for c in comments:
            fh.write(f"# {c}\n" if c else "#\n")
        fh.write(f'TITLE "{_ascii(cube.title)}"\n')
        fh.write(f"LUT_3D_SIZE {n}\n")
        fh.write("DOMAIN_MIN {:.1f} {:.1f} {:.1f}\n".format(*cube.domain_min))
        fh.write("DOMAIN_MAX {:.1f} {:.1f} {:.1f}\n".format(*cube.domain_max))
        np.savetxt(fh, data, fmt=fmt)
