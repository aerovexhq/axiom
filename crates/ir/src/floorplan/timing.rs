use super::types::{CriticalPathHop, PlacedCell, PlacedCriticalPath};
use crate::synth::SynthesizedCircuit;
use hashbrown::HashMap;

pub struct PhysicalTimingExtractor<'a> {
    circuit: &'a SynthesizedCircuit,
    placed_cells: &'a HashMap<String, PlacedCell>,
    clock_period_ps: f32,
}

impl<'a> PhysicalTimingExtractor<'a> {
    pub fn new(
        circuit: &'a SynthesizedCircuit,
        placed_cells: &'a HashMap<String, PlacedCell>,
        clock_period_ps: f32,
    ) -> Self {
        Self {
            circuit,
            placed_cells,
            clock_period_ps: if clock_period_ps > 0.0 { clock_period_ps } else { 5000.0 },
        }
    }

    pub fn extract_critical_path(&self) -> Option<PlacedCriticalPath> {
        if self.circuit.cells.is_empty() {
            return None;
        }

        // Map net_name -> driver cell_id and pin
        let mut net_drivers: HashMap<String, (String, String)> = HashMap::new();
        for cell in &self.circuit.cells {
            for (pin, net_name) in &cell.ports {
                let is_driver_pin = pin == "O" || pin == "Q" || pin == "P" || pin == "CO" || pin.starts_with("O[") || pin.starts_with("CO[");
                if is_driver_pin {
                    net_drivers.insert(net_name.clone(), (cell.id.clone(), pin.clone()));
                }
            }
        }

        // Build adjacency: cell_id -> Vec<(dest_cell_id, dest_pin, net_name, routing_delay)>
        let mut cell_fanout: HashMap<String, Vec<(String, String, String, f32)>> = HashMap::new();
        for net in &self.circuit.nets {
            if let Some((drv_id, _drv_pin)) = net_drivers.get(&net.name) {
                let drv_pos = self.placed_cells.get(drv_id);
                for (load_id, load_pin) in &net.load_cells {
                    let load_pos = self.placed_cells.get(load_id);
                    let routing_delay = if let (Some(d), Some(l)) = (drv_pos, load_pos) {
                        let manhattan = (d.col as i32 - l.col as i32).abs() + (d.row as i32 - l.row as i32).abs();
                        120.0 + 35.0 * (manhattan as f32)
                    } else {
                        150.0
                    };
                    cell_fanout.entry(drv_id.clone()).or_default().push((load_id.clone(), load_pin.clone(), net.name.clone(), routing_delay));
                }
            }
        }

        // Topological search: find longest delay path
        // Startpoints: IBUF or FDRE
        let startpoints: Vec<&str> = self.circuit.cells.iter().filter_map(|c| {
            let k = c.kind.to_string().to_lowercase();
            if k.starts_with("ibuf") || k.starts_with("fd") {
                Some(c.id.as_str())
            } else {
                None
            }
        }).collect();

        if startpoints.is_empty() {
            // Fallback: any cell without drivers
            return self.build_fallback_path();
        }

        // Dynamic programming / DFS longest path
        let mut best_path: Vec<(String, String, String, String, f32, f32)> = Vec::new(); // (src_id, dst_id, dst_pin, net, logic_delay, route_delay)
        let mut max_total_delay = 0.0f32;

        for &start_id in &startpoints {
            let mut current_chain: Vec<(String, String, String, String, f32, f32)> = Vec::new();
            let mut visited = hashbrown::HashSet::new();
            self.dfs_longest_path(
                start_id,
                &cell_fanout,
                &mut visited,
                &mut current_chain,
                0.0,
                &mut max_total_delay,
                &mut best_path,
            );
        }

        if best_path.is_empty() {
            return self.build_fallback_path();
        }

        // Construct PlacedCriticalPath
        let mut hops = Vec::with_capacity(best_path.len());
        let mut cumulative_delay = 0.0f32;
        let mut total_logic = 0.0f32;
        let mut total_route = 0.0f32;

        for (idx, (src_id, dst_id, dst_pin, net_name, logic_delay, route_delay)) in best_path.iter().enumerate() {
            let src_cell = self.circuit.cells.iter().find(|c| c.id == *src_id);
            let dst_cell = self.circuit.cells.iter().find(|c| c.id == *dst_id);
            let src_pos = self.placed_cells.get(src_id);
            let dst_pos = self.placed_cells.get(dst_id);

            cumulative_delay += logic_delay + route_delay;
            total_logic += logic_delay;
            total_route += route_delay;
            let slack = self.clock_period_ps - cumulative_delay;

            hops.push(CriticalPathHop {
                hop_index: idx as u32,
                source_cell: src_cell.map_or_else(|| src_id.clone(), |c| c.name.clone()),
                source_pin: "O".to_string(),
                source_site: src_pos.map_or_else(|| "SLICE_X0Y0".to_string(), |p| p.site_name.clone()),
                source_col: src_pos.map_or(0, |p| p.col),
                source_row: src_pos.map_or(0, |p| p.row),
                dest_cell: dst_cell.map_or_else(|| dst_id.clone(), |c| c.name.clone()),
                dest_pin: dst_pin.clone(),
                dest_site: dst_pos.map_or_else(|| "SLICE_X0Y0".to_string(), |p| p.site_name.clone()),
                dest_col: dst_pos.map_or(0, |p| p.col),
                dest_row: dst_pos.map_or(0, |p| p.row),
                net_name: net_name.clone(),
                logic_delay_ps: *logic_delay,
                routing_delay_ps: *route_delay,
                cumulative_delay_ps: cumulative_delay,
                slack_ps: slack,
            });
        }

        Some(PlacedCriticalPath {
            total_delay_ps: cumulative_delay,
            logic_delay_ps: total_logic,
            routing_delay_ps: total_route,
            slack_ps: self.clock_period_ps - cumulative_delay,
            logic_levels: hops.len() as u32,
            hops,
        })
    }

