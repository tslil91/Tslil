"""Evaluate a trained picker (and the STA/LTA baseline) on a held-out site; write metrics + figures."""
import argparse, json
from pathlib import Path
import numpy as np
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from core import load_site_cached, UNet, predict_gather, smooth_picks, sta_lta_pick, metrics


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="runs/model.pt")
    p.add_argument("--data-dir", default="data")
    p.add_argument("--bad-gathers", default="data/bad-gather-ids_combined.yaml")
    p.add_argument("--site", default="Halfmile")
    p.add_argument("--max-gathers", type=int, default=1000)
    p.add_argument("--tail", type=float, default=1.0, help="evaluate only the last fraction of gathers (single-site split)")
    p.add_argument("--tta", action="store_true", help="test-time augmentation (reversed + polarity-flipped views)")
    p.add_argument("--min-conf", type=float, default=0.0, help="reject picks with confidence below this (pick = -1)")
    p.add_argument("--out", default="runs/eval")
    a = p.parse_args()
    ck = torch.load(a.model, weights_only=False)
    model = UNet(); model.load_state_dict(ck["model"])
    gathers, dt, nb = load_site_cached(a.data_dir, a.site, ck["args"]["samples"], ck["args"]["max_gathers"],
                                       a.bad_gathers, ck["args"]["seed"], ck["args"].get("norm", "max"))
    gathers = gathers[len(gathers) - int(a.tail * len(gathers)):][:a.max_gathers]

    pc = [predict_gather(model, g["x"], tta=a.tta, return_conf=True) for g in gathers]
    conf = np.concatenate([c for _, c in pc])
    cut = lambda q, c, t: np.where(c >= t, q, -1)
    pred = [cut(q, c, a.min_conf) for q, c in pc]
    smooth = [cut(smooth_picks(q), c, a.min_conf) for q, c in pc]
    smooth_all = np.concatenate([smooth_picks(q) for q, _ in pc])
    base = [sta_lta_pick(g["x"]) for g in gathers]
    y = np.concatenate([g["y"] for g in gathers])
    res = {"site": a.site, "gathers": len(gathers), "dt_ms": dt, "picks_beyond_window_dropped": nb,
           "unet": metrics(np.concatenate(pred), y, dt),
           "unet_median_smoothed": metrics(np.concatenate(smooth), y, dt), "sta_lta": metrics(np.concatenate(base), y, dt),
           "min_conf": a.min_conf,  # sweep is for choosing the cutoff on the validation site only
           "conf_sweep_smoothed": {t: metrics(cut(smooth_all, conf, t), y, dt) for t in (0, .2, .3, .4, .5, .6, .7, .8, .9)}}
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    (out / f"metrics_{a.site}.json").write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))

    # error histogram + a few example gathers
    pa = np.concatenate(pred); err = (pa - y)[(y >= 0) & (pa >= 0)]
    fig, ax = plt.subplots(1, 4, figsize=(20, 5))
    ax[0].hist(np.clip(err, -30, 30), 61); ax[0].set(title=f"{a.site}: pick error (samples, clipped ±30)", yscale="log")
    for k, i in enumerate(np.linspace(0, len(gathers) - 1, 3).astype(int)):
        g = gathers[i]
        ax[k + 1].imshow(g["x"].astype(np.float32).T, aspect="auto", cmap="gray", vmin=-0.3, vmax=0.3)
        lab = np.where(g["y"] >= 0, g["y"], np.nan)
        ax[k + 1].plot(lab, "g.", ms=3, label="label"); ax[k + 1].plot(np.where(smooth[i] >= 0, smooth[i], np.nan), "r.", ms=2, label="U-Net (smoothed)")
        ax[k + 1].set(title=f"gather {i}", xlabel="trace", ylabel="sample"); ax[k + 1].legend()
    fig.tight_layout(); fig.savefig(out / f"examples_{a.site}.png", dpi=90)


if __name__ == "__main__":
    main()
