"""Colour maths used by the look engine and the tests.

Everything here is float64 and documented with its source. Nothing in this
module concerns Apple Log: see ``technical.py`` for that.

Sources
-------
* ITU-R BT.709-6: Rec.709 primaries / D65 white, luma weights.
* ITU-R BT.1886: reference EOTF of Rec.709 displays (pure 2.4 power when
  L_black = 0, L_white = 1).
* OkLab: Björn Ottosson, "A perceptual color space for image processing"
  (2020), https://bottosson.github.io/posts/oklab/ . The matrices below are
  the published ones for linear sRGB (= Rec.709 primaries, D65).
"""

from __future__ import annotations

import numpy as np

# BT.709 luminance weights (Y from linear RGB)
REC709_LUMA = np.array([0.2126, 0.7152, 0.0722])

# BT.1886 with Lb = 0, Lw = 1  ->  L = V ** 2.4
BT1886_GAMMA = 2.4

_M1 = np.array([  # linear sRGB -> LMS
    [0.4122214708, 0.5363325363, 0.0514459929],
    [0.2119034982, 0.6806995451, 0.1073969566],
    [0.0883024619, 0.2817188376, 0.6299787005],
])
_M2 = np.array([  # LMS' -> Lab
    [0.2104542553, 0.7936177850, -0.0040720468],
    [1.9779984951, -2.4285922050, 0.4505937099],
    [0.0259040371, 0.7827717662, -0.8086757660],
])
_M1_INV = np.linalg.inv(_M1)
_M2_INV = np.linalg.inv(_M2)


def display_to_linear(v: np.ndarray) -> np.ndarray:
    """Rec.709 display-encoded signal -> relative display light (BT.1886, Lb=0)."""
    return np.power(np.clip(v, 0.0, None), BT1886_GAMMA)


def linear_to_display(l: np.ndarray) -> np.ndarray:
    """Inverse of :func:`display_to_linear`."""
    return np.power(np.clip(l, 0.0, None), 1.0 / BT1886_GAMMA)


def luminance(lin_rgb: np.ndarray) -> np.ndarray:
    return lin_rgb @ REC709_LUMA


def linear_rgb_to_oklab(rgb: np.ndarray) -> np.ndarray:
    lms = rgb @ _M1.T
    lms_ = np.cbrt(lms)
    return lms_ @ _M2.T


def oklab_to_linear_rgb(lab: np.ndarray) -> np.ndarray:
    lms_ = lab @ _M2_INV.T
    lms = lms_ ** 3
    return lms @ _M1_INV.T


def lab_to_lch(lab: np.ndarray) -> np.ndarray:
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b)
    h = np.degrees(np.arctan2(b, a)) % 360.0
    return np.stack([L, C, h], axis=-1)


def lch_to_lab(lch: np.ndarray) -> np.ndarray:
    L, C, h = lch[..., 0], lch[..., 1], np.radians(lch[..., 2])
    return np.stack([L, C * np.cos(h), C * np.sin(h)], axis=-1)


def display_to_oklch(v: np.ndarray) -> np.ndarray:
    return lab_to_lch(linear_rgb_to_oklab(display_to_linear(v)))


def hue_diff(h1: np.ndarray, h2: np.ndarray) -> np.ndarray:
    """Signed smallest angular difference h2 - h1 in degrees, in [-180, 180)."""
    return (np.asarray(h2) - np.asarray(h1) + 180.0) % 360.0 - 180.0


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)
