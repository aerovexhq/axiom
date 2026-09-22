use super::grid::DeviceGrid;
use super::types::{HeatmapTile, PlacedCell, SiteType};
use crate::synth::{SynthesizedCell, SynthesizedCircuit};
use hashbrown::HashMap;

pub struct PlacementResult {
    pub placed_cells: HashMap<String, PlacedCell>,
    pub heatmap_tiles: Vec<HeatmapTile>,
    pub total_wirelength: f32,
}

pub struct AnalyticalPlacer<'a> {
    circuit: &'a SynthesizedCircuit,
    grid: &'a DeviceGrid,
}

impl<'a> AnalyticalPlacer<'a> {
    pub fn new(circuit: &'a SynthesizedCircuit, grid: &'a DeviceGrid) -> Self {
        Self { circuit, grid }
    }

    pub fn run_placement(&self) -> PlacementResult {
        let mut placed_cells = HashMap::new();
        let mut site_occupancy: HashMap<(u32, u32), Vec<String>> = HashMap::new();

        // 1. Map I/O Buffers to perimeter IOB sites
        let mut in_row = 4u32;
        let mut out_row = 4u32;
        for cell in &self.circuit.cells {
            let kind_lower = cell.kind.to_string().to_lowercase();
            if kind_lower == "ibuf" {
                let col = 0;
                let row = in_row.min(self.grid.height - 2);
                in_row += 3;
                let site_name = format!("IOB_X0Y{}", row);
                let bel = if site_occupancy.get(&(col, row)).map_or(0, |v| v.len()) == 0 {
                    "INBUF0".to_string()
                } else {
                    "INBUF1".to_string()
                };
                site_occupancy.entry((col, row)).or_default().push(bel.clone());
                placed_cells.insert(
                    cell.id.clone(),
                    PlacedCell {
                        id: cell.id.clone(),
                        name: cell.name.clone(),
                        kind: cell.kind.to_string(),
                        site_name,
                        site_type: SiteType::Iob,
                        col,
                        row,
                        bel_slot: bel,
                        logic_delay_ps: cell.delay_ps,
                    },
                );
            } else if kind_lower == "obuf" {
                let col = self.grid.width - 1;
                let row = out_row.min(self.grid.height - 2);
                out_row += 3;
                let site_name = format!("IOB_X1Y{}", row);
                let bel = if site_occupancy.get(&(col, row)).map_or(0, |v| v.len()) == 0 {
                    "OUTBUF0".to_string()
                } else {
                    "OUTBUF1".to_string()
                };
                site_occupancy.entry((col, row)).or_default().push(bel.clone());
                placed_cells.insert(
                    cell.id.clone(),
                    PlacedCell {
                        id: cell.id.clone(),
                        name: cell.name.clone(),
                        kind: cell.kind.to_string(),
                        site_name,
                        site_type: SiteType::Iob,
                        col,
                        row,
                        bel_slot: bel,
                        logic_delay_ps: cell.delay_ps,
                    },
                );
            } else if kind_lower.starts_with("bufg") {
                let col = self.grid.width / 2;
                let row = self.grid.height / 2;
                let site_name = format!("BUFG_X0Y{}", row);
                placed_cells.insert(
                    cell.id.clone(),
                    PlacedCell {
                        id: cell.id.clone(),
                        name: cell.name.clone(),
                        kind: cell.kind.to_string(),
                        site_name,
                        site_type: SiteType::Bufg,
                        col,
                        row,
                        bel_slot: "BUFGCTRL".to_string(),
                        logic_delay_ps: cell.delay_ps,
                    },
                );
            }
        }

        // 2. Map Carry Chains into vertically contiguous slices
        let mut carry_col = 2u32;
        while carry_col < self.grid.width - 2 && self.grid.columns[carry_col as usize].site_type != SiteType::SliceL {
            carry_col += 1;
        }
        let mut carry_row = self.grid.height / 4;
        for cell in &self.circuit.cells {
            let kind_lower = cell.kind.to_string().to_lowercase();
            if kind_lower.starts_with("carry") {
                let site_name = format!("SLICE_X{}Y{}", carry_col, carry_row);
                site_occupancy.entry((carry_col, carry_row)).or_default().push("CARRY8".to_string());
                placed_cells.insert(
                    cell.id.clone(),
                    PlacedCell {
                        id: cell.id.clone(),
                        name: cell.name.clone(),
                        kind: cell.kind.to_string(),
                        site_name,
                        site_type: SiteType::SliceL,
                        col: carry_col,
                        row: carry_row,
                        bel_slot: "CARRY".to_string(),
                        logic_delay_ps: cell.delay_ps,
                    },
                );
                carry_row += 1;
            }
        }

        // 3. Map DSP48 multipliers onto dedicated DSP columns
        let dsp_col = self.grid.columns.iter().find(|c| c.site_type == SiteType::Dsp48).map(|c| c.col_index).unwrap_or(3);
        let mut dsp_row = self.grid.height / 3;
        for cell in &self.circuit.cells {
            let kind_lower = cell.kind.to_string().to_lowercase();
            if kind_lower.starts_with("dsp") {
                let site_name = format!("DSP48_X{}Y{}", dsp_col / 8, dsp_row);
                placed_cells.insert(
                    cell.id.clone(),
                    PlacedCell {
                        id: cell.id.clone(),
                        name: cell.name.clone(),
                        kind: cell.kind.to_string(),
                        site_name,
                        site_type: SiteType::Dsp48,
                        col: dsp_col,
                        row: dsp_row,
                        bel_slot: "DSP48E2".to_string(),
                        logic_delay_ps: cell.delay_ps,
                    },
                );
                dsp_row += 2;
            }
        }

        // 4. Map Block RAM onto dedicated BRAM columns
        let bram_col = self.grid.columns.iter().find(|c| c.site_type == SiteType::Ramb36).map(|c| c.col_index).unwrap_or(7);
        let mut bram_row = self.grid.height / 3;
        for cell in &self.circuit.cells {
            let kind_lower = cell.kind.to_string().to_lowercase();
            if kind_lower.starts_with("ramb") {
                let site_name = format!("RAMB36_X{}Y{}", bram_col / 8, bram_row);
                placed_cells.insert(
                    cell.id.clone(),
                    PlacedCell {
                        id: cell.id.clone(),
                        name: cell.name.clone(),
                        kind: cell.kind.to_string(),
                        site_name,
                        site_type: SiteType::Ramb36,
                        col: bram_col,
                        row: bram_row,
                        bel_slot: "RAMB36E2".to_string(),
                        logic_delay_ps: cell.delay_ps,
                    },
                );
                bram_row += 4;
            }
        }

        // 5. Build dependency levels for remaining LUTs and Flip-Flops
        let lut_ff_cells: Vec<&SynthesizedCell> = self.circuit.cells.iter().filter(|c| {
            let k = c.kind.to_string().to_lowercase();
            !k.starts_with("ibuf") && !k.starts_with("obuf") && !k.starts_with("bufg") && !k.starts_with("carry") && !k.starts_with("dsp") && !k.starts_with("ramb")
        }).collect();

        // Place LUTs and FFs in core slice columns (col = 2 .. grid.width - 2)
        let slice_cols: Vec<u32> = self.grid.columns.iter().filter(|c| c.site_type == SiteType::SliceL || c.site_type == SiteType::SliceM).map(|c| c.col_index).collect();
        let num_slice_cols = slice_cols.len().max(1);

        let bel_lut_names = ["A6LUT", "B6LUT", "C6LUT", "D6LUT", "A5LUT", "B5LUT", "C5LUT", "D5LUT"];
        let bel_ff_names = ["AFF", "BFF", "CFF", "DFF", "AFF2", "BFF2", "CFF2", "DFF2"];

        let mid_row = self.grid.height / 2;

        for (idx, cell) in lut_ff_cells.iter().enumerate() {
            let is_ff = cell.kind.to_string().to_lowercase().starts_with("fd");
            // Distribute across slice columns based on index and datapath flow
            let col_idx = (idx % num_slice_cols.min(12)) + 1;
            let col = slice_cols.get(col_idx).copied().unwrap_or(2);
            let row_offset = (idx / num_slice_cols) as i32;
            let row = ((mid_row as i32 + if idx % 2 == 0 { row_offset } else { -row_offset }).max(2) as u32).min(self.grid.height - 3);

            let cur_bels = site_occupancy.entry((col, row)).or_default();
            let bel = if is_ff {
                let slot = cur_bels.iter().filter(|b| b.ends_with("FF") || b.ends_with("FF2")).count();
                bel_ff_names.get(slot % bel_ff_names.len()).unwrap_or(&"AFF").to_string()
            } else {
                let slot = cur_bels.iter().filter(|b| b.ends_with("LUT")).count();
                bel_lut_names.get(slot % bel_lut_names.len()).unwrap_or(&"A6LUT").to_string()
            };
            cur_bels.push(bel.clone());

            let site_name = format!("SLICE_X{}Y{}", col, row);
            placed_cells.insert(
                cell.id.clone(),
                PlacedCell {
                    id: cell.id.clone(),
                    name: cell.name.clone(),
                    kind: cell.kind.to_string(),
                    site_name,
                    site_type: self.grid.columns[col as usize].site_type,
                    col,
                    row,
                    bel_slot: bel,
                    logic_delay_ps: cell.delay_ps,
                },
            );
        }

        // 6. Compute Half-Perimeter Wirelength (HPWL)
        let mut total_hpwl = 0.0f32;
        for net in &self.circuit.nets {
            let mut min_x = f32::MAX;
            let mut max_x = f32::MIN;
            let mut min_y = f32::MAX;
            let mut max_y = f32::MIN;
            let mut found_pins = 0;

            if let Some(drv_id) = &net.driver_cell {
                if let Some(pc) = placed_cells.get(drv_id) {
                    min_x = min_x.min(pc.col as f32);
                    max_x = max_x.max(pc.col as f32);
                    min_y = min_y.min(pc.row as f32);
                    max_y = max_y.max(pc.row as f32);
                    found_pins += 1;
                }
            }

            for (load_id, _) in &net.load_cells {
                if let Some(pc) = placed_cells.get(load_id) {
                    min_x = min_x.min(pc.col as f32);
                    max_x = max_x.max(pc.col as f32);
                    min_y = min_y.min(pc.row as f32);
                    max_y = max_y.max(pc.row as f32);
                    found_pins += 1;
                }
            }

            if found_pins >= 2 {
                total_hpwl += (max_x - min_x) + (max_y - min_y);
            }
        }

        // 7. Compute Heatmap Tiles (4x4 tile granularity)
        let tile_size = 4u32;
        let tiles_x = (self.grid.width + tile_size - 1) / tile_size;
        let tiles_y = (self.grid.height + tile_size - 1) / tile_size;
        let mut heatmap_tiles = Vec::with_capacity((tiles_x * tiles_y) as usize);

        for ty in 0..tiles_y {
            for tx in 0..tiles_x {
                let min_c = tx * tile_size;
                let max_c = (min_c + tile_size).min(self.grid.width);
                let min_r = ty * tile_size;
                let max_r = (min_r + tile_size).min(self.grid.height);

                let mut cell_count = 0u32;
                for c in min_c..max_c {
                    for r in min_r..max_r {
                        if let Some(occ) = site_occupancy.get(&(c, r)) {
                            cell_count += occ.len() as u32;
                        }
                    }
                }

                let max_capacity = (max_c - min_c) * (max_r - min_r) * 8;
                let util_pct = if max_capacity > 0 {
                    (cell_count as f32 / max_capacity as f32) * 100.0
                } else {
                    0.0
                };
                let congestion = (util_pct / 100.0 * 1.5).min(1.0);

                heatmap_tiles.push(HeatmapTile {
                    col: tx,
                    row: ty,
                    utilization_pct: util_pct,
                    congestion_score: congestion,
                });
            }
        }

        PlacementResult {
            placed_cells,
            heatmap_tiles,
            total_wirelength: total_hpwl,
        }
    }
}
