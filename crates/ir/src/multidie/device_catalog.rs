use crate::multidie::types::{DieBoundary, DieInfo, DieKind, DieResourceBudget, InterconnectKind, MultiDieDevice};

/// Returns a pre-calibrated multi-die hardware model based on device part number.
pub fn get_device_profile(device_name: &str) -> MultiDieDevice {
    let lower = device_name.to_lowercase();
    if lower.contains("vu13p") || lower.contains("xcvu13p") {
        vu13p_profile()
    } else if lower.contains("dual") || lower.contains("prototyping") {
        dual_vu9p_board_profile()
    } else if lower.contains("quad") || lower.contains("mesh") {
        quad_vu19p_mesh_profile()
    } else {
        // Default to Virtex UltraScale+ VU9P (industry standard 3-SLR device)
        vu9p_profile()
    }
}

/// Virtex UltraScale+ VU9P: 3 Super Logic Regions (SLR0, SLR1, SLR2) on Silicon Interposer.
pub fn vu9p_profile() -> MultiDieDevice {
    MultiDieDevice {
        id: "xcvu9p-flgb2104-2-e".to_string(),
        name: "Virtex UltraScale+ VU9P (3 SLRs)".to_string(),
        family: "UltraScale+ SSIT".to_string(),
        dies: vec![
            DieInfo {
                id: "SLR0".to_string(),
                name: "Super Logic Region 0 (Bottom)".to_string(),
                kind: DieKind::SlrDie,
                index: 0,
                budget: DieResourceBudget {
                    logic_cells: 862_000,
                    bram_36k: 720,
                    dsp_slices: 2_280,
                },
            },
            DieInfo {
                id: "SLR1".to_string(),
                name: "Super Logic Region 1 (Middle)".to_string(),
                kind: DieKind::SlrDie,
                index: 1,
                budget: DieResourceBudget {
                    logic_cells: 862_000,
                    bram_36k: 720,
                    dsp_slices: 2_280,
                },
            },
            DieInfo {
                id: "SLR2".to_string(),
                name: "Super Logic Region 2 (Top)".to_string(),
                kind: DieKind::SlrDie,
                index: 2,
                budget: DieResourceBudget {
                    logic_cells: 862_000,
                    bram_36k: 720,
                    dsp_slices: 2_280,
                },
            },
        ],
        boundaries: vec![
            DieBoundary {
                id: "b_slr0_slr1".to_string(),
                die_a: "SLR0".to_string(),
                die_b: "SLR1".to_string(),
                max_tracks: 1_440,
                interconnect_kind: InterconnectKind::Sll,
                propagation_delay_ps: 1_500.0,
                capacitance_per_track_ff: 2_500.0,
            },
            DieBoundary {
                id: "b_slr1_slr2".to_string(),
                die_a: "SLR1".to_string(),
                die_b: "SLR2".to_string(),
                max_tracks: 1_440,
                interconnect_kind: InterconnectKind::Sll,
                propagation_delay_ps: 1_500.0,
                capacitance_per_track_ff: 2_500.0,
            },
        ],
    }
}

/// Virtex UltraScale+ VU13P: 4 Super Logic Regions (SLR0..SLR3) on Silicon Interposer.
pub fn vu13p_profile() -> MultiDieDevice {
    MultiDieDevice {
        id: "xcvu13p-fhgb2104-2-e".to_string(),
        name: "Virtex UltraScale+ VU13P (4 SLRs)".to_string(),
        family: "UltraScale+ SSIT".to_string(),
        dies: vec![
            DieInfo {
                id: "SLR0".to_string(),
                name: "Super Logic Region 0".to_string(),
                kind: DieKind::SlrDie,
                index: 0,
                budget: DieResourceBudget {
                    logic_cells: 945_000,
                    bram_36k: 912,
                    dsp_slices: 3_072,
                },
            },
            DieInfo {
                id: "SLR1".to_string(),
                name: "Super Logic Region 1".to_string(),
                kind: DieKind::SlrDie,
                index: 1,
                budget: DieResourceBudget {
                    logic_cells: 945_000,
                    bram_36k: 912,
                    dsp_slices: 3_072,
                },
            },
            DieInfo {
                id: "SLR2".to_string(),
                name: "Super Logic Region 2".to_string(),
                kind: DieKind::SlrDie,
                index: 2,
                budget: DieResourceBudget {
                    logic_cells: 945_000,
                    bram_36k: 912,
                    dsp_slices: 3_072,
                },
            },
            DieInfo {
                id: "SLR3".to_string(),
                name: "Super Logic Region 3".to_string(),
                kind: DieKind::SlrDie,
                index: 3,
                budget: DieResourceBudget {
                    logic_cells: 945_000,
                    bram_36k: 912,
                    dsp_slices: 3_072,
                },
            },
        ],
        boundaries: vec![
            DieBoundary {
                id: "b_slr0_slr1".to_string(),
                die_a: "SLR0".to_string(),
                die_b: "SLR1".to_string(),
                max_tracks: 1_440,
                interconnect_kind: InterconnectKind::Sll,
                propagation_delay_ps: 1_500.0,
                capacitance_per_track_ff: 2_500.0,
            },
            DieBoundary {
                id: "b_slr1_slr2".to_string(),
                die_a: "SLR1".to_string(),
                die_b: "SLR2".to_string(),
                max_tracks: 1_440,
                interconnect_kind: InterconnectKind::Sll,
                propagation_delay_ps: 1_500.0,
                capacitance_per_track_ff: 2_500.0,
            },
            DieBoundary {
                id: "b_slr2_slr3".to_string(),
                die_a: "SLR2".to_string(),
                die_b: "SLR3".to_string(),
                max_tracks: 1_440,
                interconnect_kind: InterconnectKind::Sll,
                propagation_delay_ps: 1_500.0,
                capacitance_per_track_ff: 2_500.0,
            },
        ],
    }
}

