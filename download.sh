#!/usr/bin/env bash
# Downloads the HardPicks HDF5 surveys (hosted by NRCan on AWS) + the benchmark's bad-gather list into ./data
set -euo pipefail
mkdir -p data && cd data
base=https://d3sakqnghgsk6x.cloudfront.net
for f in Brunswick_3D/Brunswick_orig_1500ms_V2.hdf5 Halfmile_3D/Halfmile3D_add_geom_sorted.hdf5 \
         Lalor_3D/Lalor_raw_z_1500ms_norp_geom_v3.hdf5 Sudbury_3D/preprocessed_Sudbury3D.hdf; do
  n=$(basename "$f")
  [ -f "$n" ] || curl -fL --retry 4 "$base/$f.xz" | xz -d > "$n.part" && mv "$n.part" "$n"
done
curl -fsSL -o bad-gather-ids_combined.yaml \
  https://raw.githubusercontent.com/mila-iqia/hardpicks/master/data/fbp/bad_gathers/bad-gather-ids_combined.yaml
