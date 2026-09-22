# Synthesis Floorplanning & Die Layout Studio

Axiom EDA features an interactive 2D Silicon Die Floorplanning Studio (`crates/ir/src/floorplan/`, `FloorplanStudioViewer.tsx`). It visualizes physical cell placement, silicon site grids, interconnect flightlines, and thermal/density heatmaps on actual FPGA die layouts.

---

## FPGA Silicon Die Architecture Grid

The floorplanner renders the exact site layout of the target FPGA architecture:

```
+-------------------------------------------------------------------------------+
| Top I/O Bank (IOB)                                                            |
+---+-----------------------------------------------------------------------+---+
| L | CLB Slice Grid (SliceL / SliceM)   | DSP Column | BRAM Column         | R |
| e | [x][x][x][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | i |
| f | [x][x][ ][ ][ ][ ][x][x][x]        | [DSP48E2]  | [RAMB36E2]          | g |
| t |------------------------------------+------------+---------------------| h |
|   | Global Clock Center Spine (BUFG / Clock Center)                       | t |
| I |------------------------------------+------------+---------------------|   |
| O | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | I |
| B | [x][x][x][x][ ][ ][ ][x][x]        | [DSP48E2]  | [RAMB36E2]          | O |
+---+-----------------------------------------------------------------------+---+
| Bottom I/O Bank (IOB)                                                         |
+-------------------------------------------------------------------------------+
```

### Die Site Types
- **CLB Slices (SliceL & SliceM)**: Logic slices containing LUTs and flip-flops. SliceM sites additionally support distributed RAM and shift registers (SRL).
- **DSP Columns**: Dedicated multi-tile columns housing high-speed `DSP48E2` arithmetic blocks.
- **Block RAM Columns**: Vertical columns reserved for `RAMB36E2` and `RAMB18E2` embedded memories.
- **Perimeter I/O Banks**: Left, Right, Top, and Bottom I/O buffers (`IOB`) connecting package pins to internal logic.
- **Clock Spine**: Central horizontal distribution track hosting `BUFG` and clock routing networks.

---

## Analytical Placer (HPWL) & Carry Clustering

The synthesis placer computes optimal $(x, y)$ coordinates for every cell using analytical quadratic placement and Half-Perimeter Wire Length (HPWL) minimization:
$$\text{HPWL}(e) = \max_{v \in e}(x_v) - \min_{v \in e}(x_v) + \max_{v \in e}(y_v) - \min_{v \in e}(y_v)$$

### Vertical Carry-Chain Column Clustering
Arithmetic macros requiring fast carry chains (`CARRY4` / `CARRY8`) cannot be arbitrarily dispersed across the die. The placer automatically clusters dependent carry elements into contiguous vertical columns along dedicated high-speed silicon carry tracks.

---

## Silicon Density & Thermal Heatmaps

The die area is partitioned into a normalized $32 \times 32$ spatial tile matrix:
- **Utilization Heatmap**: Cells are shaded from deep navy (empty / low utilization) to vibrant amber and red (high congestion $>85\%$).
- **Thermal Heatmap**: Combines logic switching frequency ($\alpha$) with local density to display thermal hotspots across the silicon die.

---

## Manhattan Flightlines & Critical Path Overlay

- **Point-to-Point Flightlines**: Clicking any cell illuminates Manhattan orthogonal routing channels connecting all driven fan-out destinations.
- **Critical Path Neon Overlay**: The worst-case timing path identified by the Static Timing Analysis engine is rendered as a prominent neon orange trace spanning from source flip-flop to destination endpoint.
