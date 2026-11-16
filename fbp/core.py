"""First-break picking on HardPicks HDF5 data: loading, model, metrics, baseline."""
import numpy as np
import h5py
import torch
import torch.nn as nn
import torch.nn.functional as F

# name -> (file, first-break header field, receiver-peg line digits); from hardpicks site_info.py
SITES = {
    "Brunswick": ("Brunswick_orig_1500ms_V2.hdf5", "SPARE1", 3),
    "Halfmile": ("Halfmile3D_add_geom_sorted.hdf5", "SPARE1", 4),
    "Lalor": ("Lalor_raw_z_1500ms_norp_geom_v3.hdf5", "SPARE2", 3),
    "Sudbury": ("preprocessed_Sudbury3D.hdf", "SPARE1", 3),
}


def load_site(path, fb_field, line_digits, n_samples=512, max_gathers=None,
              bad_gathers=(), seed=0, chunk=100_000):
    """Return (gathers, dt_ms, n_beyond). Each gather is a dict(x=[N,T] float16, y=[N] int, -1 = no label).

    A gather = one shot x one receiver line, traces ordered by receiver peg (as in the paper).
    Only the first `n_samples` samples are kept; picks beyond that are counted in n_beyond and dropped.
    """
    with h5py.File(path, "r") as f:
        h = f["TRACE_DATA/DEFAULT"]
        dt_ms = float(np.unique(h["SAMP_RATE"][:])[0]) / 1000.0
        shot = h["SHOT_PEG"][:].ravel().astype(np.int64)
        if np.unique(shot).size == 1:  # broken pegs on Sudbury, same fallback as hardpicks
            shot = h["SHOTID"][:].ravel().astype(np.int64)
        rec = h["REC_PEG"][:].ravel().astype(np.int64)
        line = rec // 10 ** line_digits
        fb_ms = h[fb_field][:].ravel().astype(np.float64)
        y = np.where(fb_ms > 0, np.rint(fb_ms / dt_ms), -1).astype(np.int64)
        n_beyond = int(((y >= n_samples)).sum())
        y[y >= n_samples] = -1

        order = np.lexsort((rec, line, shot))
        keys = np.stack([shot[order], line[order]], 1)
        starts = np.flatnonzero(np.r_[True, (keys[1:] != keys[:-1]).any(1)])
        groups = np.split(order, starts[1:])
        bad = set(bad_gathers)
        groups = [g for g in groups if (shot[g[0]], line[g[0]]) not in bad and (y[g] >= 0).sum() >= 8]
        if max_gathers and len(groups) > max_gathers:
            rng = np.random.default_rng(seed)
            groups = [groups[i] for i in sorted(rng.choice(len(groups), max_gathers, replace=False))]

        keep = np.zeros(len(shot), bool)
        for g in groups:
            keep[g] = True
        data = h["data_array"]
        T = min(n_samples, data.shape[1])
        pos = np.cumsum(keep) - 1  # row of each kept trace in the compact array
        x = np.zeros((keep.sum(), T), np.float16)
        for s in range(0, len(shot), chunk):  # contiguous reads; fancy indexing in h5py is very slow
            m = keep[s:s + chunk]
            if m.any():
                block = data[s:s + chunk, :T].astype(np.float32)[m]
                block /= np.abs(block).max(1, keepdims=True) + 1e-12  # per-trace normalisation
                x[pos[s:s + chunk][m]] = block
    return [dict(x=x[pos[g]], y=y[g]) for g in groups], dt_ms, n_beyond


def robust_clip(x, c=2.0, q=95):
    """Scale each trace by its q-th percentile |amplitude|, clip at +-c of that.

    Spikes covering < (100-q)% of samples can't set the scale, unlike max-abs or RMS. Scale-invariant,
    so applying it to the max-abs-normalised cache equals applying it to raw data.
    """
    x = x.astype(np.float32)
    x /= np.percentile(np.abs(x), q, axis=1, keepdims=True) + 1e-12
    return (np.clip(x, -c, c) / c).astype(np.float16)


def load_site_cached(data_dir, site, samples=512, n=3000, bad_yaml="", seed=0, norm="max"):
    """load_site on a random subset of n gathers, cached as <data_dir>/cache_<site>.npz.

    Lets the multi-GB HDF5 be deleted after the first run. Cache is keyed by site only: delete it if
    you change samples/n/seed.
    """
    from pathlib import Path
    d = Path(data_dir); cache = d / f"cache_{site}.npz"
    if not cache.exists():
        f, field, digits = SITES[site]
        bad = bad_gather_keys(bad_yaml, site, digits) if bad_yaml else ()
        g, dt, nb = load_site(d / f, field, digits, samples, n, bad, seed)
        lens = np.array([len(x["y"]) for x in g])
        np.savez(cache, x=np.concatenate([x["x"] for x in g]), y=np.concatenate([x["y"] for x in g]),
                 lens=lens, dt=dt, nb=nb)
    z = np.load(cache)
    x, y, lens = z["x"], z["y"], z["lens"]  # NpzFile re-reads on every access, so load once
    if norm == "robust":
        x = np.concatenate([robust_clip(x[i:i + 100_000]) for i in range(0, len(x), 100_000)])  # chunks bound RAM
    ends = np.cumsum(lens)
    return ([dict(x=x[e - n:e], y=y[e - n:e]) for e, n in zip(ends, lens)], float(z["dt"]), int(z["nb"]))


