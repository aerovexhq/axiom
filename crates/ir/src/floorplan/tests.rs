use super::*;
use crate::bir::PrimitiveKind;
use crate::synth::*;
use hashbrown::HashMap;

fn create_mock_circuit() -> SynthesizedCircuit {
    let mut cells = Vec::new();
    let mut ports = Vec::new();
    let mut nets = Vec::new();

    // Inputs
    ports.push(SynthesizedPort {
        name: "A".to_string(),
        direction: axiom_syntax::PortDirection::Input,
        width: 1,
        is_clock: false,
        is_reset: false,
    });
    ports.push(SynthesizedPort {
        name: "B".to_string(),
        direction: axiom_syntax::PortDirection::Input,
        width: 1,
        is_clock: false,
        is_reset: false,
    });
    // Output
    ports.push(SynthesizedPort {
        name: "Y".to_string(),
        direction: axiom_syntax::PortDirection::Output,
        width: 1,
        is_clock: false,
        is_reset: false,
    });

    // IBUFs
    let mut p_ibuf_a = HashMap::new();
    p_ibuf_a.insert("I".to_string(), "A".to_string());
    p_ibuf_a.insert("O".to_string(), "A_ibuf".to_string());
    cells.push(SynthesizedCell {
        id: "cell_ibuf_a".to_string(),
        name: "ibuf_a".to_string(),
        kind: PrimitiveKind::Ibuf,
        scope: "top".to_string(),
        ports: p_ibuf_a,
        params: HashMap::new(),
        equation: None,
        source_line: Some(1),
        delay_ps: 350.0,
    });

    let mut p_ibuf_b = HashMap::new();
    p_ibuf_b.insert("I".to_string(), "B".to_string());
    p_ibuf_b.insert("O".to_string(), "B_ibuf".to_string());
    cells.push(SynthesizedCell {
        id: "cell_ibuf_b".to_string(),
        name: "ibuf_b".to_string(),
        kind: PrimitiveKind::Ibuf,
        scope: "top".to_string(),
        ports: p_ibuf_b,
        params: HashMap::new(),
        equation: None,
        source_line: Some(2),
        delay_ps: 350.0,
    });

    // LUT2
    let mut p_lut = HashMap::new();
    p_lut.insert("I0".to_string(), "A_ibuf".to_string());
    p_lut.insert("I1".to_string(), "B_ibuf".to_string());
    p_lut.insert("O".to_string(), "lut_out".to_string());
    let mut params_lut = HashMap::new();
    params_lut.insert("INIT".to_string(), 0x8);
    cells.push(SynthesizedCell {
        id: "cell_lut_and".to_string(),
        name: "lut_and".to_string(),
        kind: PrimitiveKind::Lut2,
        scope: "top".to_string(),
        ports: p_lut,
        params: params_lut,
        equation: Some("O = I0 & I1".to_string()),
        source_line: Some(3),
        delay_ps: 60.0,
    });

    // OBUF
    let mut p_obuf = HashMap::new();
    p_obuf.insert("I".to_string(), "lut_out".to_string());
    p_obuf.insert("O".to_string(), "Y".to_string());
    cells.push(SynthesizedCell {
        id: "cell_obuf_y".to_string(),
        name: "obuf_y".to_string(),
        kind: PrimitiveKind::Obuf,
        scope: "top".to_string(),
        ports: p_obuf,
        params: HashMap::new(),
        equation: None,
        source_line: Some(4),
        delay_ps: 450.0,
    });

    // Nets
    nets.push(SynthesizedNet {
        name: "A_ibuf".to_string(),
        width: 1,
        driver_cell: Some("cell_ibuf_a".to_string()),
        driver_pin: Some("O".to_string()),
        load_cells: vec![("cell_lut_and".to_string(), "I0".to_string())],
        is_clock: false,
        is_reset: false,
    });
    nets.push(SynthesizedNet {
        name: "B_ibuf".to_string(),
        width: 1,
        driver_cell: Some("cell_ibuf_b".to_string()),
        driver_pin: Some("O".to_string()),
        load_cells: vec![("cell_lut_and".to_string(), "I1".to_string())],
        is_clock: false,
        is_reset: false,
    });
    nets.push(SynthesizedNet {
        name: "lut_out".to_string(),
        width: 1,
        driver_cell: Some("cell_lut_and".to_string()),
        driver_pin: Some("O".to_string()),
        load_cells: vec![("cell_obuf_y".to_string(), "I".to_string())],
        is_clock: false,
        is_reset: false,
    });

    let stats = SynthesisStats {
        lut1_count: 0,
        lut2_count: 1,
        lut3_count: 0,
        lut4_count: 0,
        lut5_count: 0,
        lut6_count: 0,
        lut6_2_count: 0,
        total_luts: 1,
        fdre_count: 0,
        fdce_count: 0,
        total_ffs: 0,
        carry4_count: 0,
        carry8_count: 0,
        total_carries: 0,
        ibuf_count: 2,
        obuf_count: 1,
        bufg_count: 0,
        total_iobs: 3,
        dsp_count: 0,
        bram_count: 0,
        total_cells: 4,
        target_lut_capacity: 63400,
        target_ff_capacity: 126800,
        lut_utilization_pct: 0.01,
        ff_utilization_pct: 0.0,
        logic_depth: 1,
        estimated_delay_ps: 860.0,
    };

    SynthesizedCircuit {
        top_module: "top".to_string(),
        target_device: "xc7a35tcpg236-1".to_string(),
        target_family: FpgaFamily::Artix7,
        ports,
        cells,
        nets,
        stats,
    }
}

