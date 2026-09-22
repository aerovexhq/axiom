#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use crate::capacitance::NetCapacitanceModel;
    use crate::rail::{PdnModel, PowerRail};
    use axiom_core::LogicVector;
    use axiom_ir::{BirNet, NetId};

    #[test]
    fn test_pdn_voltage_droop() {
        let mut rail = PowerRail::new(
            "V_TEST",
            1.0,
            PdnModel {
                r_pdn: 0.1,  // 0.1 Ohm
                l_pdn: 1e-9, // 1 nH
            },
        );

        // At t=0, current=0 -> V = 1.0
        let v0 = rail.compute_voltage(0.0, 0.0);
        assert!((v0 - 1.0).abs() < 1e-6);

        // At t=1ns, current jumps to 1.0 A
        // IR drop = 1.0 * 0.1 = 0.1 V
        // L * di/dt = 1e-9 * (1.0 / 1e-9) = 1.0 V
        // Total droop = 1.1 V -> clamped to 0.0 V
        let v1 = rail.compute_voltage(1.0, 1e-9);
        assert!((v1 - 0.0).abs() < 1e-6);

        // At t=2ns, current steady at 1.0 A (di/dt = 0)
        // IR drop = 1.0 * 0.1 = 0.1 V
        // V = 1.0 - 0.1 = 0.90 V
        let v2 = rail.compute_voltage(1.0, 2e-9);
        assert!((v2 - 0.90).abs() < 1e-6);
    }

    #[test]
    fn test_lumped_capacitance_model() {
        let model = NetCapacitanceModel::default();
        let net32 = BirNet {
            id: NetId(1),
            name: "bus_32".to_string(),
            width: 32,
            word_offset: 0,
            capacitance_ff: 0.0,
            initial_value: LogicVector::zeros(32),
        };

        // Total = 1.2 fF + (0.8 * 32) + (0.6 * 32) = 1.2 + 25.6 + 19.2 = 46.0 fF
        let cap_f = model.get_net_capacitance_f(&net32);
        let expected_f = 46.0 * 1e-15;
        assert!((cap_f - expected_f).abs() < 1e-20);

        let bit_cap_f = model.get_bit_capacitance_f(&net32);
        assert!((bit_cap_f - (expected_f / 32.0)).abs() < 1e-20);
    }
}
