# Performance

Measured against a production build (`next start`) and a separate SQLite file. The demo seed is still 67 issues. This dataset is project `PERF`: 500 issues, 125 in each status, priorities cycling through none, low, medium, high, and urgent (100 high). Titles are `Perf 001` through `Perf 500`.

```bash
npm run db:perf
DATABASE_URL=file:./perf.db npx next start -p 3200
PERF_BASE_URL=http://127.0.0.1:3200 npx tsx scripts/measure-perf.ts
```

Viewport 1440×900, Chromium. Each figure below is from that run.

## Board load

Wall clock is navigation to `/p/PERF?all=1` until the Todo heading and `Perf 002` are visible. `loadEventEnd` is the document's own timing. Every run counted 500 issues on the board.

| Run | Wall clock | DOMContentLoaded | loadEventEnd | Transfer |
| --- | ---: | ---: | ---: | ---: |
| 1 | 507 ms | 115 ms | 116 ms | 45,072 bytes |
| 2 | 528 ms | 126 ms | 127 ms | 45,071 bytes |
| 3 | 445 ms | 115 ms | 115 ms | 45,071 bytes |

Median wall clock: **507 ms**.

## Filter response

Keyword search fills `Perf 250` and waits until that card is the one on screen. The field waits 200 ms before it writes the query, so the wall clock includes the debounce. Each run showed 1 issue.

| Run | Wall clock |
| --- | ---: |
| 1 | 301 ms |
| 2 | 299 ms |
| 3 | 286 ms |

Median: **299 ms**. About 100 ms of that is after the debounce.

Priority filter clicks High and waits until the URL contains `priority=high` and `Perf 004` is visible. Each run showed 100 issues, which is the high-priority count in the dataset.

| Run | Wall clock |
| --- | ---: |
| 1 | 153 ms |
| 2 | 151 ms |
| 3 | 147 ms |

Median: **151 ms**.

## Drag

`Perf 002` and then `Perf 006` were dragged from Todo to Done, 24 pointer steps each. Frame gaps come from `requestAnimationFrame` during the gesture. Settle is pointer-up until the card is in Done.

| Card | Gesture | Settle | Frames | p50 gap | p95 gap | max gap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Perf 002 | 564 ms | 27 ms | 38 | 16.7 ms | 33.3 ms | 33.4 ms |
| Perf 006 | 534 ms | 26 ms | 38 | 16.7 ms | 16.8 ms | 16.8 ms |

16.7 ms is one frame at 60 Hz. The first drag dropped a single frame. Both cards were in Done within 27 ms of release.

## What was changed

A card body does not re-render when its issue, selection, and drag placeholder are unchanged, so the other cards' contents stay put while one card is dragged. Column hit testing still looks at the four columns. These timings are from that build. The board is on screen in about half a second, both filters return in well under a second, and the drag stays on a 60 Hz frame, so the columns were not virtualized.
