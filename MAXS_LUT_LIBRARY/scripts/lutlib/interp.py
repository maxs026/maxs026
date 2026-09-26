"""Tetrahedral interpolation of a 3D LUT (same scheme as Resolve / OCIO "best")."""

from __future__ import annotations

import numpy as np


def apply_lut(table: np.ndarray, rgb: np.ndarray,
              domain_min=(0.0, 0.0, 0.0), domain_max=(1.0, 1.0, 1.0)) -> np.ndarray:
    """Apply ``table[r, g, b] -> rgb`` to an array ``(..., 3)`` of inputs.

    Inputs outside the domain are clamped to it (standard .cube behaviour).
    """
    table = np.asarray(table, dtype=np.float64)
    n = table.shape[0]
    shape = rgb.shape
    x = np.asarray(rgb, dtype=np.float64).reshape(-1, 3)
    dmin = np.asarray(domain_min, dtype=np.float64)
    dmax = np.asarray(domain_max, dtype=np.float64)
    x = (np.clip(x, dmin, dmax) - dmin) / (dmax - dmin) * (n - 1)

    i0 = np.clip(np.floor(x).astype(np.int64), 0, n - 2)
    f = x - i0
    fr, fg, fb = f[:, 0], f[:, 1], f[:, 2]
    r0, g0, b0 = i0[:, 0], i0[:, 1], i0[:, 2]
    r1, g1, b1 = r0 + 1, g0 + 1, b0 + 1

    def c(ri, gi, bi):
        return table[ri, gi, bi]

    c000 = c(r0, g0, b0)
    c111 = c(r1, g1, b1)
    out = np.empty_like(x)

    # six tetrahedra, selected by the ordering of the fractional parts
    conds = [
        (fr >= fg) & (fg >= fb),
        (fr >= fb) & (fb > fg),
        (fb > fr) & (fr >= fg),
        (fg > fr) & (fr >= fb),
        (fg >= fb) & (fb > fr),
        (fb > fg) & (fg > fr),
    ]
    for k, m in enumerate(conds):
        if not np.any(m):
            continue
        a, b_, cc = fr[m, None], fg[m, None], fb[m, None]
        R0, G0, B0, R1, G1, B1 = r0[m], g0[m], b0[m], r1[m], g1[m], b1[m]
        p000, p111 = c000[m], c111[m]
        if k == 0:   # r > g > b
            p1, p2 = c(R1, G0, B0), c(R1, G1, B0)
            out[m] = p000 + a * (p1 - p000) + b_ * (p2 - p1) + cc * (p111 - p2)
        elif k == 1:  # r > b > g
            p1, p2 = c(R1, G0, B0), c(R1, G0, B1)
            out[m] = p000 + a * (p1 - p000) + cc * (p2 - p1) + b_ * (p111 - p2)
        elif k == 2:  # b > r > g
            p1, p2 = c(R0, G0, B1), c(R1, G0, B1)
            out[m] = p000 + cc * (p1 - p000) + a * (p2 - p1) + b_ * (p111 - p2)
        elif k == 3:  # g > r > b
            p1, p2 = c(R0, G1, B0), c(R1, G1, B0)
            out[m] = p000 + b_ * (p1 - p000) + a * (p2 - p1) + cc * (p111 - p2)
        elif k == 4:  # g > b > r
            p1, p2 = c(R0, G1, B0), c(R0, G1, B1)
            out[m] = p000 + b_ * (p1 - p000) + cc * (p2 - p1) + a * (p111 - p2)
        else:        # b > g > r
            p1, p2 = c(R0, G0, B1), c(R0, G1, B1)
            out[m] = p000 + cc * (p1 - p000) + b_ * (p2 - p1) + a * (p111 - p2)
    return out.reshape(shape)


def resample(table: np.ndarray, new_size: int) -> np.ndarray:
    """Re-grid a LUT to ``new_size`` nodes with tetrahedral interpolation.

    Up-sampling does not add information: a 33 -> 65 resample reproduces the
    33-point LUT exactly on its own nodes and interpolates in between.
    """
    from .cube import identity_table
    return apply_lut(table, identity_table(new_size))