#[test]
fn test_device_grid_generation() {
    let grid = DeviceGrid::for_family(FpgaFamily::Artix7, "xc7a35t");
    assert_eq!(grid.width, 40);
    assert_eq!(grid.height, 60);
    assert!(!grid.clock_regions.is_empty());
    assert_eq!(grid.columns.len(), 40);
    assert_eq!(grid.sites.len(), 40 * 60);

    // Check perimeter columns are IOB
    assert_eq!(grid.columns[0].site_type, SiteType::Iob);
    assert_eq!(grid.columns[39].site_type, SiteType::Iob);
    // Check central column has BUFG
    assert_eq!(grid.columns[20].site_type, SiteType::Bufg);
}

#[test]
fn test_cell_placement_and_heatmaps() {
    let circuit = create_mock_circuit();
    let grid = DeviceGrid::for_family(FpgaFamily::Artix7, "xc7a35t");
    let placer = AnalyticalPlacer::new(&circuit, &grid);
    let placement = placer.run_placement();

    assert_eq!(placement.placed_cells.len(), 4);
    let ibuf_a = placement.placed_cells.get("cell_ibuf_a").unwrap();
    assert_eq!(ibuf_a.site_type, SiteType::Iob);
    assert_eq!(ibuf_a.col, 0);

    let obuf_y = placement.placed_cells.get("cell_obuf_y").unwrap();
    assert_eq!(obuf_y.site_type, SiteType::Iob);
    assert_eq!(obuf_y.col, 39);

    let lut = placement.placed_cells.get("cell_lut_and").unwrap();
    assert!(lut.site_type == SiteType::SliceL || lut.site_type == SiteType::SliceM);
    assert!(lut.col > 0 && lut.col < 39);

    assert!(!placement.heatmap_tiles.is_empty());
}

#[test]
fn test_critical_path_extraction() {
    let circuit = create_mock_circuit();
    let floorplan = generate_floorplan(&circuit, "xc7a35tcpg236-1");

    assert!(floorplan.critical_path.is_some());
    let cp = floorplan.critical_path.unwrap();
    assert!(!cp.hops.is_empty());
    assert!(cp.total_delay_ps > 0.0);
    assert!(cp.logic_delay_ps > 0.0);
    assert!(cp.routing_delay_ps > 0.0);
    assert!(cp.slack_ps <= 5000.0);
}
