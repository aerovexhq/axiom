use serde::{Deserialize, Serialize};

/// Power distribution network (PDN) impedance model.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PdnModel {
    /// Parasitic resistance in Ohms (e.g. 0.05 Ohm)
    pub r_pdn: f64,
    /// Parasitic loop inductance in Henries (e.g. 0.2 nH = 2e-10 H)
    pub l_pdn: f64,
}

impl Default for PdnModel {
    fn default() -> Self {
        Self {
            r_pdn: 0.05,
            l_pdn: 0.2e-9,
        }
    }
}

/// Voltage supply rail with dynamic transient current and voltage droop modeling.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PowerRail {
    pub name: String,
    pub nominal_voltage: f64,
    pub pdn: PdnModel,
    pub prev_current_a: f64,
    pub prev_time_s: f64,
}

impl PowerRail {
    pub fn new(name: impl Into<String>, nominal_voltage: f64, pdn: PdnModel) -> Self {
        Self {
            name: name.into(),
            nominal_voltage,
            pdn,
            prev_current_a: 0.0,
            prev_time_s: 0.0,
        }
    }

    /// Pre-configured standard FPGA core logic rail (0.90V).
    pub fn core() -> Self {
        Self::new("V_CORE", 0.90, PdnModel { r_pdn: 0.05, l_pdn: 0.2e-9 })
    }

    /// Pre-configured auxiliary / clocking rail (1.80V).
    pub fn aux() -> Self {
        Self::new("V_AUX", 1.80, PdnModel { r_pdn: 0.10, l_pdn: 0.5e-9 })
    }

    /// Pre-configured I/O bank rail (configurable voltage, default 3.30V).
    pub fn io(voltage: f64) -> Self {
        Self::new("V_IO", voltage, PdnModel { r_pdn: 0.15, l_pdn: 1.0e-9 })
    }

    /// Computes the instantaneous rail voltage accounting for IR drop and L*di/dt inductive droop.
    pub fn compute_voltage(&mut self, current_a: f64, time_s: f64) -> f64 {
        let dt = (time_s - self.prev_time_s).max(1e-15);
        let di = current_a - self.prev_current_a;
        let di_dt = di / dt;

        let ir_drop = current_a * self.pdn.r_pdn;
        let l_drop = self.pdn.l_pdn * di_dt;
        let total_sag = ir_drop + l_drop;

        self.prev_current_a = current_a;
        self.prev_time_s = time_s;

        (self.nominal_voltage - total_sag).clamp(0.0, self.nominal_voltage * 1.5)
    }

    pub fn reset(&mut self) {
        self.prev_current_a = 0.0;
        self.prev_time_s = 0.0;
    }
}
