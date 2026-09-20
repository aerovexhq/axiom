use crate::bir::BirCircuit;
use crate::multidie::device_catalog::{dual_vu9p_board_profile, vu13p_profile, vu9p_profile};
use crate::multidie::partitioner::partition_circuit;
use crate::multidie::types::PartitionConfig;
use hashbrown::HashMap;

#[test]
fn test_device_catalog_vu9p_and_vu13p() {
    let vu9p = vu9p_profile();
    assert_eq!(vu9p.dies.len(), 3);
    assert_eq!(vu9p.dies[0].id, "SLR0");
    assert_eq!(vu9p.dies[1].id, "SLR1");
    assert_eq!(vu9p.dies[2].id, "SLR2");
    assert_eq!(vu9p.boundaries.len(), 2);
    assert_eq!(vu9p.boundaries[0].max_tracks, 1440);
    assert_eq!(vu9p.boundaries[1].max_tracks, 1440);

    let vu13p = vu13p_profile();
    assert_eq!(vu13p.dies.len(), 4);
    assert_eq!(vu13p.boundaries.len(), 3);

    let dual = dual_vu9p_board_profile();
    assert_eq!(dual.dies.len(), 2);
    assert_eq!(dual.boundaries[0].max_tracks, 256);
}

#[test]
fn test_partition_circuit_riscv() {
    let circuit = BirCircuit::new("riscv_core");
    let config = PartitionConfig {
        target_device: "xcvu9p-flgb2104-2-e".to_string(),
        ..Default::default()
    };

    let result = partition_circuit(&circuit, &config);
    assert_eq!(result.device.dies.len(), 3);
    assert!(!result.cut_nets.is_empty(), "Should generate cut-nets across SLRs");
    assert!(result.total_tracks_used > 0);
    assert!(!result.has_overflow, "Normal RISC-V core should not overflow 1440 SLL tracks");
    assert!(result.interposer_power_mw > 0.0);
}

#[test]
fn test_user_constraints_strict_enforcement() {
    let circuit = BirCircuit::new("riscv_core");
    let mut constraints = HashMap::new();
    constraints.insert("u_fetch".to_string(), "SLR0".to_string());
    constraints.insert("u_alu".to_string(), "SLR2".to_string());

    let config = PartitionConfig {
        target_device: "xcvu9p-flgb2104-2-e".to_string(),
        user_constraints: constraints,
        ..Default::default()
    };

    let result = partition_circuit(&circuit, &config);

    // Verify u_fetch is in SLR0
    let slr0 = result.die_utilization.iter().find(|d| d.die_id == "SLR0").unwrap();
    assert!(slr0.assigned_modules.contains(&"u_fetch".to_string()));

    // Verify u_alu is in SLR2
    let slr2 = result.die_utilization.iter().find(|d| d.die_id == "SLR2").unwrap();
    assert!(slr2.assigned_modules.contains(&"u_alu".to_string()));
}

#[test]
fn test_laguna_insertion_and_tdm() {
    let circuit = BirCircuit::new("dsp_bram_mac");
    let config_direct = PartitionConfig {
        target_device: "xcvu9p-flgb2104-2-e".to_string(),
        enable_laguna_insertion: false,
        tdm_ratio: 1,
        ..Default::default()
    };
    let _res_direct = partition_circuit(&circuit, &config_direct);

    let config_laguna = PartitionConfig {
        target_device: "xcvu9p-flgb2104-2-e".to_string(),
        enable_laguna_insertion: true,
        tdm_ratio: 4,
        ..Default::default()
    };
    let res_laguna = partition_circuit(&circuit, &config_laguna);

    if let Some(net) = res_laguna.cut_nets.first() {
        assert!(net.is_laguna_pipelined);
        assert_eq!(net.latency_cycles, 1);
        assert_eq!(net.estimated_delay_ps, 350.0);
    }
}
