# The model: radar-2, a calibrated peer multiple

The board answers one question: if a protocol issued a token tomorrow and the
market priced it the way it prices the tokens that already trade, what would
that token be worth? The answer is built from the snapshot alone — no prices
are fetched at run time, no protocol name is ever special-cased, and the same
function scores every row.

## 1. The peer multiple

The base multiple is not a guess. It is calibrated from the protocols in the
same snapshot whose tokens already trade: for each category, the model takes
the median market-cap-to-TVL ratio of its live-token peers. A category needs
at least five peers to earn its own median; a thinner category falls back to
the median across every live-token protocol. So a lending protocol is priced
the way lending tokens trade, a DEX the way DEX tokens trade, and a category
with no real peer group is priced like the market as a whole.

On the sealed snapshot this gives a global multiple of 0.2138 from 128 live
peers, and nine categories of their own — Lending 0.1324 (15 peers), Dexs
0.3424 (11), RWA 0.2748 (9), Basis Trading 0.6544 (7). The multiple is
clamped to [0.02, 1.5] so one outlier peer can neither bankrupt a row nor
crown it: the base value is `TVL × multiple`.

The calibration is recomputed from the snapshot on every run. Nothing about
it is hard-coded, so the same code scores a future snapshot with whatever
peers that snapshot carries.

## 2. The three adjustments

Three multipliers shape the base value, each from the protocol's own record:

- **Growth.** The 7-day TVL change, clamped to [-60, +120] percent, counts
  at half weight: `1 + (growth / 100) × 0.5`. A protocol up 20% in a week
  gets a 1.10 multiplier; one down 40% gets 0.80. The clamp stops a single
  wild week — a launch spike or a TVL flight — from deciding a rank.
- **Maturity.** Age is the time since DefiLlama first listed the protocol:
  `0.6 + min(age_days, 1095) / 1095 × 0.4`. A protocol listed yesterday
  scores 0.6; one that has run three tokenless years scores the full 1.0.
  Age is the best record of how long a protocol has operated with no token,
  so surviving longer earns a higher value. When no listing date is recorded
  the model assumes 365 days rather than guessing zero or the maximum.
- **Reach.** Each extra chain adds 2%: `1 + 0.02 × min(chains - 1, 10)`,
  capped at 1.20 for eleven chains or more. A protocol live on many chains
  has more users to airdrop to and more surface to farm, but the cap keeps
  chain-counting from swamping the value itself.

The implied value is `max(1, round(TVL × multiple × growth × maturity ×
chains))`, a whole number of dollars, never zero.

## 3. What the board refuses to rank

A row must be a protocol still waiting on a launch of its own. That means
pre-token — no market cap, no CoinGecko id, no symbol — and not a wrapped,
staked or bridged product of a token that already trades. WBTC is Bitcoin on
Ethereum, Binance staked ETH is ETH inside Binance's staking product, and a
"V2" pool is a version of another protocol's pool; none of them is a launch
that has not happened yet. The board applies the house watchlist's own
exclusion to every row: the Bridge, Canonical Bridge, Liquid Staking, Liquid
Restaking, Restaked BTC and CEX categories, names carrying the words wrapped,
staked or staking, names ending in a version marker, and names beginning with
an exchange's name are all left out, whatever their TVL.

## 4. Worked example: rank 1

Steakhouse Financial tops the board on the sealed snapshot. It holds
$2,753,981,495 of TVL in the Risk Curators category, which has too few
live-token peers for its own median, so it takes the global multiple of
0.2138. It is 543 days old (maturity 0.7984), its TVL fell 2.19% in the last
week (growth 0.989), and it runs on eleven chains (reach 1.20):

    2,753,981,495 × 0.2138 × 0.989 × 0.7984 × 1.20 ≈ $557,901,091

That is the board's whole claim: a token for Steakhouse Financial, priced
the way the market prices comparable tokens today, would be worth about
$558 million. The board ranks 198 protocols this way — the 40 on the
watchlist plus 158 more pre-token protocols below the floor — while the 24
largest live-token protocols are set aside and shown with the market's own
values, never mixed into the ranking.
