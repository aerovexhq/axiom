// Axiom EDA — Physical FPGA Silicon Floorplan & Placement Model
import type { SynthesizedCircuit, FpgaFamily } from "./synthModel";

export type SiteType = "SliceL" | "SliceM" | "Dsp48" | "Ramb36" | "Iob" | "Bufg";

export interface ClockRegionDef {
  name: string;
  grid_x: number;
  grid_y: number;
  min_col: number;
  max_col: number;
  min_row: number;
  max_row: number;
}

export interface SiteColumnDef {
  col_index: number;
  site_type: SiteType;
}

export interface PlacedCell {
  id: string;
  name: string;
  kind: string;
  site_name: string;
  site_type: SiteType;
  col: number;
  row: number;
  bel_slot: string;
  logic_delay_ps: number;
}

export interface CriticalPathHop {
  hop_index: number;
  source_cell: string;
  source_pin: string;
  source_site: string;
  source_col: number;
  source_row: number;
  dest_cell: string;
  dest_pin: string;
  dest_site: string;
  dest_col: number;
  dest_row: number;
  net_name: string;
  logic_delay_ps: number;
  routing_delay_ps: number;
  cumulative_delay_ps: number;
  slack_ps: number;
}

export interface PlacedCriticalPath {
  total_delay_ps: number;
  logic_delay_ps: number;
  routing_delay_ps: number;
  slack_ps: number;
  logic_levels: number;
  hops: CriticalPathHop[];
}

export interface HeatmapTile {
  col: number;
  row: number;
  utilization_pct: number;
  congestion_score: number;
}

export interface DieFloorplan {
  device_name: string;
  family: FpgaFamily;
  grid_width: number;
  grid_height: number;
  clock_regions: ClockRegionDef[];
  site_columns: SiteColumnDef[];
  placed_cells: Record<string, PlacedCell>;
  heatmap_tiles: HeatmapTile[];
  critical_path?: PlacedCriticalPath | null;
  total_wirelength: number;
}

export interface FloorplanOptions {
  source?: string;
  topModule?: string;
  device?: string;
}

/**
 * Returns consistent dark engineering theme colors for physical FPGA site types.
 */
export function getSiteTypeColor(type: SiteType): string {
  switch (type) {
    case "SliceL":
      return "#238636"; // Green
    case "SliceM":
      return "#2ea043"; // Emerald
    case "Dsp48":
      return "#d29922"; // Amber
    case "Ramb36":
      return "#388bfd"; // Cyan / Blue
    case "Iob":
      return "#a371f7"; // Purple
    case "Bufg":
      return "#f778ba"; // Pink
    default:
      return "#30363d";
  }
}

/**
 * Returns color code for cell primitive kinds.
 */
export function getPrimitiveColor(kind: string): string {
  const k = kind.toLowerCase();
  if (k.startsWith("lut")) return "#238636"; // Green
  if (k.startsWith("fd")) return "#a371f7"; // Purple
  if (k.startsWith("carry")) return "#3fb950"; // Light green
  if (k.startsWith("dsp")) return "#d29922"; // Amber
  if (k.startsWith("ramb")) return "#388bfd"; // Blue
  if (k.startsWith("ibuf") || k.startsWith("obuf")) return "#58a6ff"; // Sky
  if (k.startsWith("bufg")) return "#f778ba"; // Pink
  return "#8b949e";
}

/**
 * Computes color gradient for silicon density heatmap.
 */
export function getHeatmapColor(utilPct: number, congestion: number): string {
  const score = Math.max(utilPct / 100, congestion);
  if (score <= 0.05) return "rgba(30, 41, 59, 0.4)";
  if (score < 0.25) return "rgba(34, 197, 94, 0.4)"; // Green
  if (score < 0.5) return "rgba(234, 179, 8, 0.45)"; // Yellow
  if (score < 0.75) return "rgba(249, 115, 22, 0.55)"; // Orange
  return "rgba(239, 68, 68, 0.65)"; // Red
}

/**
 * Deterministic client-side fallback floorplan generator.
 */
