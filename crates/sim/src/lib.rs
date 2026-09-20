pub mod coverage;
pub mod event;
pub mod glitch;
pub mod listener;
pub mod protocol;
pub mod simulator;
pub mod snapshot;

pub use coverage::{
    generate_html, generate_lcov, BitToggle, BranchHits, CoverageReport, CoverageTracker,
    FsmCoverageData, LineCoverageInfo, LineCoverageStatus,
};
pub use event::{EventPayload, SchedRegion, SimEvent, StratifiedEventQueue};
pub use glitch::{GlitchDetector, GlitchEvent, GlitchKind};
pub use listener::{SimEventListener, SimTraceRecorder, TraceEntry};
pub use protocol::{
    decode_protocol_request, AxiConfig, AxiDecoder, DecodedTransaction, I2cConfig, I2cDecoder,
    ProtocolDecodeRequest, ProtocolKind, SpiConfig, SpiDecoder, TransactionStatus, UartConfig,
    UartDecoder, UartParity,
};
pub use simulator::{AxiomSimulator, DeltaSummary, SimError, TickSummary};
pub type BetteradoSimulator = AxiomSimulator;
pub use snapshot::{CheckpointId, SimSnapshot, SnapshotRingBuffer};

#[cfg(test)]
mod tests;
