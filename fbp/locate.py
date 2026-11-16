"""Locate shots from first-break picks and compare with the known source positions.

Model per shot: t_i = t0 + |r_i - s| / v  (straight rays; t0 also absorbs a refraction's intercept time).
Fit (s_x, s_y, t0, v) with a robust loss so a few bad picks can't drag the solution.
"""
import argparse, json
from pathlib import Path
import numpy as np, h5py, torch
from scipy.optimize import least_squares
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from core import SITES, UNet, predict_gather, smooth_picks, sta_lta_pick, robust_clip


def locate(rx, ry, t, f_scale):
    """rx, ry in m, t in ms -> (sx, sy, t0, v_m_per_ms) or None when too few picks."""
    if len(t) < 20:
        return None
    i = np.argmin(t)
    res = lambda p: p[2] + np.hypot(rx - p[0], ry - p[1]) / p[3] - t
    s = least_squares(res, [rx[i], ry[i], 0.0, 5.0], loss="soft_l1", f_scale=f_scale,
                      bounds=([-np.inf, -np.inf, -500, 0.3], [np.inf, np.inf, 500, 10]))  # v: 300-10000 m/s
    return s.x


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", default="data")
    p.add_argument("--site", default="Halfmile")
    p.add_argument("--model", default="runs/cross_robust.pt")
    p.add_argument("--shots", type=int, default=100)
    p.add_argument("--min-conf", type=float, default=0.5)
    p.add_argument("--out", default="runs/locate")
    a = p.parse_args()
    ck = torch.load(a.model, weights_only=False)
    model = UNet(); model.load_state_dict(ck["model"]); torch.set_num_threads(4)
    norm, T = ck["args"].get("norm", "max"), ck["args"]["samples"]
    fname, field, digits = SITES[a.site]
    with h5py.File(Path(a.data_dir) / fname, "r") as f:
        h = f["TRACE_DATA/DEFAULT"]
        get = lambda k: h[k][:].ravel()
        dt = float(get("SAMP_RATE")[0]) / 1000
        xy = abs(float(get("COORD_SCALE")[0])) or 1.0
        shot = get("SHOT_PEG").astype(np.int64)
        if np.unique(shot).size == 1:
            shot = get("SHOTID").astype(np.int64)
        rec = get("REC_PEG").astype(np.int64)
        rx, ry = get("REC_X") / xy, get("REC_Y") / xy
        sx, sy = get("SOURCE_X") / xy, get("SOURCE_Y") / xy
        lab = get(field).astype(np.float64)  # ms, <= 0 means unlabelled
        ids = np.random.default_rng(0).choice(np.unique(shot), a.shots, replace=False)
        rows, demo = [], None
        for k, s in enumerate(ids):
            tr = np.flatnonzero(shot == s)
            span = tr.max() + 1 - tr.min()
            x = (h["data_array"][tr.min():tr.max() + 1, :T][tr - tr.min()] if span < 4 * len(tr)  # one slice read
                 else h["data_array"][tr, :T]).astype(np.float32)  # scattered traces: slow fancy read
            x = robust_clip(x).astype(np.float32) if norm == "robust" else x / (np.abs(x).max(1, keepdims=True) + 1e-12)
            pick, conf, sta = (np.zeros(len(tr)) for _ in range(3))
            line = rec[tr] // 10 ** digits
            for ln in np.unique(line):  # one gather per receiver line, ordered along the line (as in training)
                g = np.flatnonzero(line == ln); g = g[np.argsort(rec[tr][g])]
                q, c = predict_gather(model, x[g], return_conf=True)
                pick[g], conf[g], sta[g] = smooth_picks(q) * dt, c, sta_lta_pick(x[g]) * dt
            truth = np.array([sx[tr[0]], sy[tr[0]]])
            R, Y = rx[tr], ry[tr]
            sets = {"human labels": lab[tr] > 0, "U-Net": np.ones(len(tr), bool),
                    "U-Net + cutoff": conf >= a.min_conf, "STA/LTA": np.ones(len(tr), bool)}
            times = {"human labels": lab[tr], "U-Net": pick, "U-Net + cutoff": pick, "STA/LTA": sta}
            row = {"shot": int(s), "n_traces": len(tr)}
            for name, m in sets.items():
                sol = locate(R[m], Y[m], times[name][m], f_scale=2 * dt)
                row[name] = None if sol is None else dict(err_m=float(np.hypot(*(sol[:2] - truth))),
                                                          v_m_s=float(sol[3] * 1000), t0_ms=float(sol[2]), n=int(m.sum()))
                if k == 0 and sol is not None:
                    demo = demo or dict(R=R, Y=Y, t=pick, truth=truth, sols={})
                    demo["sols"][name] = sol[:2]
            rows.append(row)
            print(k, s, {n: (round(row[n]["err_m"], 1) if row[n] else None) for n in sets}, flush=True)

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    summ = {}
    for name in sets:
        e = np.array([r[name]["err_m"] for r in rows if r[name]])
        summ[name] = dict(shots_located=len(e), median_m=float(np.median(e)), mean_m=float(e.mean()),
                          p90_m=float(np.percentile(e, 90)), within_10m=float((e <= 10).mean()),
                          within_25m=float((e <= 25).mean()))
    (out / f"locate_{a.site}.json").write_text(json.dumps(dict(summary=summ, shots=rows), indent=1))
    print(json.dumps(summ, indent=1))

    fig, ax = plt.subplots(1, 2, figsize=(15, 6.5))
    for name in sets:
        e = np.sort([r[name]["err_m"] for r in rows if r[name]])
        ax[0].plot(e, np.arange(1, len(e) + 1) / len(rows) * 100, label=f"{name} (median {np.median(e):.1f} m)")
    ax[0].set(xscale="log", xlabel="location error (m)", ylabel="% of shots located within", title=f"{a.site}: shot location error, {len(rows)} shots")
    ax[0].grid(alpha=.3, which="both"); ax[0].legend()
    d = demo
    sc = ax[1].scatter(d["R"], d["Y"], c=d["t"], s=6, cmap="viridis"); plt.colorbar(sc, ax=ax[1], label="U-Net pick (ms)")
    ax[1].plot(*d["truth"], "k*", ms=18, label="true source")
    for (name, s), mk in zip(d["sols"].items(), "osDx"):
        ax[1].plot(*s, mk, mfc="none", ms=12, mew=2, label=f"located from {name}")
    ax[1].set(aspect="equal", xlabel="x (m)", ylabel="y (m)", title=f"shot {ids[0]}: receivers coloured by pick time"); ax[1].legend(fontsize=8)
    fig.tight_layout(); fig.savefig(out / f"locate_{a.site}.png", dpi=100)


if __name__ == "__main__":
    main()
