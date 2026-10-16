"""The pricing study's analysis (../2026-10-16-pricing.md), over poe2scout daily exchange dumps.

Usage: python3 -I 2026-10-16-pricing.py <archive out dir>

The out dir holds one folder per league, each with the dump's daily_long.csv (category, api_id, date,
average price in exalts, volume). Prints three tables:
  1. the general price level by league day, in exalts (day 40 = 1), and the divine's price in exalts;
  2. the general level in divines by league day (day 21 = 1), to the league's last day;
  3. how far items of each price tier move against the general level, by day-40 and by day-7 price;
  4. the conversion itself: an item's day-7 and day-21 divine price over its day-40 one, by tier.
"""
import collections
import csv
import datetime as dt
import os
import statistics as st
import sys

LEAGUES = ['dawn-of-the-hunt', 'rise-of-the-abyssal', 'fate-of-the-vaal', 'runes-of-aldur', 'forbidden-rites']
DIVINE = 'currency:divine'
TIERS = [(0, 0.1), (0.1, 1), (1, 10), (10, 1e9)]
INDEX_DAYS = [3, 7, 14, 21, 28, 40]


def load(root, league):
    """{item key: {date: (average exalts, volume)}}, positive prices only."""
    series = collections.defaultdict(dict)
    with open(os.path.join(root, league, 'daily_long.csv')) as f:
        for r in csv.DictReader(f):
            a = float(r['average'] or 0)
            if a > 0:
                series[r['category'] + ':' + r['api_id']][dt.date.fromisoformat(r['date'])] = (a, float(r['volume'] or 0))
    return series


def px(series, key, d0, n, w=1):
    """An item's price on league day n: the median over days n-w..n+w, or None."""
    v = [series[key][d0 + dt.timedelta(days=i)][0] for i in range(n - w, n + w + 1)
         if d0 + dt.timedelta(days=i) in series[key]]
    return st.median(v) if v else None


def day0(series):
    """League day 0: the first date the divine traded."""
    return min(d for d, (a, v) in series[DIVINE].items() if v > 0)


def index_table(data):
    days, ref = INDEX_DAYS, 40
    print('1. general price level in exalts (median exchange item, day 40 = 1); n = items liquid on every day')
    print('league'.ljust(22), 'day 0'.ljust(11), 'n'.rjust(4), ' '.join(f'd{n:>5}' for n in days))
    divs = {}
    for lg, s in data.items():
        d0 = day0(s)
        liquid = [k for k in s if k != DIVINE and all(px(s, k, d0, n) for n in days)]
        idx = {n: st.median(px(s, k, d0, n) / px(s, k, d0, ref) for k in liquid) for n in days}
        divs[lg] = {n: px(s, DIVINE, d0, n) for n in days}
        print(lg.ljust(22), str(d0).ljust(11), str(len(liquid)).rjust(4), ' '.join(f'{idx[n]:6.2f}' for n in days))
    print('\n   the divine in exalts')
    for lg, dv in divs.items():
        print(lg.ljust(22), ' ' * 16, ' '.join(f'{dv[n]:6.0f}' for n in days))


def divine_level_table(data):
    days = [7, 14, 21, 40, 60, 90, 120]
    print('\n2. general level in divines (median item, day 21 = 1; items priced on day 21 and that day)')
    print('league'.ljust(22), ' '.join(f'd{n:>5}' for n in days), '   last day')
    for lg, s in data.items():
        d0 = day0(s)
        last = max(max(v) for v in s.values())
        end = (last - d0).days - 2
        dv21 = px(s, DIVINE, d0, 21)
        row = []
        for n in days + [end]:
            if n > end:
                row.append('     -')
                continue
            dvn = px(s, DIVINE, d0, n)
            r = [(px(s, k, d0, n) / dvn) / (px(s, k, d0, 21) / dv21)
                 for k in s if k != DIVINE and px(s, k, d0, n) and px(s, k, d0, 21)]
            row.append(f'{st.median(r):6.2f}')
        print(lg.ljust(22), ' '.join(row[:-1]), f'  {row[-1]} (d{end})')


def tier_table(data):
    def tname(t):
        return f'{t[0]}-{t[1] if t[1] < 1e9 else "+"}'
    res = {}
    for lg, s in data.items():
        d0 = day0(s)
        liquid = [k for k in s if k != DIVINE and all(px(s, k, d0, n) for n in INDEX_DAYS)]
        idx = {n: st.median(px(s, k, d0, n) / px(s, k, d0, 40) for k in liquid) for n in (7, 21)}
        div = {n: px(s, DIVINE, d0, n) for n in (7, 21, 40)}
        for by in (40, 7):
            for d in (7, 21):
                groups = {t: [] for t in TIERS}
                conv = {t: [] for t in TIERS}
                for k in s:
                    if k == DIVINE:
                        continue
                    a, b, c = px(s, k, d0, d), px(s, k, d0, 40), px(s, k, d0, by)
                    if not (a and b and c):
                        continue
                    if sum(v for dd, (p, v) in s[k].items() if 0 <= (dd - d0).days <= 41) < 100:
                        continue
                    t = next(t for t in TIERS if t[0] <= c / div[by] < t[1])
                    groups[t].append((a / b) / idx[d])
                    conv[t].append((a / b) * div[40] / div[d])
                for t in TIERS:
                    if len(groups[t]) >= 3:
                        res.setdefault((by, d, t), {})[lg] = (st.median(groups[t]), len(groups[t]))
                        res.setdefault(('conv', by, d, t), {})[lg] = (st.median(conv[t]), len(conv[t]))
    for by in (40, 7):
        for d in (7, 21):
            print(f'\n3. day-{d} price / day-40 price, against the general level; items grouped by day-{by} price (div)')
            print('tier'.ljust(9), ' '.join(lg[:10].rjust(12) for lg in data), '  median')
            for t in TIERS:
                r = res.get((by, d, t), {})
                cells = [f'{r[lg][0]:5.2f} ({r[lg][1]:>3})' if lg in r else ' ' * 11 for lg in data]
                med = st.median(v[0] for v in r.values()) if r else float('nan')
                print(tname(t).ljust(9), ' '.join(c.rjust(12) for c in cells), f'  {med:5.2f}')
    for d in (7, 21):
        print(f'\n4. conversion: an item\'s day-{d} divine price / its day-40 divine price; items grouped by day-40 price')
        print('tier'.ljust(9), ' '.join(lg[:10].rjust(12) for lg in data), '  median')
        for t in TIERS:
            r = res.get(('conv', 40, d, t), {})
            cells = [f'{r[lg][0]:5.2f} ({r[lg][1]:>3})' if lg in r else ' ' * 11 for lg in data]
            med = st.median(v[0] for v in r.values()) if r else float('nan')
            print(tname(t).ljust(9), ' '.join(c.rjust(12) for c in cells), f'  {med:5.2f}')


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    data = {lg: load(sys.argv[1], lg) for lg in LEAGUES}
    index_table(data)
    divine_level_table(data)
    tier_table(data)


if __name__ == '__main__':
    main()
