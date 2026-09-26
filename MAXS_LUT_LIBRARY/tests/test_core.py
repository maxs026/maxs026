"""Unit tests of the library internals (run: python -m pytest tests/ -q).

These complement scripts/test_luts.py (which tests the generated files):
they check the maths the LUTs are built from against independent references.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from lutlib import colorspace as cs  # noqa: E402
from lutlib import technical  # noqa: E402
from lutlib.checks import validate_cube  # noqa: E402
from lutlib.config import load_config, load_looks  # noqa: E402
from lutlib.cube import Cube, CubeError, identity_table, read_cube, write_cube  # noqa: E402
from lutlib.interp import apply_lut, resample  # noqa: E402
from lutlib.look import apply_look, gamut_soft  # noqa: E402
from lutlib.pchip import Pchip  # noqa: E402

colour = pytest.importorskip("colour")


# --- Apple Log curve: independent implementations must agree ---------------
def test_applelog_curve_colour_vs_ocio():
    ocio = pytest.importorskip("PyOpenColorIO")
    cfg = ocio.Config.CreateRaw()
    bt = ocio.BuiltinTransform("CURVE - APPLE_LOG_to_LINEAR")
    proc = cfg.getProcessor(bt).getDefaultCPUProcessor()
    p = np.linspace(0.0, 1.0, 1001, dtype=np.float32)
    rgb = np.ascontiguousarray(np.stack([p, p, p], -1))
    proc.applyRGB(rgb)
    ref = colour.models.log_decoding_AppleLogProfile(p.astype(np.float64))
    assert np.allclose(rgb[:, 0], ref, rtol=1e-4, atol=1e-5)


def test_applelog_grey_18():
    # value published in colour-science docstring / Apple white paper constants
    assert colour.models.log_encoding_AppleLogProfile(0.18) == pytest.approx(0.4882724, abs=1e-6)


# --- .cube IO ---------------------------------------------------------------
def test_cube_roundtrip(tmp_path):
    rng = np.random.default_rng(0)
    t = rng.random((5, 5, 5, 3))
    write_cube(tmp_path / "a.cube", Cube(table=t, title="t", comments=["x"]), decimals=10)
    back = read_cube(tmp_path / "a.cube")
    assert np.allclose(back.table, t, atol=1e-9)


def test_cube_order_matches_colour(tmp_path):
    t = identity_table(9) ** np.array([1.0, 2.0, 0.5])
    write_cube(tmp_path / "b.cube", Cube(table=t))
    ref = colour.read_LUT(str(tmp_path / "b.cube"))
    assert np.allclose(ref.table, t, atol=1e-7)


def test_cube_rejects_bad_count(tmp_path):
    (tmp_path / "bad.cube").write_text("LUT_3D_SIZE 2\n0 0 0\n1 1 1\n")
    with pytest.raises(CubeError):
        read_cube(tmp_path / "bad.cube")


def test_validator_flags_nan_and_small(tmp_path):
    t = identity_table(17)
    t[3, 4, 5, 1] = np.nan
    p = tmp_path / "nan.cube"
    p.write_text("LUT_3D_SIZE 17\n" + "\n".join(
        " ".join(str(v) for v in row) for row in t.transpose(2, 1, 0, 3).reshape(-1, 3)))
    rep, _ = validate_cube(p)
    names = {r.name for r in rep.failed}
    assert "absence de NaN" in names and "dimensions >= 33" in names


def test_validator_flags_discontinuity(tmp_path):
    t = identity_table(33)
    t[16:, :, :, 0] = np.clip(t[16:, :, :, 0] + 0.4, 0, 1)   # step in red
    write_cube(tmp_path / "jump.cube", Cube(table=t))
    rep, _ = validate_cube(tmp_path / "jump.cube")
    assert any(r.name.startswith("continuité") for r in rep.failed)


# --- interpolation ------------------------------------------------------------
def test_tetrahedral_matches_colour():
    rng = np.random.default_rng(1)
    t = rng.random((7, 7, 7, 3))
    x = rng.random((2000, 3))
    ref = colour.algebra.table_interpolation_tetrahedral(x, t)
    assert np.allclose(apply_lut(t, x), ref, atol=1e-10)


def test_identity_is_exact():
    x = np.random.default_rng(2).random((1000, 3))
    assert np.allclose(apply_lut(identity_table(33), x), x, atol=1e-12)


def test_resample_keeps_nodes():
    t = np.random.default_rng(3).random((5, 5, 5, 3))
    big = resample(t, 9)
    assert np.allclose(big[::2, ::2, ::2], t)


# --- colour maths ---------------------------------------------------------------
def test_oklab_matches_colour():
    rgb = np.random.default_rng(4).random((500, 3))
    ref = colour.XYZ_to_Oklab(colour.RGB_to_XYZ(rgb, "sRGB", apply_cctf_decoding=False))
    assert np.allclose(cs.linear_rgb_to_oklab(rgb), ref, atol=2e-4)
    assert np.allclose(cs.oklab_to_linear_rgb(cs.linear_rgb_to_oklab(rgb)), rgb, atol=1e-9)


def test_pchip_monotone():
    f = Pchip([0, 0.2, 0.57, 0.82, 1.0], [0, 0.16, 0.57, 0.85, 0.965])
    y = f(np.linspace(0, 1, 10001))
    assert np.all(np.diff(y) >= 0)


def test_gamut_soft_in_gamut_and_hue_preserving():
    rng = np.random.default_rng(5)
    lab = np.stack([rng.random(3000), rng.normal(0, 0.2, 3000), rng.normal(0, 0.2, 3000)], -1)
    rgb = gamut_soft(lab)
    assert rgb.min() >= 0 and rgb.max() <= 1
    back = cs.lab_to_lch(cs.linear_rgb_to_oklab(rgb))
    lch = cs.lab_to_lch(lab)
    chromatic = back[:, 1] > 0.01
    assert np.abs(cs.hue_diff(lch[chromatic, 2], back[chromatic, 2])).max() < 0.5


# --- looks --------------------------------------------------------------------
@pytest.mark.parametrize("look", load_looks(), ids=lambda l: l.name)
def test_look_basic(look):
    x = identity_table(17).reshape(-1, 3)
    y = apply_look(x, look)
    assert np.all(np.isfinite(y)) and y.min() >= 0 and y.max() <= 1
    # determinism: same parameters -> same LUT
    assert np.array_equal(y, apply_look(x, look))


def test_config_has_five_looks():
    names = [l.name for l in load_looks()]
    assert names == ["MAXS_Natural", "MAXS_Paris", "MAXS_Film", "MAXS_Golden", "MAXS_Night"]
    assert "tests" in load_config()


# --- technical LUT policy ---------------------------------------------------------
def test_technical_stops_without_official_source(tmp_path, capsys):
    (tmp_path / "source").mkdir()
    assert technical.build_official(tmp_path / "source", tmp_path, [33]) == []
    assert "NON GÉNÉRÉE" in capsys.readouterr().out
    assert not list(tmp_path.rglob("AppleLog_to_Rec709*.cube"))


def test_technical_imports_source_bit_exact(tmp_path):
    src = tmp_path / "source"
    src.mkdir()
    write_cube(src / "vendor.cube", Cube(table=identity_table(33) ** 0.9))
    out = technical.build_official(src, tmp_path, [33, 65])
    assert (tmp_path / "AppleLog_to_Rec709.cube").read_bytes() == (src / "vendor.cube").read_bytes()
    big = read_cube(out[1])
    assert big.size == 65
    assert np.allclose(big.table[::2, ::2, ::2], identity_table(33) ** 0.9, atol=1e-7)


def test_aces_reference_is_labelled_non_apple(tmp_path):
    pytest.importorskip("PyOpenColorIO")
    out = technical.build_aces_reference(tmp_path, [33])
    assert "NON-APPLE" in out[0].name
    cube = read_cube(out[0])
    assert any("NON OFFICIEL APPLE" in c for c in cube.comments)
    rep, _ = validate_cube(out[0])
    assert not rep.failed
