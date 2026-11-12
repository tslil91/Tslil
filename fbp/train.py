"""Train the U-Net picker on some HardPicks sites, keep the checkpoint with best validation HR@1px."""
import argparse, json, time
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F
from core import SITES, load_site, bad_gather_keys, UNet, predict_gather, metrics


def load(args, site, max_gathers):
    f, field, digits = SITES[site]
    bad = bad_gather_keys(args.bad_gathers, site, digits) if args.bad_gathers else ()
    g, dt, nb = load_site(Path(args.data_dir) / f, field, digits, args.samples, max_gathers, bad, args.seed)
    print(f"{site}: {len(g)} gathers, {sum(len(x['y']) for x in g)} traces, dt={dt}ms, "
          f"{nb} picks beyond {args.samples} samples dropped", flush=True)
    return g, dt


def batch(gathers, rng, bs, width):
    xs, ys = [], []
    for _ in range(bs):
        g = gathers[rng.integers(len(gathers))]
        n = len(g["y"])
        s = rng.integers(max(1, n - width + 1))
        x, y = g["x"][s:s + width].astype(np.float32), g["y"][s:s + width].copy()
        if len(y) < width:  # pad short gathers with dead, unlabeled traces
            x = np.pad(x, ((0, width - len(y)), (0, 0)))
            y = np.pad(y, (0, width - len(y)), constant_values=-1)
        if rng.random() < 0.5:  # augment: reverse trace order
            x, y = x[::-1], y[::-1]
        if rng.random() < 0.1:  # augment: kill (zero) some traces, as hardpicks does
            k = rng.random(width) < 0.1
            x[k], y[k] = 0, -1
        xs.append(x * np.float32(rng.choice([-1, 1]))), ys.append(y)  # polarity flip
    return torch.from_numpy(np.ascontiguousarray(xs)), torch.from_numpy(np.ascontiguousarray(ys))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", default="data")
    p.add_argument("--bad-gathers", default="data/bad-gather-ids_combined.yaml")
    p.add_argument("--train", nargs="+", default=["Lalor", "Brunswick"])
    p.add_argument("--valid", default="Sudbury")
    p.add_argument("--samples", type=int, default=512)
    p.add_argument("--max-gathers", type=int, default=3000, help="per site, keeps RAM/CPU time bounded")
    p.add_argument("--steps", type=int, default=6000)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--width", type=int, default=64, help="traces per training patch")
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--out", default="runs/model.pt")
    a = p.parse_args()
    torch.manual_seed(a.seed)
    rng = np.random.default_rng(a.seed)

    train = sum((load(a, s, a.max_gathers)[0] for s in a.train), [])
    valid, vdt = load(a, a.valid, 200)
    model = UNet()
    opt = torch.optim.AdamW(model.parameters(), a.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, a.lr, total_steps=a.steps)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    best, t0, log = -1, time.time(), []
    for step in range(1, a.steps + 1):
        model.train()
        x, y = batch(train, rng, a.batch, a.width)
        logits = model(x)  # [B, W, T]: per trace, a distribution over the pick sample
        loss = F.cross_entropy(logits.flatten(0, 1), y.flatten(), ignore_index=-1)
        opt.zero_grad(); loss.backward(); opt.step(); sched.step()
        if step % 500 == 0 or step == a.steps:
            pr = np.concatenate([predict_gather(model, g["x"]) for g in valid])
            m = metrics(pr, np.concatenate([g["y"] for g in valid]), vdt)
            log.append(dict(step=step, loss=loss.item(), **m))
            print(f"step {step} loss {loss.item():.3f} valid HR@1 {m['HR@1px']:.3f} HR@5 {m['HR@5px']:.3f} "
                  f"MAE {m['MAE_px']:.2f}px  {time.time() - t0:.0f}s", flush=True)
            if m["HR@1px"] > best:
                best = m["HR@1px"]
                torch.save(dict(model=model.state_dict(), args=vars(a)), a.out)
    Path(a.out).with_suffix(".log.json").write_text(json.dumps(log, indent=1))


if __name__ == "__main__":
    main()
