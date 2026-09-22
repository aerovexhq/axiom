# Interactive IEEE Gate DAG Schematic Visualizer

Axiom EDA's Schematic Visualizer translates parsed Verilog netlists into an interactive, high-performance Directed Acyclic Graph (DAG) rendered on an accelerated HTML5 Canvas. It provides cycle-accurate, gate-level visibility into combinational logic cones, flip-flops, arithmetic macros, and bus routes.

---

## Vivado-Grade Collision-Free Wire Routing

Legacy EDA visualizers often produce crisscrossing, tangled spaghetti wiring that is difficult to trace. Axiom features an advanced orthogonal channel routing algorithm:

```
+-------+                                     +-------+
| In A  |--------[ Straight Track ]---------> | In 0  |
+-------+                                     | AND1  |
                                       +----> | In 1  |
+-------+       +--------+             |      +---+---+
| In B  |------>|  INV1  |-------------+          |
+-------+       +--------+                        V
                                              [ Out F ]
```

### 1. Grid Datapath Row Alignment
Input ports, logic gates, and output pins are partitioned into logical datapath layers ($L_0, L_1, \dots, L_n$). Connected pins are mathematically aligned along identical vertical rows ($Y_{\text{out}} = Y_{\text{in}}$), allowing major connections to render as straight horizontal lines with **zero turning movements**.

### 2. Multi-Layer Destination Stepping
When a wire spans multiple layers ($dx \ge 150\text{px}$), the connection maintains its source horizontal track and executes its vertical jog in the dedicated open channel immediately before the destination pin ($dstX - 28$).

### 3. Text Protective Knockout Plates
Every gate instance label (`inv1`, `and1`, `or1`) and pin identifier is rendered over a solid protective background knockout plate (`#0c1017`). This completely prevents wires from overlapping or cutting through textual annotations.

### 4. Obstacle-Aware Channel Detours
The routing engine (`routeOrthogonalEdge`) dynamically maintains clearance bounding boxes (`KeepOutBox`) around intermediate gates, detouring wires cleanly through open vertical channels.

---

## Canvas Navigation & Dynamic Centering

- **Infinite Pan**: Click and drag any empty region on the canvas to pan across large netlists.
- **Smooth Wheel Zoom**: Scroll trackpad or mouse wheel to zoom continuously between 10% and 500%.
- **Dynamic Midpoint Camera Anchoring**: When dragging the center resizable splitter, Axiom's `ResizeObserver` mathematically locks the world-space camera midpoint to the visualizer pane center:
  $$\Delta \text{offsetX} = \frac{\Delta W}{2}, \quad \Delta \text{offsetY} = \frac{\Delta H}{2}$$
  This keeps the schematic perfectly centered and stable without any horizontal squishing or zoom jumps.

---

## Live Signal Probing & HUD

Hovering or clicking any wire or gate provides instant hardware introspection:
- **Wire Probing**: Displays net name, bit width, and real-time logic value (`0`, `1`, `X`, `Z`).
- **Cursor-Tracking Hover Card**: Follows the pointer with boundary clamping to keep details inside the viewport.
- **Gate Truth Table HUD**: Clicking any combinational gate (AND, OR, XOR, INV, MUX) displays a floating truth table highlighting the active input vector and resulting output state.
- **Logic Cone Highlighting**: Selecting any net illuminates its full upstream fan-in cone and downstream fan-out destinations in neon cyan.
