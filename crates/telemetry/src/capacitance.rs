use axiom_ir::{BirNet, NetId};
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};

/// Lumped physical capacitance model for interconnects and device pins.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NetCapacitanceModel {
    /// Driver output pin capacitance in femtofarads (default: 1.2 fF)
    pub driver_cap_ff: f64,
    /// Wire interconnect capacitance per bit in femtofarads (default: 0.8 fF)
    pub wire_cap_per_bit_ff: f64,
    /// Sink input gate pin capacitance in femtofarads (default: 0.6 fF)
    pub sink_cap_ff: f64,
    /// Custom capacitance overrides per NetId (in Farads)
    pub net_overrides_f: HashMap<NetId, f64>,
}

impl Default for NetCapacitanceModel {
    fn default() -> Self {
        Self {
            driver_cap_ff: 1.2,
            wire_cap_per_bit_ff: 0.8,
            sink_cap_ff: 0.6,
            net_overrides_f: HashMap::new(),
        }
    }
}

impl NetCapacitanceModel {
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets a custom capacitance override for a specific net in Farads.
    pub fn set_override(&mut self, net: NetId, capacitance_f: f64) {
        self.net_overrides_f.insert(net, capacitance_f);
    }

    /// Calculates total lumped capacitance of a net in Farads.
    pub fn get_net_capacitance_f(&self, net: &BirNet) -> f64 {
        if let Some(&cap) = self.net_overrides_f.get(&net.id) {
            return cap;
        }

        // C_total = C_driver + (C_wire_per_bit * width) + (C_sink * width)
        let total_ff = self.driver_cap_ff
            + (self.wire_cap_per_bit_ff * net.width as f64)
            + (self.sink_cap_ff * net.width as f64);

        // Convert fF (1e-15) to Farads
        total_ff * 1e-15
    }

    /// Calculates single-bit wire line capacitance of a net in Farads.
    pub fn get_bit_capacitance_f(&self, net: &BirNet) -> f64 {
        let total = self.get_net_capacitance_f(net);
        if net.width > 0 {
            total / (net.width as f64)
        } else {
            total
        }
    }
}