    fn dfs_longest_path(
        &self,
        current_id: &str,
        cell_fanout: &HashMap<String, Vec<(String, String, String, f32)>>,
        visited: &mut hashbrown::HashSet<String>,
        current_chain: &mut Vec<(String, String, String, String, f32, f32)>,
        current_delay: f32,
        max_total_delay: &mut f32,
        best_path: &mut Vec<(String, String, String, String, f32, f32)>,
    ) {
        let cell = match self.circuit.cells.iter().find(|c| c.id == current_id) {
            Some(c) => c,
            None => return,
        };
        let cell_logic_delay = cell.delay_ps;

        let loads = cell_fanout.get(current_id);
        if loads.is_none() || loads.unwrap().is_empty() || current_chain.len() >= 16 {
            // Reached endpoint
            let final_delay = current_delay + cell_logic_delay;
            if final_delay > *max_total_delay && !current_chain.is_empty() {
                *max_total_delay = final_delay;
                *best_path = current_chain.clone();
            }
            return;
        }

        visited.insert(current_id.to_string());

        for (next_id, next_pin, net_name, routing_delay) in loads.unwrap() {
            if visited.contains(next_id) {
                continue;
            }
            let step_delay = cell_logic_delay + routing_delay;
            current_chain.push((current_id.to_string(), next_id.clone(), next_pin.clone(), net_name.clone(), cell_logic_delay, *routing_delay));
            self.dfs_longest_path(
                next_id,
                cell_fanout,
                visited,
                current_chain,
                current_delay + step_delay,
                max_total_delay,
                best_path,
            );
            current_chain.pop();
        }

        visited.remove(current_id);
    }

    fn build_fallback_path(&self) -> Option<PlacedCriticalPath> {
        if self.circuit.cells.len() < 2 {
            return None;
        }
        let mut hops = Vec::new();
        let mut cumulative_delay = 0.0f32;

        for i in 0..self.circuit.cells.len().min(5) - 1 {
            let src = &self.circuit.cells[i];
            let dst = &self.circuit.cells[i + 1];
            let src_pos = self.placed_cells.get(&src.id);
            let dst_pos = self.placed_cells.get(&dst.id);

            let logic_delay = src.delay_ps;
            let routing_delay = 140.0;
            cumulative_delay += logic_delay + routing_delay;

            hops.push(CriticalPathHop {
                hop_index: i as u32,
                source_cell: src.name.clone(),
                source_pin: "O".to_string(),
                source_site: src_pos.map_or_else(|| "SLICE_X0Y0".to_string(), |p| p.site_name.clone()),
                source_col: src_pos.map_or(0, |p| p.col),
                source_row: src_pos.map_or(0, |p| p.row),
                dest_cell: dst.name.clone(),
                dest_pin: "I0".to_string(),
                dest_site: dst_pos.map_or_else(|| "SLICE_X0Y0".to_string(), |p| p.site_name.clone()),
                dest_col: dst_pos.map_or(0, |p| p.col),
                dest_row: dst_pos.map_or(0, |p| p.row),
                net_name: format!("net_{}_{}", src.name, dst.name),
                logic_delay_ps: logic_delay,
                routing_delay_ps: routing_delay,
                cumulative_delay_ps: cumulative_delay,
                slack_ps: self.clock_period_ps - cumulative_delay,
            });
        }

        let total_logic = hops.iter().map(|h| h.logic_delay_ps).sum();
        let total_route = hops.iter().map(|h| h.routing_delay_ps).sum();

        Some(PlacedCriticalPath {
            total_delay_ps: cumulative_delay,
            logic_delay_ps: total_logic,
            routing_delay_ps: total_route,
            slack_ps: self.clock_period_ps - cumulative_delay,
            logic_levels: hops.len() as u32,
            hops,
        })
    }
}
