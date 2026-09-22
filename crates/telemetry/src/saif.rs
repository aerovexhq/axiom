use axiom_core::SimTime;
use axiom_ir::BirCircuit;
use crate::collector::TelemetryCollector;

/// Switching Activity Interchange Format (SAIF) writer for AMD Vivado interoperability.
pub struct SaifWriter;

impl SaifWriter {
    /// Generates standard SAIF 2.0 file from simulation switching activity statistics.
    pub fn generate_saif(
        circuit: &BirCircuit,
        collector: &TelemetryCollector,
        sim_duration: SimTime,
    ) -> String {
        let mut saif = String::with_capacity(8 * 1024);
        let duration_ps = sim_duration.as_picoseconds();

        saif.push_str("(SAIFILE\n");
        saif.push_str("  (SAIFVERSION \"2.0\")\n");
        saif.push_str("  (DIRECTION \"backward\")\n");
        saif.push_str(&format!("  (DESIGN \"{}\")\n", circuit.top_name));
        saif.push_str("  (DATE \"Axiom HDL Engine\")\n");
        saif.push_str("  (VENDOR \"Axiom\")\n");
        saif.push_str("  (PROGRAM_NAME \"Axiom Simulator\")\n");
        saif.push_str("  (PROGRAM_VERSION \"1.0.0\")\n");
        saif.push_str("  (DIVIDER /)\n");
        saif.push_str("  (TIMESCALE 1 ps)\n");
        saif.push_str(&format!("  (DURATION {duration_ps})\n"));

        saif.push_str(&format!("  (INSTANCE {}\n", circuit.top_name));
        saif.push_str("    (NET\n");

        for net in &circuit.nets {
            let short_name = if let Some((_, leaf)) = net.name.rsplit_once('.') {
                leaf
            } else {
                &net.name
            };

            let stats = collector.net_stats.get(&net.id);
            let (t0, t1, tx, tz, tc) = if let Some(s) = stats {
                (
                    s.duration_low_ps,
                    s.duration_high_ps,
                    s.duration_x_ps,
                    s.duration_z_ps,
                    s.toggle_count,
                )
            } else {
                (duration_ps, 0, 0, 0, 0)
            };

            saif.push_str(&format!(
                "      ({short_name} (T0 {t0}) (T1 {t1}) (TX {tx}) (TZ {tz}) (TC {tc}))\n"
            ));
        }

        saif.push_str("    )\n"); // end NET
        saif.push_str("  )\n");   // end INSTANCE
        saif.push_str(")\n");     // end SAIFILE

        saif
    }
}
