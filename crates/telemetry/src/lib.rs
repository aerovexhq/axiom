pub mod capacitance;
pub mod collector;
pub mod ppa;
pub mod rail;
pub mod saif;
pub mod vcd;
pub mod vcd_import;

pub use capacitance::NetCapacitanceModel;
pub use collector::{NetSwitchingStats, TelemetryCollector, TelemetryFrame};
pub use ppa::{
    AsicForecast, AsicPdk, FpgaDeviceProfile, FpgaFitEvaluation, FpgaFitStatus, ParetoPoint,
    PpaEvaluator, PpaMetrics, PpaOptions, PpaReport,
};
pub use rail::{PdnModel, PowerRail};
pub use saif::SaifWriter;
pub use vcd::VcdWriter;
pub use vcd_import::{
    diff_waveforms, ParsedVcd, VcdDiffReport, VcdParser, VcdSample, VcdSignal, WaveformMismatch,
};

#[cfg(test)]
mod tests;
