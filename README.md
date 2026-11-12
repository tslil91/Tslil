# First-break picking (HardPicks)

A 2D U-Net picks the first break on every trace of a shot gather. It is trained and tested on the
[HardPicks](https://github.com/mila-iqia/hardpicks) hard-rock surveys (Brunswick, Halfmile, Lalor, Sudbury).

- **Input:** one gather (shot × receiver line), traces sorted by receiver, first 512 samples, each trace normalised.
- **Output:** for each trace, a softmax over time samples. The pick is the argmax.
- **Loss:** cross-entropy against the labelled pick sample. Traces without a label are ignored.
- **Baseline:** a classical STA/LTA picker, so the U-Net numbers can be compared against something.

## Run

```bash
pip install torch h5py numpy matplotlib pyyaml
./download.sh                     # about 10+ GB of HDF5 into ./data
cd fbp
python train.py --data-dir ../data --bad-gathers ../data/bad-gather-ids_combined.yaml \
       --train Lalor Brunswick --valid Sudbury --out ../runs/model.pt
python evaluate.py --data-dir ../data --bad-gathers ../data/bad-gather-ids_combined.yaml \
       --model ../runs/model.pt --site Halfmile --out ../runs/eval
python test_smoke.py              # self-check on a synthetic survey (no download needed)
```

The default split is the paper's "Fold Halfmile": train on Lalor + Brunswick, validate on Sudbury, and
test on Halfmile, which the model never sees during training.

## How to read the results (`runs/eval/metrics_<site>.json`)

| Metric | Meaning |
|---|---|
| `HR@kpx` | Fraction of traces whose pick is within k samples of the label. This is the paper's main metric. |
| `MAE`, `RMSE` | Mean absolute error and root-mean-square error, in samples and in ms. |
| `MBE` | Mean bias error: below 0 means the model picks early, above 0 means it picks late. |

`examples_<site>.png` shows the error histogram and three gathers, with the labelled picks in green
and the predicted picks in red.

## Simplifications vs. the paper

- The network is a small U-Net (16 base channels) trained on CPU, not the paper's ResNet/EfficientNet encoders.
- By default each site is subsampled to 3000 gathers (`--max-gathers`).
- Only the first 512 samples are used. Labels beyond that window are dropped, and the number dropped is reported.
- Only one fold is run by default. For the paper's full 4-fold cross-validation, change `--train/--valid/--site`.
