## 3. Primary Data Flows (Updated)

### Data Flow Pattern
1. **Input Phase** (Build stage):
   - User enters period, seed, FTE, coverage, cert pools, shifts via BuildPanel
   - Data flows to `session.state` via `sessionIo.applySession()`
   - `setupStore` mirrors critical state for quick access

2. **Generation Phase** (Build stage):
   - `generate(S)` orchestrates setup reads → validation → allocation → line building → schedule building → team formation → UI refresh
   - Heavy logic extracted to dedicated modules (`buildScheduleForLine.js`, `formExtraTeams.js`, `validateGenerateInputs.js`)
   - Lines stored in `session.state.lines`, Schedule/RDO patterns in `session.state.schedule`

3. **Analysis Phase** (Review stage):
   - LinesPanel reads `session.state.lines` and `session.state.schedule`
   - CoveragePanel calculates coverage from lines + function assignments
   - ReportsPanel aggregates statistics from session state

4. **Mutation Phase**:
   - ParityReport: analyzes lines for RDO disparities → returns proposals
   - User approves swaps → `approveParitySwaps()` updates RDO patterns
   - DFO Certificate Balance: analyzes certification needs → returns proposals
   - User approves moves → `approveDfoCertBalance()` updates assignments

5. **Export Phase** (Ship stage):
   - `sessionIo.exportSession()` serializes full session to JSON
   - ShipPanel transforms lines to eBid 45-column CSV format