/// Dual-VU9P Prototyping Board: 2 standalone FPGAs connected via FMC high-speed ribbon cable.
pub fn dual_vu9p_board_profile() -> MultiDieDevice {
    MultiDieDevice {
        id: "dual-vu9p-prototyping".to_string(),
        name: "Dual-VU9P Prototyping System (2 FPGAs)".to_string(),
        family: "Multi-FPGA Prototyping".to_string(),
        dies: vec![
            DieInfo {
                id: "FPGA_A".to_string(),
                name: "Primary Prototyping FPGA (VU9P A)".to_string(),
                kind: DieKind::StandaloneFpga,
                index: 0,
                budget: DieResourceBudget {
                    logic_cells: 2_586_000,
                    bram_36k: 2_160,
                    dsp_slices: 6_840,
                },
            },
            DieInfo {
                id: "FPGA_B".to_string(),
                name: "Secondary Prototyping FPGA (VU9P B)".to_string(),
                kind: DieKind::StandaloneFpga,
                index: 1,
                budget: DieResourceBudget {
                    logic_cells: 2_586_000,
                    bram_36k: 2_160,
                    dsp_slices: 6_840,
                },
            },
        ],
        boundaries: vec![
            DieBoundary {
                id: "b_fpgaA_fpgaB".to_string(),
                die_a: "FPGA_A".to_string(),
                die_b: "FPGA_B".to_string(),
                max_tracks: 256,
                interconnect_kind: InterconnectKind::PcbTrace,
                propagation_delay_ps: 4_500.0,
                capacitance_per_track_ff: 12_000.0,
            },
        ],
    }
}

/// Quad-VU19P Mesh Emulation System: 4 FPGAs in a 2D mesh grid.
pub fn quad_vu19p_mesh_profile() -> MultiDieDevice {
    MultiDieDevice {
        id: "quad-vu19p-mesh".to_string(),
        name: "Quad-VU19P 2D Mesh Emulation System".to_string(),
        family: "ASIC Emulation Grid".to_string(),
        dies: vec![
            DieInfo {
                id: "FPGA_00".to_string(),
                name: "Node [0,0] (Northwest)".to_string(),
                kind: DieKind::StandaloneFpga,
                index: 0,
                budget: DieResourceBudget {
                    logic_cells: 8_938_000,
                    bram_36k: 4_320,
                    dsp_slices: 3_840,
                },
            },
            DieInfo {
                id: "FPGA_01".to_string(),
                name: "Node [0,1] (Northeast)".to_string(),
                kind: DieKind::StandaloneFpga,
                index: 1,
                budget: DieResourceBudget {
                    logic_cells: 8_938_000,
                    bram_36k: 4_320,
                    dsp_slices: 3_840,
                },
            },
            DieInfo {
                id: "FPGA_10".to_string(),
                name: "Node [1,0] (Southwest)".to_string(),
                kind: DieKind::StandaloneFpga,
                index: 2,
                budget: DieResourceBudget {
                    logic_cells: 8_938_000,
                    bram_36k: 4_320,
                    dsp_slices: 3_840,
                },
            },
            DieInfo {
                id: "FPGA_11".to_string(),
                name: "Node [1,1] (Southeast)".to_string(),
                kind: DieKind::StandaloneFpga,
                index: 3,
                budget: DieResourceBudget {
                    logic_cells: 8_938_000,
                    bram_36k: 4_320,
                    dsp_slices: 3_840,
                },
            },
        ],
        boundaries: vec![
            DieBoundary {
                id: "b_00_01".to_string(),
                die_a: "FPGA_00".to_string(),
                die_b: "FPGA_01".to_string(),
                max_tracks: 512,
                interconnect_kind: InterconnectKind::TdmSerDes,
                propagation_delay_ps: 3_000.0,
                capacitance_per_track_ff: 8_000.0,
            },
            DieBoundary {
                id: "b_00_10".to_string(),
                die_a: "FPGA_00".to_string(),
                die_b: "FPGA_10".to_string(),
                max_tracks: 512,
                interconnect_kind: InterconnectKind::TdmSerDes,
                propagation_delay_ps: 3_000.0,
                capacitance_per_track_ff: 8_000.0,
            },
            DieBoundary {
                id: "b_01_11".to_string(),
                die_a: "FPGA_01".to_string(),
                die_b: "FPGA_11".to_string(),
                max_tracks: 512,
                interconnect_kind: InterconnectKind::TdmSerDes,
                propagation_delay_ps: 3_000.0,
                capacitance_per_track_ff: 8_000.0,
            },
            DieBoundary {
                id: "b_10_11".to_string(),
                die_a: "FPGA_10".to_string(),
                die_b: "FPGA_11".to_string(),
                max_tracks: 512,
                interconnect_kind: InterconnectKind::TdmSerDes,
                propagation_delay_ps: 3_000.0,
                capacitance_per_track_ff: 8_000.0,
            },
        ],
    }
}