export function generateClientFallbackFloorplan(
  circuit: SynthesizedCircuit,
  deviceName: string = "xc7a35tcpg236-1"
): DieFloorplan {
  const devLower = deviceName.toLowerCase();
  const isUsp = devLower.includes("xcku") || devLower.includes("xcvu");
  const width = isUsp ? 80 : 40;
  const height = isUsp ? 120 : 60;
  const numCrX = isUsp ? 4 : 2;
  const numCrY = isUsp ? 4 : 2;

  // Build columns
  const site_columns: SiteColumnDef[] = [];
  const centerCol = Math.floor(width / 2);
  for (let c = 0; c < width; c++) {
    let st: SiteType = "SliceL";
    if (c === 0 || c === width - 1) st = "Iob";
    else if (c === centerCol) st = "Bufg";
    else if (c % 8 === 3) st = "Dsp48";
    else if (c % 8 === 7) st = "Ramb36";
    else if (c % 4 === 1) st = "SliceM";
    site_columns.push({ col_index: c, site_type: st });
  }

  // Build clock regions
  const clock_regions: ClockRegionDef[] = [];
  const colsPerCr = Math.ceil(width / numCrX);
  const rowsPerCr = Math.ceil(height / numCrY);
  for (let cy = 0; cy < numCrY; cy++) {
    const minR = cy * rowsPerCr;
    const maxR = Math.min(minR + rowsPerCr - 1, height - 1);
    for (let cx = 0; cx < numCrX; cx++) {
      const minC = cx * colsPerCr;
      const maxC = Math.min(minC + colsPerCr - 1, width - 1);
      clock_regions.push({
        name: `X${cx}Y${cy}`,
        grid_x: cx,
        grid_y: cy,
        min_col: minC,
        max_col: maxC,
        min_row: minR,
        max_row: maxR,
      });
    }
  }

  // Placed cells
  const placed_cells: Record<string, PlacedCell> = {};
  let inRow = 4;
  let outRow = 4;
  let sliceIdx = 0;

  for (const cell of circuit.cells) {
    const k = cell.kind.toLowerCase();
    if (k === "ibuf") {
      const row = Math.min(inRow, height - 2);
      inRow += 4;
      placed_cells[cell.id] = {
        id: cell.id,
        name: cell.name,
        kind: cell.kind,
        site_name: `IOB_X0Y${row}`,
        site_type: "Iob",
        col: 0,
        row,
        bel_slot: "INBUF0",
        logic_delay_ps: cell.delay_ps || 350,
      };
    } else if (k === "obuf") {
      const row = Math.min(outRow, height - 2);
      outRow += 4;
      placed_cells[cell.id] = {
        id: cell.id,
        name: cell.name,
        kind: cell.kind,
        site_name: `IOB_X1Y${row}`,
        site_type: "Iob",
        col: width - 1,
        row,
        bel_slot: "OUTBUF0",
        logic_delay_ps: cell.delay_ps || 450,
      };
    } else if (k.startsWith("bufg")) {
      placed_cells[cell.id] = {
        id: cell.id,
        name: cell.name,
        kind: cell.kind,
        site_name: `BUFG_X0Y${Math.floor(height / 2)}`,
        site_type: "Bufg",
        col: centerCol,
        row: Math.floor(height / 2),
        bel_slot: "BUFGCTRL",
        logic_delay_ps: cell.delay_ps || 90,
      };
    } else {
      // Core logic cell (LUT, FF, Carry)
      const col = 4 + (sliceIdx % 12);
      const row = 10 + Math.floor(sliceIdx / 12) * 3;
      sliceIdx++;
      placed_cells[cell.id] = {
        id: cell.id,
        name: cell.name,
        kind: cell.kind,
        site_name: `SLICE_X${col}Y${row}`,
        site_type: "SliceL",
        col,
        row,
        bel_slot: k.startsWith("fd") ? "AFF" : "A6LUT",
        logic_delay_ps: cell.delay_ps || 60,
      };
    }
  }

  // Heatmap tiles
  const tileSize = 4;
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);
  const heatmap_tiles: HeatmapTile[] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const count = Object.values(placed_cells).filter(
        (pc) =>
          pc.col >= tx * tileSize &&
          pc.col < (tx + 1) * tileSize &&
          pc.row >= ty * tileSize &&
          pc.row < (ty + 1) * tileSize
      ).length;
      const util = (count / (tileSize * tileSize * 8)) * 100;
      heatmap_tiles.push({
        col: tx,
        row: ty,
        utilization_pct: util,
        congestion_score: Math.min(util / 100, 1.0),
      });
    }
  }

  // Critical path hops
  const hops: CriticalPathHop[] = [];
  const cellList = Object.values(placed_cells);
  let cumDelay = 0;
  for (let i = 0; i < Math.min(cellList.length - 1, 6); i++) {
    const src = cellList[i];
    const dst = cellList[i + 1];
    const logicDelay = src.logic_delay_ps;
    const manhattan = Math.abs(src.col - dst.col) + Math.abs(src.row - dst.row);
    const routingDelay = 120 + 35 * manhattan;
    cumDelay += logicDelay + routingDelay;

    hops.push({
      hop_index: i,
      source_cell: src.name,
      source_pin: "O",
      source_site: src.site_name,
      source_col: src.col,
      source_row: src.row,
      dest_cell: dst.name,
      dest_pin: "I0",
      dest_site: dst.site_name,
      dest_col: dst.col,
      dest_row: dst.row,
      net_name: `net_${src.name}_${dst.name}`,
      logic_delay_ps: logicDelay,
      routing_delay_ps: routingDelay,
      cumulative_delay_ps: cumDelay,
      slack_ps: 5000 - cumDelay,
    });
  }

  const critical_path: PlacedCriticalPath = {
    total_delay_ps: cumDelay,
    logic_delay_ps: hops.reduce((sum, h) => sum + h.logic_delay_ps, 0),
    routing_delay_ps: hops.reduce((sum, h) => sum + h.routing_delay_ps, 0),
    slack_ps: 5000 - cumDelay,
    logic_levels: hops.length,
    hops,
  };

  return {
    device_name: deviceName,
    family: circuit.target_family || "Artix7",
    grid_width: width,
    grid_height: height,
    clock_regions,
    site_columns,
    placed_cells,
    heatmap_tiles,
    critical_path,
    total_wirelength: 1240.5,
  };
}
