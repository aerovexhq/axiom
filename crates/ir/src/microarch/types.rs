use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MacroCategory {
    Control,
    Datapath,
    Memory,
    Peripheral,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MacroPortDirection {
    In,
    Out,
    InOut,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroPort {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub direction: MacroPortDirection,
    pub is_clock: bool,
    pub is_reset: bool,
    pub is_datapath: bool,
    pub offset_x: f32,
    pub offset_y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsmState {
    pub id: String,
    pub name: String,
    pub value: u64,
    pub binary_str: String,
    pub is_reset: bool,
    pub moore_outputs: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsmTransition {
    pub from_state: String,
    pub to_state: String,
    pub condition: String,
    pub mealy_outputs: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsmMacro {
    pub state_reg: String,
    pub state_width: u32,
    pub reset_state: String,
    pub current_state_default: String,
    pub states: Vec<FsmState>,
    pub transitions: Vec<FsmTransition>,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AluFlag {
    pub name: String,
    pub signal: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AluOperation {
    pub opcode_val: u64,
    pub opcode_bin: String,
    pub name: String,
    pub expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AluMacro {
    pub opcode_signal: String,
    pub opcode_width: u32,
    pub operand_a: String,
    pub operand_b: String,
    pub operand_width: u32,
    pub result_signal: String,
    pub result_width: u32,
    pub flags: Vec<AluFlag>,
    pub operations: Vec<AluOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemReadPort {
    pub port_name: String,
    pub addr_signal: String,
    pub data_signal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemWritePort {
    pub port_name: String,
    pub addr_signal: String,
    pub data_signal: String,
    pub enable_signal: Option<String>,
    pub clock_signal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterFileMacro {
    pub name: String,
    pub word_width: u32,
    pub depth: usize,
    pub address_width: u32,
    pub read_ports: Vec<MemReadPort>,
    pub write_ports: Vec<MemWritePort>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMacro {
    pub name: String,
    pub primitive_type: String,
    pub capacity_bits: usize,
    pub read_width: u32,
    pub write_width: u32,
    pub ports: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatapathRegMacro {
    pub name: String,
    pub width: u32,
    pub reg_type: String,
    pub step_behavior: String,
    pub clock_signal: String,
    pub reset_signal: Option<String>,
    pub enable_signal: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecoderField {
    pub name: String,
    pub range_str: String,
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecoderMacro {
    pub name: String,
    pub input_bus: String,
    pub fields: Vec<DecoderField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrimitiveMacro {
    pub name: String,
    pub prim_type: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericMacro {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum MacroKind {
    Fsm(FsmMacro),
    Alu(AluMacro),
    RegisterFile(RegisterFileMacro),
    Memory(MemoryMacro),
    DatapathReg(DatapathRegMacro),
    Decoder(DecoderMacro),
    Primitive(PrimitiveMacro),
    Generic(GenericMacro),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroBlock {
    pub id: String,
    pub name: String,
    pub label: String,
    pub sublabel: String,
    pub category: MacroCategory,
    pub kind: MacroKind,
    pub inputs: Vec<MacroPort>,
    pub outputs: Vec<MacroPort>,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub clock_domain: Option<String>,
    pub latency_cycles: u32,
    pub source_line: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroarchBus {
    pub id: String,
    pub name: String,
    pub source_node: String,
    pub source_port: String,
    pub target_node: String,
    pub target_port: String,
    pub width: u32,
    pub is_datapath: bool,
    pub wire_points: Vec<(f32, f32)>,
    pub initial_value_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroarchControlWire {
    pub id: String,
    pub name: String,
    pub source_node: String,
    pub source_port: String,
    pub target_node: String,
    pub target_port: String,
    pub signal_type: String,
    pub wire_points: Vec<(f32, f32)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphBounds {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroarchGraph {
    pub top_module: String,
    pub blocks: Vec<MacroBlock>,
    pub buses: Vec<MicroarchBus>,
    pub control_wires: Vec<MicroarchControlWire>,
    pub bounds: GraphBounds,
}