def bad_gather_keys(yaml_path, site, line_digits):
    import yaml
    d = (yaml.safe_load(open(yaml_path)) or {}).get(site) or {}
    return {(v["ShotId"], v["ReceiverId"] // 10 ** line_digits) for v in d.values()}


class UNet(nn.Module):
    """Small 2D U-Net over a gather (traces x time). Output: per-trace logits over time samples."""

    def __init__(self, c=16, depth=4):
        super().__init__()
        block = lambda i, o: nn.Sequential(
            nn.Conv2d(i, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU(inplace=True),
            nn.Conv2d(o, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU(inplace=True))
        ch = [c * 2 ** i for i in range(depth + 1)]
        self.down = nn.ModuleList([block(1, ch[0])] + [block(ch[i], ch[i + 1]) for i in range(depth)])
        self.up = nn.ModuleList([nn.ConvTranspose2d(ch[i + 1], ch[i], 2, 2) for i in range(depth)])
        self.dec = nn.ModuleList([block(2 * ch[i], ch[i]) for i in range(depth)])
        self.out = nn.Conv2d(ch[0], 1, 1)
        self.mult = 2 ** depth

    def forward(self, x):  # x: [B, W(traces), T]
        B, W, T = x.shape
        pw, pt = -W % self.mult, -T % self.mult
        h = F.pad(x[:, None], (0, pt, 0, pw))
        skips = []
        for i, d in enumerate(self.down):
            h = d(h if i == 0 else F.max_pool2d(h, 2))
            skips.append(h)
        for i in reversed(range(len(self.up))):
            h = self.dec[i](torch.cat([self.up[i](h), skips[i]], 1))
        return self.out(h)[:, 0, :W, :T]


@torch.no_grad()
def predict_gather(model, x, batch_traces=1024, tta=False):
    """x: [N,T] array -> predicted pick index per trace. tta: average over reversed + polarity-flipped copies."""
    model.eval()
    t = torch.from_numpy(np.asarray(x, np.float32))
    prob = lambda a: torch.cat([model(a[i:i + batch_traces][None]).softmax(-1)[0] for i in range(0, len(a), batch_traces)])
    p = prob(t)
    if tta:  # shortcut: 3 views only, more views give diminishing returns
        p = (p + prob(t.flip(0)).flip(0) + prob(-t)) / 3
    return p.argmax(-1).numpy()


def smooth_picks(p, win=9, thr=10):
    """Replace a pick by the median of its `win` neighbouring traces if it deviates by more than `thr` samples."""
    p = np.asarray(p)
    med = np.median(np.lib.stride_tricks.sliding_window_view(np.pad(p, win // 2, mode="edge"), win), 1)
    return np.where(np.abs(p - med) > thr, med, p).astype(p.dtype)


def sta_lta_pick(x, sta=5, lta=40):
    """Classical baseline: argmax of STA/LTA energy ratio per trace."""
    e = np.asarray(x, np.float32) ** 2
    c = np.cumsum(np.pad(e, ((0, 0), (lta, sta))), 1)
    n = e.shape[1]
    i = np.arange(n) + lta
    s = (c[:, i + sta] - c[:, i]) / sta
    l = (c[:, i] - c[:, i - lta]) / lta
    return np.argmax(s / (l + 1e-3 * e.mean(1, keepdims=True) + 1e-12), 1)


def metrics(pred, true, dt_ms):
    """Benchmark metrics from the HardPicks paper: hit rates within k samples, MAE/RMSE/MBE."""
    m = true >= 0
    err = (pred[m] - true[m]).astype(np.float64)
    a = np.abs(err)
    r = {f"HR@{k}px": float((a <= k).mean()) for k in (1, 3, 5, 7, 9)}
    r.update(MAE_px=a.mean(), RMSE_px=np.sqrt((err ** 2).mean()), MBE_px=err.mean(),
             MAE_ms=a.mean() * dt_ms, RMSE_ms=np.sqrt((err ** 2).mean()) * dt_ms, n_traces=int(m.sum()))
    return {k: float(v) for k, v in r.items()}
