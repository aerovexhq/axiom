pub mod assertion;
pub mod coverage;
pub mod event;
pub mod formal;
pub mod glitch;
pub mod listener;
pub mod protocol;
pub mod simulator;
pub mod snapshot;

pub use assertion::{
    AssertionDef, AssertionEvaluator, AssertionKind, AssertionReport, AssertionStats,
    AssertionStatus, AssertionSummary, AssertionThread, AssertionViolation, ClockEdge,
    CompareOp, PropertyExpr, SequenceExpr, SvaParser, TemporalExpr,
};
pub use coverage::{
    generate_html, generate_lcov, BitToggle, BranchHits, CoverageReport, CoverageTracker,
    FsmCoverageData, LineCoverageInfo, LineCoverageStatus,
};
pub use event::{EventPayload, SchedRegion, SimEvent, StratifiedEventQueue};
pub use glitch::{GlitchDetector, GlitchEvent, GlitchKind};
pub use listener::{SimEventListener, SimTraceRecorder, TraceEntry};
pub use protocol::{
    decode_protocol_request, AxiConfig, AxiDecoder, CanConfig, CanDecoder, DecodedTransaction,
    EthernetConfig, EthernetDecoder, EthernetInterface, I2cConfig, I2cDecoder,
    ProtocolDecodeRequest, ProtocolKind, SpiConfig, SpiDecoder, TransactionStatus, UartConfig,
    UartDecoder, UartParity, UsbConfig, UsbDecoder, UsbSpeed,
};
pub use simulator::{AxiomSimulator, DeltaSummary, SimError, TickSummary};
pub type BetteradoSimulator = AxiomSimulator;
pub use snapshot::{CheckpointId, SimSnapshot, SnapshotRingBuffer};

#[cfg(test)]
mod tests;
