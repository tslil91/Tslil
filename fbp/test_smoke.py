"""Self-check on a synthetic survey with the HardPicks HDF5 schema: loader, training, evaluation."""
import sys, subprocess; sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
import subprocess, sys, json, tempfile
from pathlib import Path
import numpy as np, h5py

here = Path(__file__).parent
with tempfile.TemporaryDirectory() as d:
    rng = np.random.default_rng(0)
    shots, lines, recs, T, dt = 6, 3, 40, 300, 2000  # dt in usec
    S, L, R = np.meshgrid(np.arange(shots), np.arange(lines), np.arange(recs), indexing="ij")
    S, L, R = S.ravel(), L.ravel(), R.ravel()
    fb = 20 + np.abs(R - 5 * S) * 4 + 10 * L  # linear moveout, in samples
    t = np.arange(T)
    wav = lambda u: (1 - 2 * (u / 3) ** 2) * np.exp(-(u / 3) ** 2)
    x = wav(t[None] - fb[:, None]) + 0.5 * wav(t[None] - fb[:, None] - 40) + 0.05 * rng.standard_normal((len(fb), T))
    x[t[None] < fb[:, None] - 5] = 0.05 * rng.standard_normal(((t[None] < fb[:, None] - 5).sum()))
    perm = rng.permutation(len(fb))  # file order should not matter
    with h5py.File(f"{d}/Halfmile3D_add_geom_sorted.hdf5", "w") as f:
        h = f.create_group("TRACE_DATA/DEFAULT")
        h["data_array"] = x[perm].astype(np.float32)
        h["SAMP_RATE"] = np.full((len(fb), 1), dt)
        h["SHOT_PEG"] = (S[perm] + 100)[:, None]
        h["SHOTID"] = S[perm][:, None]
        h["REC_PEG"] = (L[perm] * 10000 + R[perm])[:, None]
        h["SPARE1"] = (fb[perm] * dt / 1000.0)[:, None]
    run = lambda *a: subprocess.run([sys.executable, *a], cwd=here, check=True)
    common = ["--data-dir", d, "--bad-gathers", ""]
    run("train.py", *common, "--train", "Halfmile", "--valid", "Halfmile", "--samples", "256",
        "--steps", "500", "--out", f"{d}/m.pt")
    run("evaluate.py", *common, "--model", f"{d}/m.pt", "--site", "Halfmile", "--out", d)
    r = json.loads(Path(f"{d}/metrics_Halfmile.json").read_text())
    assert r["gathers"] == shots * lines, r
    assert r["unet"]["HR@3px"] > 0.9, r["unet"]
    from core import smooth_picks
    q = np.array([50, 51, 52, 300, 54, 55, 56, 57, 58, 59])  # one outlier
    assert (smooth_picks(q) == [50, 51, 52, 54, 54, 55, 56, 57, 58, 59]).all(), smooth_picks(q)
    assert r["unet_median_smoothed"]["HR@3px"] >= r["unet"]["HR@3px"] - 0.02
    from core import robust_clip
    tr = np.r_[np.zeros(10), np.sin(np.arange(90) / 3.0)][None] * 0.01
    tr[0, 5] = 100.0  # noise spike
    out = robust_clip(tr).astype(np.float32)
    assert np.abs(out[0, 10:]).max() > 0.01, "signal must survive a spike"  # max-abs would leave ~1e-4
    print("SMOKE TEST OK", r["unet"]["HR@1px"], r["sta_lta"]["HR@1px"])
