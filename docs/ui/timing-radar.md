# Static Timing Analysis & Timing Radar

Axiom EDA incorporates a full-featured Static Timing Analysis (STA) engine and interactive Timing Radar visualizer (`crates/sta`). It performs topological path propagation across synthesizable netlists, calculates setup and hold slack against target clock constraints, and identifies critical path bottlenecks before physical implementation.

---

## Static Timing Engine Architecture

The STA engine decomposes the netlist into a Directed Acyclic Graph (DAG) of timing nodes and edges:
- **Timing Nodes**: Gate pins, flip-flop inputs (`D`, `CE`, `R`), flip-flop outputs (`Q`), and primary I/O ports.
- **Timing Edges**: Cell propagation delays ($t_{\text{logic}}$) and net routing delays ($t_{\text{route}}$).

### Timing Slack Formulation
For each path originating from a source flip-flop ($FF_1$) and terminating at a destination flip-flop ($FF_2$):
$$\text{Data Arrival Time} = T_{\text{clk1}} + t_{\text{cq}} + t_{\text{logic}} + t_{\text{route}}$$
$$\text{Data Required Time} = T_{\text{period}} + T_{\text{clk2}} - t_{\text{setup}} - t_{\text{skew}} - t_{\text{jitter}}$$
$$\text{Setup Slack} = \text{Data Required Time} - \text{Data Arrival Time}$$

A path meets timing when $\text{Slack} \ge 0$. A negative slack ($\text{Slack} < 0$) indicates a timing violation requiring logic reduction or pipeline insertion.

---

## The Timing Radar Dashboard

The Timing Radar view presents an executive overview of design performance:

```
+-------------------------------------------------------------------------------+
| Timing Radar: Target Clock = 100.0 MHz (Period: 10.0 ns)                      |
| Worst Negative Slack (WNS): +1.42 ns (MET) | Total Negative Slack (TNS): 0.00 |
+-------------------------------------------------------------------------------+
| Critical Path Timing Waterfall:                                               |
| Hop | Element                 | Delay (ps) | Incr (ps) | Total Arrival (ns)   |
|-----+-------------------------+------------+-----------+----------------------|
| 1   | reg_a_reg[3]/C -> Q     | 240 ps     | +240 ps   | 0.240 ns             |
| 2   | net_wire_1 (route)      | 350 ps     | +350 ps   | 0.590 ns             |
| 3   | alu_inst/lut_add_3/I0->O| 480 ps     | +480 ps   | 1.070 ns             |
| 4   | net_sum_3 (route)       | 520 ps     | +520 ps   | 1.590 ns             |
| 5   | reg_result_reg[3]/D     | setup check|           | Required: 8.580 ns   |
+-------------------------------------------------------------------------------+
| Slack Distribution Histogram: [ -2ns | -1ns | 0ns | +1ns | +2ns | +3ns ]      |
+-------------------------------------------------------------------------------+
```

### 1. Timing KPIs
- **Worst Negative Slack (WNS)**: The worst-case slack across all timing endpoints. If WNS is negative, the design cannot run at the target clock frequency.
- **Total Negative Slack (TNS)**: Sum of all negative slacks across all violating endpoints, indicating the severity of design-wide timing pressure.
- **Failing Endpoints**: Number of registers or primary outputs failing setup or hold requirements.

### 2. Critical Path Waterfall Table
Displays the exact physical sequence of cell logic transitions and interconnect routing hops contributing to the longest propagation delay. Each row lists element name, incremental delay, cumulative arrival time, and remaining slack budget.

### 3. Slack Distribution Histogram
Visualizes the statistical spread of endpoint slacks across the design. Bins to the left of the 0 ns line highlight violating paths requiring optimization.

---

## Clock Domain Crossing (CDC) Synchronizers

The STA engine automatically analyzes designs with multiple asynchronous clock domains:
- Detects unregistered signal crossings between unrelated clocks.
- Identifies and verifies 2-stage and 3-stage flip-flop synchronizers (`cdc_sync`).
- Flags unconstrained CDC paths as high-risk metastability hazards.
