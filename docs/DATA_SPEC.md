# DATA_SPEC.md

Synthetic data for the demo. Deterministic for a given seed. Shop-level data is fictional.

## Parameters
`SHOPS` (default 500, max 17000), `WEEKS` (12), `SEED` (42), `START_DATE` (2026-08-17, a Monday). Weeks are Mondays. The target week is the last one.

## Entities
- **Districts:** a short list of Gujarat district names (Ahmedabad, Surat, Vadodara, Rajkot, Mehsana, Bhavnagar, Jamnagar, Gandhinagar). Talukas are named `<District> Taluka 1..N`, about 8 to 12 shops per taluka at 500 shops, scaled up with `SHOPS`. Shop IDs `FPS-00001`. Names `Shop FPS-00001`. No real shop names.
- **cards_count:** lognormal, median about 350, clipped 120 to 900 (assumption).
- **vulnerability_index:** Beta(2, 6), range 0 to 1 (assumption A-005).

## Weekly record (clean shop)
Fields: `transactions, auth_attempts, auth_failures, unauth_sales, complaints_count, stock_opening_kg, stock_received_kg, stock_sold_kg, stock_closing_kg, board_distributed_kg`.
- `transactions` about Binomial(cards_count, 0.25).
- `auth_attempts` = transactions + failed attempts (retries); `auth_failure rate` about 30% with shop-level and weekly noise (A-003).
- `unauth_sales`: a small share of transactions (about 2 to 4%) so the fallback path exists in clean shops too.
- `stock_sold_kg` = transactions x about 20 kg with noise (assumption).
- `stock_received_kg` tracks expected demand with noise; `stock_opening_kg` of week n is `stock_closing_kg` of week n-1.
- `stock_closing_kg` = opening + received - sold (clean shops: add small noise so abs gap is usually under 1.5%).
- `board_distributed_kg` = sold with small noise (abs mismatch usually under 3%).
- `complaints_count`: Poisson with a low rate per 100 transactions; each complaint gets a category: denied ration, short weight, extra money, poor quality, shop closed (A-004).

## Planted scenarios
Effects start 4 weeks before the target week and strengthen toward it, unless stated. Counts: `max(3, round(share x SHOPS))`. Chosen with the seed, never in the outage taluka.

| id | share | effect | positive |
|---|---|---|---|
| S1 stock diversion | 1% | closing stock lower than records imply by 8 to 15% of (opening + received) | yes |
| S2 board mismatch | 1% | `board_distributed_kg` = sold x 1.15 to 1.35 | yes |
| S3 override-heavy | 1% | `unauth_share` = 3x taluka peer median (cap 0.6); auth failures rise consistently | yes |
| S4 complaint spike | 1% | complaints 4 to 6x peer median in the last 3 weeks, mostly denied ration and short weight | yes |
| S5 severe multi-signal | 0.5% | S1 + S3 + S4 at higher intensity | yes |
| S6 vulnerable, mild | 0.5% | `vulnerability_index` >= 0.8 plus mild stock gap of 3 to 5% | yes |
| S7 outage trap | 1 taluka | in the last 2 weeks every shop in the taluka gets +20 to +30 percentage points auth failure and a proportional rise in unauth sales | no |
| S8 clean | rest | none | no |

## Ground truth
Table `ground_truth(shop_id, scenario, is_positive)`. Used only by `evaluate.py` and tests. Never returned by shop-level API endpoints or shown in the UI.

## Outputs of `make data`
- SQLite file at `data/pds.db` (gitignored).
- A printed summary: counts per scenario, the outage taluka, and the planted shop IDs per scenario. Also write it to `data/planted.json` (gitignored) so `docs/DEMO.md` can reference real IDs.

## Tests
Determinism (same seed, same data); planted counts; outage taluka effect present and no planted shops inside it; value ranges (rates in 0..1, stocks non-negative); stock chain (opening of week n equals closing of n-1).
