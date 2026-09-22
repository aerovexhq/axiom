# High-Density Waveforms & Logic Analyzer

Axiom EDA features a high-density, 60+ FPS digital waveform viewer and logic analyzer rendered on an accelerated HTML5 canvas. It allows engineers to inspect multi-signal timing relationships, expand bus radices, measure intervals, and detect zero-time delta cycle glitches.

---

## Stratified Digital Timeline

The waveform viewer renders digital traces with virtualized vertical scrolling, accommodating hundreds of signals with zero UI lag:

```
Signal Name   Radix   | 0 ns      5 ns      10 ns     15 ns     20 ns     25 ns
----------------------+--------------------------------------------------------
clk           1-bit   | _/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_/\_
rst_n         1-bit   | _____/=================================================
data_in[7:0]  Hex     | = 00 =X= 41 =X= 42 =X= 43 =X= 44 =X= 45 =X= 46 ======
valid_in      1-bit   | ______/===========\___________/=======================
busy_out      1-bit   | ____________/===========\___________/=================
----------------------+--------------------------------------------------------
                      |       |<---- Delta-T: 10.0 ns (100.0 MHz) ---->|
```

### Signal Display Capabilities
- **Radix Switching**: Right-click or click any signal's radix pill to switch between **Hexadecimal**, **Binary**, **Unsigned Decimal**, **Signed Decimal**, and **ASCII**.
- **Bus Expansion**: Click the chevron (`>`) next to any multi-bit vector (`data[7:0]`) to expand individual bit lines.
- **Color Highlighting**: Traces render in high-contrast cyan for logic levels, amber for buses, and red for unknown/contention states (`X`, `Z`).

---

## Modern Drag-to-Measure Window

Axiom replaces outdated two-cursor measurement workflows with an intuitive drag-to-measure window:

1. **Click and Drag**: Drag across any region of the waveform timeline to highlight a measurement window.
2. **Boundary Handles ($[A, B]$)**: Drag the left or right boundary handles to adjust measurement endpoints with picosecond precision.
3. **Sliding Window**: Drag the center of the measurement window to slide the entire time interval along the timeline.
4. **Live Measurement HUD**: The HUD displays:
   - **Time A ($T_A$)**: Start timestamp with compact engineering units (ps, ns, us, ms).
   - **Time B ($T_B$)**: End timestamp.
   - **Delta Time ($\Delta t$)**: Exact duration ($\Delta t = |T_B - T_A|$).
   - **Frequency ($f$)**: Equivalent clock frequency ($f = 1 / \Delta t$).
5. **Zoom into Window**: Click **Zoom into Window** to expand the selected interval to 100% of the canvas width.

---

## Delta-Cycle (\(\delta\)) & Glitch Detection

Traditional simulators collapse zero-time events into a single timestamp, hiding combinational race conditions. Axiom provides explicit delta inspection:
- **Step Delta (`F11`)**: Steps one discrete zero-time evaluation cycle ($\delta 	o \delta + 1$).
- **Glitch Hazard Markers**: When a signal transitions multiple times within the same physical timestamp ($t_0$), the waveform canvas highlights the net with an amber warning flag.
- **Delta Expansion View**: Expands zero-time intervals horizontally, revealing the internal cascade of intermediate gate transitions before the circuit reaches steady-state.

---

## IEEE 1364 VCD Export & Import Diffing

- **Export VCD**: Export current simulation history as an IEEE 1364 Value Change Dump (`.vcd`) directly compatible with GTKWave, ModelSim, or Vivado.
- **Import VCD (`ImportVcdModal`)**: Load external VCD files into Axiom.
- **Waveform Diffing**: Automatically compares simulation traces against reference golden VCD files, highlighting signal mismatches with cycle-by-cycle error flags.
