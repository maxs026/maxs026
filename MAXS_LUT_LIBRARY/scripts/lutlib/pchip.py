"""Monotone piecewise-cubic Hermite interpolation (Fritsch & Carlson, 1980).

Used for the tone curves: a monotone set of control points always yields a
monotone, C1-continuous curve with no overshoot, so the tone curve can never
invert luminance or create ringing / banding at the knots.
"""

from __future__ import annotations

import numpy as np


def _slopes(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    h = np.diff(x)
    delta = np.diff(y) / h
    n = len(x)
    m = np.zeros(n)
    for k in range(1, n - 1):
        if delta[k - 1] * delta[k] <= 0:
            m[k] = 0.0
        else:
            w1 = 2 * h[k] + h[k - 1]
            w2 = h[k] + 2 * h[k - 1]
            m[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k])
    # one-sided, shape-preserving end slopes
    m[0] = _end_slope(h[0], h[1] if n > 2 else h[0], delta[0], delta[1] if n > 2 else delta[0])
    m[-1] = _end_slope(h[-1], h[-2] if n > 2 else h[-1], delta[-1], delta[-2] if n > 2 else delta[-1])
    return m


def _end_slope(h0, h1, d0, d1):
    d = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
    if np.sign(d) != np.sign(d0):
        return 0.0
    if np.sign(d0) != np.sign(d1) and abs(d) > abs(3 * d0):
        return 3 * d0
    return d


class Pchip:
    def __init__(self, x, y):
        x = np.asarray(x, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        if np.any(np.diff(x) <= 0):
            raise ValueError("control point x must be strictly increasing")
        if np.any(np.diff(y) < 0):
            raise ValueError("control point y must be non-decreasing (monotone curve)")
        self.x, self.y, self.m = x, y, _slopes(x, y)

    def __call__(self, t: np.ndarray) -> np.ndarray:
        t = np.asarray(t, dtype=np.float64)
        tc = np.clip(t, self.x[0], self.x[-1])
        k = np.clip(np.searchsorted(self.x, tc, side="right") - 1, 0, len(self.x) - 2)
        h = self.x[k + 1] - self.x[k]
        s = (tc - self.x[k]) / h
        h00 = (1 + 2 * s) * (1 - s) ** 2
        h10 = s * (1 - s) ** 2
        h01 = s * s * (3 - 2 * s)
        h11 = s * s * (s - 1)
        return h00 * self.y[k] + h10 * h * self.m[k] + h01 * self.y[k + 1] + h11 * h * self.m[k + 1]
