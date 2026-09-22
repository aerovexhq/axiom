pub mod grid;
pub mod placer;
pub mod timing;
pub mod types;

#[cfg(test)]
pub mod tests;

pub use grid::DeviceGrid;
pub use placer::{AnalyticalPlacer, PlacementResult};
pub use timing::PhysicalTimingExtractor;
pub use types::*;

use crate::synth::{FpgaFamily, SynthesizedCircuit};

/// Generate complete physical FPGA silicon die floorplan with placement, heatmaps, and critical path.
pub fn generate_floorplan(circuit: &SynthesizedCircuit, device_name: &str) -> DieFloorplan {
    let family = FpgaFamily::from_device_name(device_name);
    let grid = DeviceGrid::for_family(family, device_name);
    let placer = AnalyticalPlacer::new(circuit, &grid);
    let placement = placer.run_placement();

    let timing_extractor = PhysicalTimingExtractor::new(circuit, &placement.placed_cells, 5000.0);
    let critical_path = timing_extractor.extract_critical_path();

    DieFloorplan {
        device_name: device_name.to_string(),
        family,
        grid_width: grid.width,
        grid_height: grid.height,
        clock_regions: grid.clock_regions,
        site_columns: grid.columns,
        placed_cells: placement.placed_cells,
        heatmap_tiles: placement.heatmap_tiles,
        critical_path,
        total_wirelength: placement.total_wirelength,
    }
}
