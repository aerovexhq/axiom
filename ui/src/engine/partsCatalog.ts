// Axiom EDA — Silicon Parts Catalog Database
// Comprehensive FPGA part specifications matching authentic AMD Vivado part tables.

export interface FpgaPart {
  id: string;
  name: string;
  category: "Artix" | "Kintex" | "Virtex" | "Zynq" | "UltraScale+" | "Virtual";
  family: "Artix-7" | "Kintex-7" | "Virtex-7" | "Zynq-7000" | "Kintex UltraScale+" | "Virtex UltraScale+" | "Axiom Virtual";
  package: string;
  speedGrade: "-1" | "-2" | "-2L" | "-3";
  tempGrade: "Commercial (0°C ~ 85°C)" | "Industrial (-40°C ~ 100°C)" | "Aerospace (-55°C ~ 125°C)";
  availableIobs: number;
  lutElements: number;
  flipFlops: number;
  blockRams: number;
  ultraRams: number;
  dspSlices: number;
}

export const FPGA_PARTS_DATABASE: FpgaPart[] = [
  // Artix-7 Family
  {
    id: "xc7a35t-csg324-1",
    name: "xc7a35tcsg324-1",
    category: "Artix",
    family: "Artix-7",
    package: "csg324",
    speedGrade: "-1",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 210,
    lutElements: 20800,
    flipFlops: 41600,
    blockRams: 50,
    ultraRams: 0,
    dspSlices: 90
  },
  {
    id: "xc7a50t-csg324-2",
    name: "xc7a50tcsg324-2",
    category: "Artix",
    family: "Artix-7",
    package: "csg324",
    speedGrade: "-2",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 210,
    lutElements: 32600,
    flipFlops: 65200,
    blockRams: 75,
    ultraRams: 0,
    dspSlices: 120
  },
  {
    id: "xc7a100t-csg324-1",
    name: "xc7a100tcsg324-1",
    category: "Artix",
    family: "Artix-7",
    package: "csg324",
    speedGrade: "-1",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 210,
    lutElements: 63400,
    flipFlops: 126800,
    blockRams: 135,
    ultraRams: 0,
    dspSlices: 240
  },
  {
    id: "xc7a200t-fbg676-2",
    name: "xc7a200tfbg676-2",
    category: "Artix",
    family: "Artix-7",
    package: "fbg676",
    speedGrade: "-2",
    tempGrade: "Industrial (-40°C ~ 100°C)",
    availableIobs: 400,
    lutElements: 134600,
    flipFlops: 269200,
    blockRams: 365,
    ultraRams: 0,
    dspSlices: 740
  },

  // Kintex-7 Family
  {
    id: "xc7k160t-ffg676-2",
    name: "xc7k160tffg676-2",
    category: "Kintex",
    family: "Kintex-7",
    package: "ffg676",
    speedGrade: "-2",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 400,
    lutElements: 101400,
    flipFlops: 202800,
    blockRams: 325,
    ultraRams: 0,
    dspSlices: 600
  },
  {
    id: "xc7k325t-ffg900-2",
    name: "xc7k325tffg900-2",
    category: "Kintex",
    family: "Kintex-7",
    package: "ffg900",
    speedGrade: "-2",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 500,
    lutElements: 203800,
    flipFlops: 407600,
    blockRams: 445,
    ultraRams: 0,
    dspSlices: 840
  },
  {
    id: "xc7k410t-ffg900-2",
    name: "xc7k410tffg900-2",
    category: "Kintex",
    family: "Kintex-7",
    package: "ffg900",
    speedGrade: "-2",
    tempGrade: "Industrial (-40°C ~ 100°C)",
    availableIobs: 500,
    lutElements: 254200,
    flipFlops: 508400,
    blockRams: 795,
    ultraRams: 0,
    dspSlices: 1540
  },

  // Virtex-7 Family (includes parts from user's image media_1789893734769.png)
  {
    id: "xc7vx415t-ffg1157-1",
    name: "xc7vx415tffg1157-1",
    category: "Virtex",
    family: "Virtex-7",
    package: "ffg1157",
    speedGrade: "-1",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 600,
    lutElements: 257600,
    flipFlops: 515200,
    blockRams: 880,
    ultraRams: 0,
    dspSlices: 2160
  },
  {
    id: "xc7vx415t-ffg1158-1",
    name: "xc7vx415tffg1158-1",
    category: "Virtex",
    family: "Virtex-7",
    package: "ffg1158",
    speedGrade: "-1",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 350,
    lutElements: 257600,
    flipFlops: 515200,
    blockRams: 880,
    ultraRams: 0,
    dspSlices: 2160
  },
  {
    id: "xc7vx415t-ffg1927-3",
    name: "xc7vx415tffg1927-3",
    category: "Virtex",
    family: "Virtex-7",
    package: "ffg1927",
    speedGrade: "-3",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 850,
    lutElements: 257600,
    flipFlops: 515200,
    blockRams: 880,
    ultraRams: 0,
    dspSlices: 2160
  },
  {
    id: "xc7vx485t-ffg1157-2",
    name: "xc7vx485tffg1157-2",
    category: "Virtex",
    family: "Virtex-7",
    package: "ffg1157",
    speedGrade: "-2",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 600,
    lutElements: 303600,
    flipFlops: 607200,
    blockRams: 1030,
    ultraRams: 0,
    dspSlices: 2800
  },
  {
    id: "xc7vx690t-ffg1761-2",
    name: "xc7vx690tffg1761-2",
    category: "Virtex",
    family: "Virtex-7",
    package: "ffg1761",
    speedGrade: "-2",
    tempGrade: "Industrial (-40°C ~ 100°C)",
    availableIobs: 850,
    lutElements: 433200,
    flipFlops: 866400,
    blockRams: 1470,
    ultraRams: 0,
    dspSlices: 3600
  },

  // Zynq-7000 SoC Family
  {
    id: "xc7z010-clg400-1",
    name: "xc7z010clg400-1",
    category: "Zynq",
    family: "Zynq-7000",
    package: "clg400",
    speedGrade: "-1",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 100,
    lutElements: 17600,
    flipFlops: 35200,
    blockRams: 60,
    ultraRams: 0,
    dspSlices: 80
  },
  {
    id: "xc7z020-clg400-1",
    name: "xc7z020clg400-1",
    category: "Zynq",
    family: "Zynq-7000",
    package: "clg400",
    speedGrade: "-1",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 125,
    lutElements: 53200,
    flipFlops: 106400,
    blockRams: 140,
    ultraRams: 0,
    dspSlices: 220
  },

  // Kintex UltraScale+ Family
  {
    id: "xcku5p-ffvb676-2-e",
    name: "xcku5pffvb676-2-e",
    category: "UltraScale+",
    family: "Kintex UltraScale+",
    package: "ffvb676",
    speedGrade: "-2",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 280,
    lutElements: 216960,
    flipFlops: 433920,
    blockRams: 480,
    ultraRams: 32,
    dspSlices: 1824
  },
  {
    id: "xcku11p-ffve1517-2-i",
    name: "xcku11pffve1517-2-i",
    category: "UltraScale+",
    family: "Kintex UltraScale+",
    package: "ffve1517",
    speedGrade: "-2",
    tempGrade: "Industrial (-40°C ~ 100°C)",
    availableIobs: 572,
    lutElements: 297792,
    flipFlops: 595584,
    blockRams: 600,
    ultraRams: 48,
    dspSlices: 2928
  },

  // Virtex UltraScale+ Family
  {
    id: "xcvu9p-flgb2104-2-e",
    name: "xcvu9pflgb2104-2-e",
    category: "UltraScale+",
    family: "Virtex UltraScale+",
    package: "flgb2104",
    speedGrade: "-2",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 832,
    lutElements: 1182240,
    flipFlops: 2364480,
    blockRams: 2160,
    ultraRams: 960,
    dspSlices: 6840
  },
  {
    id: "xcvu13p-fhgb2104-2-e",
    name: "xcvu13pfhgb2104-2-e",
    category: "UltraScale+",
    family: "Virtex UltraScale+",
    package: "fhgb2104",
    speedGrade: "-2",
    tempGrade: "Commercial (0°C ~ 85°C)",
    availableIobs: 832,
    lutElements: 1728000,
    flipFlops: 3456000,
    blockRams: 2688,
    ultraRams: 1280,
    dspSlices: 12288
  },

  // Axiom In-RAM Virtual Silicon
  {
    id: "axiom-virtual-silicon",
    name: "axiom-virtual-silicon-jit",
    category: "Virtual",
    family: "Axiom Virtual",
    package: "inram",
    speedGrade: "-3",
    tempGrade: "Aerospace (-55°C ~ 125°C)",
    availableIobs: 1024,
    lutElements: 9999999,
    flipFlops: 9999999,
    blockRams: 4096,
    ultraRams: 2048,
    dspSlices: 16384
  }
];

export const DEFAULT_PART_ID = "xc7a100t-csg324-1";
export const DEFAULT_PART: FpgaPart =
  FPGA_PARTS_DATABASE.find((p) => p.id === DEFAULT_PART_ID) || FPGA_PARTS_DATABASE[2];
