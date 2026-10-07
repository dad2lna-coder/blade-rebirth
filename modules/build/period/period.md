# Period dates

`dates.js` is the only file here. There is no `SetupPanel.svelte`.

The Build form owns the inputs (`startDate`, `weekCount`, `generateSeed`, open/close). This module only parses and steps dates.

| Export | Job |
| --- | --- |
| `now` | Current date |
| `parseStartDate` | Form or import value → date. Accepts a Luxon-like object when one is present. Luxon is not a dependency. |
| `toDateInputValue` | Date → `YYYY-MM-DD` for `<input type="date">` |
| `addDays` | Date plus N days |
| `weekdaySun0` | Sunday = 0 |
| `dj` | Alias used by older call sites |

Used by `sessionIo.js`, `BuildPanel.svelte`, `schedule/buildScheduleForLine.js`, and `function-coverage/attach.js` (`addDays`, `weekdaySun0` copied onto the session).

Ship does not use this module. `modules/ship/ebid.js` has its own `toIsoDate`, `addDaysIso`, and `weekdaySun0`.
