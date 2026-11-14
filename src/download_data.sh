#!/usr/bin/env bash
# Télécharge le dump BoardGameGeek publié par TidyTuesday (édition 2022-01-25) dans data/raw/.
# Données BGG : usage non commercial, citer BoardGameGeek comme source.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
base="https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2022/2022-01-25"
for f in details.csv ratings.csv; do
  curl -sSfL -o "data/raw/$f" "$base/$f"
done
ls -l data/raw
