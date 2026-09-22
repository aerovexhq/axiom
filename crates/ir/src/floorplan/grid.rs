use super::types::{ClockRegionDef, DieSite, SiteColumnDef, SiteType};
use crate::synth::FpgaFamily;

/// Architecture grid specification for physical FPGA silicon layout.
pub struct DeviceGrid {
    pub width: u32,
    pub height: u32,
    pub clock_regions: Vec<ClockRegionDef>,
    pub columns: Vec<SiteColumnDef>,
    pub sites: Vec<DieSite>,
}

impl DeviceGrid {
    pub fn for_family(family: FpgaFamily, _device_name: &str) -> Self {
        let (width, height, num_cr_x, num_cr_y) = match family {
            FpgaFamily::Artix7 => (40, 60, 2, 2),
            FpgaFamily::Zynq7000 => (48, 70, 2, 3),
            FpgaFamily::Kintex7 => (64, 90, 3, 3),
            FpgaFamily::Virtex7 => (72, 100, 3, 4),
            FpgaFamily::UltraScalePlus => (80, 120, 4, 4),
            FpgaFamily::VirtualSilicon => (32, 40, 2, 2),
        };

        // Determine column site types
        let mut columns = Vec::with_capacity(width as usize);
        let center_col = width / 2;
        for c in 0..width {
            let st = if c == 0 || c == width - 1 {
                SiteType::Iob
            } else if c == center_col {
                SiteType::Bufg
            } else if c % 8 == 3 {
                SiteType::Dsp48
            } else if c % 8 == 7 {
                SiteType::Ramb36
            } else if c % 4 == 1 {
                SiteType::SliceM
            } else {
                SiteType::SliceL
            };
            columns.push(SiteColumnDef {
                col_index: c,
                site_type: st,
            });
        }

        // Build clock regions
        let mut clock_regions = Vec::with_capacity((num_cr_x * num_cr_y) as usize);
        let cols_per_cr = (width + num_cr_x - 1) / num_cr_x;
        let rows_per_cr = (height + num_cr_y - 1) / num_cr_y;

        for cy in 0..num_cr_y {
            let min_r = cy * rows_per_cr;
            let max_r = (min_r + rows_per_cr - 1).min(height - 1);
            for cx in 0..num_cr_x {
                let min_c = cx * cols_per_cr;
                let max_c = (min_c + cols_per_cr - 1).min(width - 1);
                clock_regions.push(ClockRegionDef {
                    name: format!("X{}Y{}", cx, cy),
                    grid_x: cx,
                    grid_y: cy,
                    min_col: min_c,
                    max_col: max_c,
                    min_row: min_r,
                    max_row: max_r,
                });
            }
        }

        // Helper to find clock region for coordinates
        let find_cr = |col: u32, row: u32| -> String {
            for cr in &clock_regions {
                if col >= cr.min_col && col <= cr.max_col && row >= cr.min_row && row <= cr.max_row {
                    return cr.name.clone();
                }
            }
            "X0Y0".to_string()
        };

        // Instantiate all sites
        let mut sites = Vec::with_capacity((width * height) as usize);
        for c in 0..width {
            let st = columns[c as usize].site_type;
            for r in 0..height {
                let cr_name = find_cr(c, r);
                let id = match st {
                    SiteType::SliceL | SiteType::SliceM => format!("SLICE_X{}Y{}", c, r),
                    SiteType::Dsp48 => format!("DSP48_X{}Y{}", c / 8, r),
                    SiteType::Ramb36 => format!("RAMB36_X{}Y{}", c / 8, r),
                    SiteType::Iob => format!("IOB_X{}Y{}", if c == 0 { 0 } else { 1 }, r),
                    SiteType::Bufg => format!("BUFG_X0Y{}", r),
                };
                sites.push(DieSite {
                    id,
                    site_type: st,
                    col: c,
                    row: r,
                    clock_region: cr_name,
                    occupied_bels: Vec::new(),
                    max_bels: st.max_bels(),
                });
            }
        }

        Self {
            width,
            height,
            clock_regions,
            columns,
            sites,
        }
    }
}
