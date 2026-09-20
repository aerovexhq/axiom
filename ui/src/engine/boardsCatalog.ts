// Axiom EDA — Authentic Silicon Boards Catalog Database
// Contains industry-standard FPGA boards matching AMD Vivado Board Selection dialogs.

export interface FpgaBoard {
  id: string;
  name: string;
  displayName: string;
  vendor: "alpha-data.com" | "digilent.com" | "xilinx.com" | "avnet.com";
  revision: string;
  targetPartId: string;
  targetPartName: string;
  description: string;
  category: "PCIe Acceleration" | "Academic & Embedded" | "SoC Prototyping" | "Datacenter";
}

export const FPGA_BOARDS_DATABASE: FpgaBoard[] = [
  {
    id: "adm-pcie-7v3",
    name: "ADM-PCIE-7V3",
    displayName: "ADM-PCIE-7V3 PCIe Accelerator Board",
    vendor: "alpha-data.com",
    revision: "1.1",
    targetPartId: "xc7vx690t-ffg1761-2",
    targetPartName: "xc7vx690tffg1761-2",
    description: "High-performance PCI Express board featuring Virtex-7 690T FPGA with dual 10GbE SFP+ and DDR3 SDRAM.",
    category: "PCIe Acceleration"
  },
  {
    id: "nexys-a7-100t",
    name: "Nexys A7-100T",
    displayName: "Digilent Nexys A7 FPGA Trainer Board",
    vendor: "digilent.com",
    revision: "D.0",
    targetPartId: "xc7a100t-csg324-1",
    targetPartName: "xc7a100tcsg324-1",
    description: "Flagship engineering trainer board with Artix-7 100T, 16 tactile switches, 16 LEDs, dual 7-segment displays, and VGA.",
    category: "Academic & Embedded"
  },
  {
    id: "basys-3",
    name: "Basys 3",
    displayName: "Digilent Basys 3 Artix-7 Board",
    vendor: "digilent.com",
    revision: "C.1",
    targetPartId: "xc7a35t-csg324-1",
    targetPartName: "xc7a35tcsg324-1",
    description: "Entry-level digital circuit development board featuring Artix-7 35T FPGA, 4-digit 7-segment display, and USB-HID.",
    category: "Academic & Embedded"
  },
  {
    id: "zybo-z7-20",
    name: "Zybo Z7-20",
    displayName: "Digilent Zybo Z7 Zynq-7000 Board",
    vendor: "digilent.com",
    revision: "B.2",
    targetPartId: "xc7z020-clg400-1",
    targetPartName: "xc7z020clg400-1",
    description: "Embedded software & digital hardware platform with dual-core ARM Cortex-A9 and Zynq-7020 FPGA fabric.",
    category: "SoC Prototyping"
  },
  {
    id: "ultra96-v2",
    name: "Ultra96-V2",
    displayName: "Avnet Ultra96-V2 Zynq UltraScale+ Platform",
    vendor: "avnet.com",
    revision: "2.0",
    targetPartId: "xcku5p-ffvb676-2-e",
    targetPartName: "xcku5pffvb676-2-e",
    description: "Linaro 96Boards compliant evaluation board with quad-core ARM A53, dual-core R5, and UltraScale+ programmable logic.",
    category: "SoC Prototyping"
  },
  {
    id: "zcu102",
    name: "ZCU102",
    displayName: "AMD / Xilinx Zynq UltraScale+ ZCU102 Kit",
    vendor: "xilinx.com",
    revision: "1.1",
    targetPartId: "xcvu9p-flgb2104-2-e",
    targetPartName: "xcvu9pflgb2104-2-e",
    description: "General-purpose evaluation kit for rapid prototyping of 5G, ADAS, Industrial IoT, and video processing applications.",
    category: "SoC Prototyping"
  },
  {
    id: "alveo-u280",
    name: "Alveo U280",
    displayName: "AMD / Xilinx Alveo U280 Datacenter Accelerator",
    vendor: "xilinx.com",
    revision: "A.1",
    targetPartId: "xcvu13p-fhgb2104-2-e",
    targetPartName: "xcvu13pfhgb2104-2-e",
    description: "High-bandwidth 8GB HBM2 + 32GB DDR4 datacenter acceleration card for ML inference, algorithmic trading, and HPC.",
    category: "Datacenter"
  }
];
