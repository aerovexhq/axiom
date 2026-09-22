# Virtual Lab Rack & Board Emulation

Axiom's Virtual Lab Rack bridges HDL simulation and physical hardware testing. It provides authentic digital breadboard emulation, enabling students and FPGA engineers to interact with their designs using tactile switches, pushbuttons, LEDs, and 7-segment displays in real time.

---

## Digilent Basys 3 FPGA Board Bay

The Basys 3 FPGA bay provides an accurate digital twin of Digilent's popular Artix-7 development board:

```
+-------------------------------------------------------------------------------+
| Axiom Basys 3 Artix-7 Hardware Emulation Bay                                  |
+-------------------------------------------------------------------------------+
| [SSEG Display:  1 0 4 2 ]       [BTNU]                 [LD15 .. LD0]          |
| Anode: AN3..AN0 Active        [BTNL] [BTNC] [BTNR]     * * * * * * * *        |
| Segments: CA..CG, DP            [BTND]                 O O O O O O O O        |
|                                                                               |
| Tactile Slide Switches:                                                       |
| [SW15] [SW14] [SW13] [SW12] [SW11] [SW10] [SW9] [SW8] ... [SW1] [SW0]         |
|  [ON]   [OFF]  [OFF]  [ON]   [ON]   [OFF]  [OFF] [ON]       [OFF] [ON]        |
+-------------------------------------------------------------------------------+
```

### 1. 16 Tactile Slide Switches (`SW0`..`SW15`)
- Mapped directly to input ports via XDC physical constraints (`PACKAGE_PIN V17`, etc.).
- Interactive clicking toggles switch position with authentic sound effects and state persistence.
- High-contrast visual toggle levers with green indicator pips.

### 2. 16 Surface-Mount LEDs (`LD0`..`LD15`)
- Mapped to output ports via XDC constraints (`PACKAGE_PIN U16`, etc.).
- Realistic emerald glow rendering indicating active logic-high states (`1`).

### 3. 5 Momentary Pushbuttons (`BTNC`, `BTNU`, `BTNL`, `BTNR`, `BTND`)
- Directional cross configuration for Center, Up, Left, Right, and Down buttons.
- Pressing holds logic-high (`1`); releasing returns to logic-low (`0`). Perfect for manual reset strobes or clock single-stepping.

### 4. 4-Digit Multiplexed 7-Segment Display (`SSEG`)
- Implements authentic cathode-anode dynamic scanning.
- Accurately renders segments (`CA` through `CG`) and decimal point (`DP`) controlled by active-low anode selection lines (`AN0` through `AN3`).

---

## Combinational Logic Bay

Designed for introductory digital logic and truth-table verification, the Combinational Logic Bay provides a dedicated tactile interface:
- **Interactive Inputs**: Three prominent toggle switches (`A`, `B`, `C`).
- **Gate Probes**: Real-time signal valuation pins for intermediate nets (`w1`, `w2`, `w3`, `w4`).
- **Output LED**: Prominent indicator diode displaying circuit output `F`.
- **Synchronized 8-Row Truth Table HUD**: Displays all $2^3 = 8$ input combinations ($000$ to $111$). The active row illuminates dynamically based on current switch states, providing immediate visual confirmation of boolean correctness.

---

## Automated Lab Grader (`LabGraderModal`)

Engineered in partnership with university digital design coursework (including Istanbul University - Cerrahpasa):
- **Automated Verification**: Automatically executes the testbench matrix against student RTL implementations (`uygulama_0.v`).
- **Executive Grade Cards**: Computes percentage scores, timing accuracy, and functional coverage.
- **Test Vector Matrix**: Details expected vs. actual signal outputs across each simulation step.
- **Markdown Scorecard Export**: 1-click generation of formatted lab submission reports for instructors.
