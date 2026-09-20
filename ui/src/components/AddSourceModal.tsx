import React, { useState, useEffect, useRef } from "react";
import {
  FilePlus,
  Upload,
  FolderOpen,
  Trash2,
  FileCode,
  FileText,
  Database,
  Eye,
  Code,
  Sparkles
} from "lucide-react";
import { FileSetType, FileFormat, ProjectFile } from "../engine/projectModel";
import { Modal, Input, Select, Button, Card, Badge } from "./ui";
import { useTranslation } from "../i18n";
import { isDesktop, openFilesDialog } from "../engine/platform";
import { toast } from "../engine/toast";

export type HardwareSourceKind =
  | "verilog"
  | "systemverilog"
  | "verilog_header"
  | "vhdl"
  | "coe"
  | "mem"
  | "xdc";

interface StagedExistingFile {
  name: string;
  size: number;
  content: string;
  fileSet: FileSetType;
  fileType: FileFormat;
}

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (file: Omit<ProjectFile, "id">) => void;
  onAddSources?: (files: Omit<ProjectFile, "id">[]) => void;
  initialFileSet?: FileSetType;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
  onAddSources,
  initialFileSet
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"create" | "existing">("create");

  // Create Mode state
  const [sourceKind, setSourceKind] = useState<HardwareSourceKind>("verilog");
  const [fileBaseName, setFileBaseName] = useState<string>("submodule");
  const [moduleName, setModuleName] = useState<string>("submodule");
  const [fileSet, setFileSet] = useState<FileSetType>("sources_1");
  const [templateVariant, setTemplateVariant] = useState<string>("default");
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Existing Files Mode state
  const [stagedFiles, setStagedFiles] = useState<StagedExistingFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab("create");
      setStagedFiles([]);
      setShowPreview(false);

      if (initialFileSet === "constrs_1") {
        setSourceKind("xdc");
        setFileSet("constrs_1");
        setFileBaseName("constraints");
        setModuleName("");
        setTemplateVariant("timing_pin");
      } else if (initialFileSet === "sim_1") {
        setSourceKind("verilog");
        setFileSet("sim_1");
        setFileBaseName("testbench");
        setModuleName("testbench");
        setTemplateVariant("testbench");
      } else {
        setSourceKind("verilog");
        setFileSet("sources_1");
        setFileBaseName("submodule");
        setModuleName("submodule");
        setTemplateVariant("default");
      }
    }
  }, [isOpen, initialFileSet]);

  if (!isOpen) return null;

  // Derive file extension from sourceKind
  const getExtensionForKind = (kind: HardwareSourceKind): string => {
    switch (kind) {
      case "verilog":
        return ".v";
      case "systemverilog":
        return ".sv";
      case "verilog_header":
        return ".vh";
      case "vhdl":
        return ".vhd";
      case "coe":
        return ".coe";
      case "mem":
        return ".mem";
      case "xdc":
        return ".xdc";
    }
  };

  const getFileFormatForKind = (kind: HardwareSourceKind): FileFormat => {
    switch (kind) {
      case "verilog":
      case "verilog_header":
        return "verilog";
      case "systemverilog":
        return "systemverilog";
      case "vhdl":
        return "vhdl";
      case "coe":
      case "mem":
        return "mem";
      case "xdc":
        return "xdc";
    }
  };

  const currentExt = getExtensionForKind(sourceKind);
  const fullFileName = `${fileBaseName.trim() || "untitled"}${currentExt}`;

  // Handle kind switch
  const handleSelectSourceKind = (kind: HardwareSourceKind) => {
    setSourceKind(kind);
    if (kind === "xdc") {
      setFileSet("constrs_1");
      setTemplateVariant("timing_pin");
    } else {
      if (fileSet === "constrs_1") {
        setFileSet("sources_1");
      }
      setTemplateVariant("default");
    }
  };

  const handleFileNameChange = (val: string) => {
    // Strip extension if typed by user and determine kind
    let base = val;
    if (val.endsWith(".xdc") || val.endsWith(".sdc")) {
      base = val.replace(/\.(xdc|sdc)$/, "");
      setSourceKind("xdc");
      setFileSet("constrs_1");
    } else if (val.endsWith(".sv")) {
      base = val.replace(/\.sv$/, "");
      setSourceKind("systemverilog");
    } else if (val.endsWith(".vh")) {
      base = val.replace(/\.vh$/, "");
      setSourceKind("verilog_header");
    } else if (val.endsWith(".vhd") || val.endsWith(".vhdl")) {
      base = val.replace(/\.(vhd|vhdl)$/, "");
      setSourceKind("vhdl");
    } else if (val.endsWith(".coe")) {
      base = val.replace(/\.coe$/, "");
      setSourceKind("coe");
    } else if (val.endsWith(".mem") || val.endsWith(".hex")) {
      base = val.replace(/\.(mem|hex)$/, "");
      setSourceKind("mem");
    } else if (val.endsWith(".v")) {
      base = val.replace(/\.v$/, "");
      setSourceKind("verilog");
    }

    setFileBaseName(base);
    // Auto-update module stem if it matched previous base name
    const sanitizedStem = base.replace(/[^a-zA-Z0-9_]/g, "_");
    setModuleName(sanitizedStem);
  };

  // Generate Boilerplate Content
  const generateBoilerplate = (): string => {
    const rawModule = moduleName.trim() || fileBaseName.trim() || "my_module";
    const headerMacro = `${rawModule.toUpperCase()}_VH`;

    switch (sourceKind) {
      case "verilog": {
        if (templateVariant === "empty") return `// Vivado Design Source: ${fullFileName}\n\n`;
        if (templateVariant === "testbench") {
          return `// Vivado Simulation Testbench: ${fullFileName}
\`timescale 1ns / 1ps

module ${rawModule};
  reg clk;
  reg rst_n;

  // Clock generation (100 MHz)
  always #5 clk = ~clk;

  initial begin
    clk   = 0;
    rst_n = 0;
    #20 rst_n = 1;

    #500;
    $display("Simulation finished at %0t ps", $time);
    $finish;
  end
endmodule
`;
        }
        return `// Vivado Design Source: ${fullFileName}
\`timescale 1ns / 1ps

module ${rawModule} (
    input  wire        clk,
    input  wire        rst_n,
    input  wire [7:0]  data_in,
    output reg  [7:0]  data_out,
    output reg         valid
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      data_out <= 8'h00;
      valid    <= 1'b0;
    end else begin
      data_out <= data_in;
      valid    <= 1'b1;
    end
  end

endmodule
`;
      }

      case "systemverilog": {
        if (templateVariant === "empty") return `// SystemVerilog Source: ${fullFileName}\n\n`;
        if (templateVariant === "axis") {
          return `// IEEE 1800 SystemVerilog AXI4-Stream Interface: ${fullFileName}
\`timescale 1ns / 1ps

module ${rawModule} #(
    parameter int DATA_WIDTH = 32
) (
    input  logic                  clk,
    input  logic                  rst_n,

    // Slave AXI-Stream Input
    input  logic [DATA_WIDTH-1:0] s_axis_tdata,
    input  logic                  s_axis_tvalid,
    output logic                  s_axis_tready,

    // Master AXI-Stream Output
    output logic [DATA_WIDTH-1:0] m_axis_tdata,
    output logic                  m_axis_tvalid,
    input  logic                  m_axis_tready
);

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      m_axis_tdata  <= '0;
      m_axis_tvalid <= 1'b0;
      s_axis_tready <= 1'b1;
    end else begin
      if (s_axis_tvalid && s_axis_tready) begin
        m_axis_tdata  <= s_axis_tdata;
        m_axis_tvalid <= 1'b1;
      end else if (m_axis_tready) begin
        m_axis_tvalid <= 1'b0;
      end
    end
  end

endmodule
`;
        }
        return `// IEEE 1800 SystemVerilog Module: ${fullFileName}
\`timescale 1ns / 1ps

module ${rawModule} #(
    parameter int DATA_WIDTH = 8
) (
    input  logic                  clk,
    input  logic                  rst_n,
    input  logic [DATA_WIDTH-1:0] data_in,
    output logic [DATA_WIDTH-1:0] data_out,
    output logic                  valid
);

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      data_out <= '0;
      valid    <= 1'b0;
    end else begin
      data_out <= data_in;
      valid    <= 1'b1;
    end
  end

endmodule
`;
      }

      case "verilog_header": {
        if (templateVariant === "empty") return `// Verilog Header: ${fullFileName}\n\n`;
        return `\`ifndef ${headerMacro}
\`define ${headerMacro}

// ==============================================================================
// Vivado Verilog Header: ${fullFileName}
// Axiom EDA Preprocessor Definitions & Global Parameters
// ==============================================================================

\`define CLK_FREQ_HZ   100000000
\`define DATA_WIDTH    32
\`define ADDR_WIDTH    16

localparam TIMEOUT_CYCLES = 1024;

\`endif // ${headerMacro}
`;
      }

      case "vhdl": {
        if (templateVariant === "empty") return `-- IEEE 1076 VHDL Source: ${fullFileName}\n\n`;
        return `-- IEEE 1076 VHDL Entity & Architecture: ${fullFileName}
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity ${rawModule} is
    generic (
        DATA_WIDTH : integer := 8
    );
    port (
        clk      : in  std_logic;
        rst_n    : in  std_logic;
        data_in  : in  std_logic_vector(DATA_WIDTH-1 downto 0);
        data_out : out std_logic_vector(DATA_WIDTH-1 downto 0);
        valid    : out std_logic
    );
end entity ${rawModule};

architecture rtl of ${rawModule} is
    signal reg_data : std_logic_vector(DATA_WIDTH-1 downto 0) := (others => '0');
begin
    process(clk, rst_n)
    begin
        if rst_n = '0' then
            reg_data <= (others => '0');
            valid    <= '0';
        elsif rising_edge(clk) then
            reg_data <= data_in;
            valid    <= '1';
        end if;
    end process;

    data_out <= reg_data;
end architecture rtl;
`;
      }

      case "coe": {
        if (templateVariant === "empty") return `; Vivado BRAM COE: ${fullFileName}\n\n`;
        return `; Vivado Memory Initialization File (COE): ${fullFileName}
; Format: memory_initialization_radix and memory_initialization_vector
memory_initialization_radix = 16;
memory_initialization_vector =
    00000000,
    00000001,
    00000002,
    00000003,
    00000004,
    00000005,
    00000006,
    00000007;
`;
      }

      case "mem": {
        if (templateVariant === "empty") return `// Verilog $readmemh File: ${fullFileName}\n\n`;
        return `// Verilog $readmemh Memory Vector: ${fullFileName}
// Address 0x0000
@0000 00000093 00000113 00000193 00000213
@0004 00000293 00000313 00000393 00000413
@0008 deadbeef caffe001 12345678 87654321
`;
      }

      case "xdc": {
        if (templateVariant === "empty") return `## Vivado Constraints: ${fullFileName}\n\n`;
        return `## Vivado Timing & Physical Constraints: ${fullFileName}
create_clock -period 10.000 -name clk [get_ports clk]

## Pin Placements & IO Standards
set_property PACKAGE_PIN E3 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]
set_property PACKAGE_PIN C12 [get_ports rst_n]
set_property IOSTANDARD LVCMOS33 [get_ports rst_n]
`;
      }
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBase = fileBaseName.trim();
    if (!finalBase) return;

    const content = generateBoilerplate();
    const format = getFileFormatForKind(sourceKind);

    onAddSource({
      name: fullFileName,
      fileSet,
      fileType: format,
      isTop: false,
      content
    });
    toast.success(`Created source file: ${fullFileName}`);
    onClose();
  };

  // Staging logic for Existing Files
  const stageFilesFromList = async (files: FileList | File[]) => {
    const nextStaged: StagedExistingFile[] = [...stagedFiles];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name;
      const lower = name.toLowerCase();

      // Detect format
      let format: FileFormat = "verilog";
      let detectedSet: FileSetType = "sources_1";

      if (lower.endsWith(".xdc") || lower.endsWith(".sdc")) {
        format = "xdc";
        detectedSet = "constrs_1";
      } else if (lower.endsWith(".sv")) {
        format = "systemverilog";
      } else if (lower.endsWith(".vhd") || lower.endsWith(".vhdl")) {
        format = "vhdl";
      } else if (lower.endsWith(".coe") || lower.endsWith(".mem") || lower.endsWith(".hex")) {
        format = "mem";
      }

      if (lower.includes("_tb") || lower.includes("testbench") || lower.includes("_sim")) {
        detectedSet = "sim_1";
      }

      try {
        const text = await file.text();
        // Avoid duplicates
        if (!nextStaged.some((f) => f.name === name)) {
          nextStaged.push({
            name,
            size: file.size,
            content: text,
            fileSet: detectedSet,
            fileType: format
          });
        }
      } catch (err) {
        console.warn(`Failed to read file ${name}:`, err);
      }
    }

    setStagedFiles(nextStaged);
    if (nextStaged.length > stagedFiles.length) {
      toast.info(`Staged ${nextStaged.length - stagedFiles.length} file(s) for import`);
    }
  };

  const handleDesktopFilePicker = async () => {
    const paths = await openFilesDialog({
      title: "Select HDL Design & Constraint Sources",
      extensions: ["v", "sv", "vh", "vhd", "vhdl", "xdc", "sdc", "mem", "hex", "coe"]
    });

    if (!paths || paths.length === 0) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const nextStaged: StagedExistingFile[] = [...stagedFiles];

      for (const p of paths) {
        const parts = p.replace(/\\/g, "/").split("/");
        const name = parts[parts.length - 1];
        const lower = name.toLowerCase();

        let format: FileFormat = "verilog";
        let detectedSet: FileSetType = "sources_1";

        if (lower.endsWith(".xdc") || lower.endsWith(".sdc")) {
          format = "xdc";
          detectedSet = "constrs_1";
        } else if (lower.endsWith(".sv")) {
          format = "systemverilog";
        } else if (lower.endsWith(".vhd") || lower.endsWith(".vhdl")) {
          format = "vhdl";
        } else if (lower.endsWith(".coe") || lower.endsWith(".mem") || lower.endsWith(".hex")) {
          format = "mem";
        }

        if (lower.includes("_tb") || lower.includes("testbench") || lower.includes("_sim")) {
          detectedSet = "sim_1";
        }

        const content = await invoke<string>("fs_read_file", { path: p });
        if (!nextStaged.some((f) => f.name === name)) {
          nextStaged.push({
            name,
            size: content.length,
            content,
            fileSet: detectedSet,
            fileType: format
          });
        }
      }

      setStagedFiles(nextStaged);
      toast.info(`Staged ${paths.length} file(s) from disk`);
    } catch (err) {
      console.warn("Desktop file read error:", err);
      toast.error("Failed to read selected desktop files");
    }
  };

  const handleAddExistingSubmit = () => {
    if (stagedFiles.length === 0) return;

    const sourcesToAdd: Omit<ProjectFile, "id">[] = stagedFiles.map((f) => ({
      name: f.name,
      fileSet: f.fileSet,
      fileType: f.fileType,
      isTop: false,
      content: f.content
    }));

    if (onAddSources) {
      onAddSources(sourcesToAdd);
    } else {
      sourcesToAdd.forEach((f) => onAddSource(f));
    }

    toast.success(`Added ${sourcesToAdd.length} source file(s) to project`);
    onClose();
  };

  const fileSetOptions = [
    { value: "sources_1", label: "Design Sources", sublabel: "sources_1 • RTL logic, modules, headers & data" },
    { value: "sim_1", label: "Simulation Sources", sublabel: "sim_1 • Testbenches, verification harnesses" },
    { value: "constrs_1", label: "Constraints", sublabel: "constrs_1 • Timing & physical pin mappings (XDC)" }
  ];

  const sourceKindCards: {
    kind: HardwareSourceKind;
    title: string;
    ext: string;
    desc: string;
    icon: React.ReactNode;
    badge: string;
    badgeColor: "blue" | "purple" | "emerald" | "amber" | "cyan";
  }[] = [
    {
      kind: "verilog",
      title: "Verilog RTL",
      ext: ".v",
      desc: "IEEE 1364 Standard RTL module & clocked logic",
      icon: <FileCode size={15} color="var(--accent-blue)" />,
      badge: "IEEE 1364",
      badgeColor: "blue"
    },
    {
      kind: "systemverilog",
      title: "SystemVerilog",
      ext: ".sv",
      desc: "IEEE 1800 Logic, interfaces & temporal assertions",
      icon: <FileCode size={15} color="var(--accent-cyan)" />,
      badge: "IEEE 1800",
      badgeColor: "cyan"
    },
    {
      kind: "verilog_header",
      title: "Verilog Header",
      ext: ".vh",
      desc: "Macro include file with #ifndef/#define guards",
      icon: <Code size={15} color="#38bdf8" />,
      badge: "Header",
      badgeColor: "blue"
    },
    {
      kind: "vhdl",
      title: "VHDL Design",
      ext: ".vhd",
      desc: "IEEE 1076 Entity & Architecture definition",
      icon: <FileCode size={15} color="#10b981" />,
      badge: "IEEE 1076",
      badgeColor: "emerald"
    },
    {
      kind: "coe",
      title: "Memory COE",
      ext: ".coe",
      desc: "Xilinx BRAM/ROM vector with radix header",
      icon: <Database size={15} color="#f59e0b" />,
      badge: "Xilinx COE",
      badgeColor: "amber"
    },
    {
      kind: "mem",
      title: "Memory HEX",
      ext: ".mem",
      desc: "Verilog $readmemh memory vector format",
      icon: <Database size={15} color="#d97706" />,
      badge: "$readmemh",
      badgeColor: "amber"
    },
    {
      kind: "xdc",
      title: "Constraints",
      ext: ".xdc",
      desc: "Clock timing & physical package pin placements",
      icon: <FileText size={15} color="#a855f7" />,
      badge: "XDC/SDC",
      badgeColor: "purple"
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("modals.addSourceTitle") || "Add Sources"}
      subtitle={t("modals.addSourceSubtitle") || "Create new HDL hardware design files or import existing source code and constraints."}
      icon={<FilePlus size={18} />}
      width={720}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("modals.cancel") || "Cancel"}
          </Button>
          {activeTab === "create" ? (
            <Button variant="primary" size="sm" onClick={handleCreateSubmit} icon={<Sparkles size={14} />}>
              Create & Add File
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddExistingSubmit}
              disabled={stagedFiles.length === 0}
              icon={<Upload size={14} />}
            >
              Add {stagedFiles.length} File(s)
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Top Dual Tabs */}
        <div
          style={{
            display: "flex",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            padding: 3,
            border: "1px solid var(--border-subtle)"
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            style={{
              flex: 1,
              padding: "7px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: activeTab === "create" ? "var(--bg-card)" : "transparent",
              color: activeTab === "create" ? "#fff" : "var(--text-secondary)",
              fontWeight: activeTab === "create" ? 600 : 500,
              fontSize: 12.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.15s ease",
              boxShadow: activeTab === "create" ? "0 1px 4px rgba(0,0,0,0.3)" : "none"
            }}
          >
            <FilePlus size={15} color={activeTab === "create" ? "var(--accent-blue)" : "currentColor"} />
            Create New File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("existing")}
            style={{
              flex: 1,
              padding: "7px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: activeTab === "existing" ? "var(--bg-card)" : "transparent",
              color: activeTab === "existing" ? "#fff" : "var(--text-secondary)",
              fontWeight: activeTab === "existing" ? 600 : 500,
              fontSize: 12.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.15s ease",
              boxShadow: activeTab === "existing" ? "0 1px 4px rgba(0,0,0,0.3)" : "none"
            }}
          >
            <FolderOpen size={15} color={activeTab === "existing" ? "var(--accent-cyan)" : "currentColor"} />
            Add Existing Files
            {stagedFiles.length > 0 && (
              <Badge color="cyan" size="sm">
                {stagedFiles.length}
              </Badge>
            )}
          </button>
        </div>

        {/* TAB 1: CREATE NEW FILE */}
        {activeTab === "create" && (
          <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Target File Set */}
            <Select
              label={t("modals.fileSet") || "Target File Set"}
              value={fileSet}
              onChange={(val) => setFileSet(val as FileSetType)}
              options={fileSetOptions}
            />

            {/* Hardware File Type Picker Grid */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em"
                }}
              >
                Hardware Language & File Format
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 8,
                  maxHeight: 210,
                  overflowY: "auto",
                  paddingRight: 4
                }}
              >
                {sourceKindCards.map((item) => {
                  const isSelected = sourceKind === item.kind;
                  return (
                    <Card
                      key={item.kind}
                      clickable
                      selected={isSelected}
                      onClick={() => handleSelectSourceKind(item.kind)}
                      style={{
                        padding: "9px 11px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {item.icon}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isSelected ? "var(--accent-blue)" : "var(--text-primary)"
                            }}
                          >
                            {item.title}
                          </span>
                        </div>
                        <Badge color={item.badgeColor} size="sm">
                          {item.ext}
                        </Badge>
                      </div>
                      <p
                        style={{
                          fontSize: 10.5,
                          color: "var(--text-muted)",
                          margin: 0,
                          lineHeight: 1.3
                        }}
                      >
                        {item.desc}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* File Name & Module Name Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: sourceKind === "xdc" ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Input
                label="File Name"
                value={fileBaseName}
                onChange={(e) => handleFileNameChange(e.target.value)}
                placeholder="e.g. alu_control"
                helperText={`Will be created as: ${fullFileName}`}
              />

              {sourceKind !== "xdc" && (
                <Input
                  label="Module / Entity Name"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g. alu_control"
                  helperText="Name used in module or entity declaration"
                />
              )}
            </div>

            {/* Template Selection */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em"
                  }}
                >
                  Boilerplate Template
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: "var(--accent-blue)",
                    background: "none",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  <Eye size={12} />
                  {showPreview ? "Hide Preview" : "Preview Code"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  type="button"
                  size="xs"
                  variant={templateVariant === "default" || templateVariant === "timing_pin" ? "primary" : "ghost"}
                  onClick={() => setTemplateVariant(sourceKind === "xdc" ? "timing_pin" : "default")}
                >
                  {sourceKind === "vhdl"
                    ? "Synchronous Entity"
                    : sourceKind === "verilog_header"
                    ? "Macro Guards"
                    : sourceKind === "coe"
                    ? "Hex Vector"
                    : sourceKind === "xdc"
                    ? "Clock & Pins"
                    : "Standard Module"}
                </Button>

                {(sourceKind === "verilog" || sourceKind === "systemverilog") && (
                  <Button
                    type="button"
                    size="xs"
                    variant={templateVariant === "testbench" ? "primary" : "ghost"}
                    onClick={() => {
                      setTemplateVariant("testbench");
                      setFileSet("sim_1");
                    }}
                  >
                    Simulation Testbench
                  </Button>
                )}

                {sourceKind === "systemverilog" && (
                  <Button
                    type="button"
                    size="xs"
                    variant={templateVariant === "axis" ? "primary" : "ghost"}
                    onClick={() => setTemplateVariant("axis")}
                  >
                    AXI4-Stream Slice
                  </Button>
                )}

                <Button
                  type="button"
                  size="xs"
                  variant={templateVariant === "empty" ? "primary" : "ghost"}
                  onClick={() => setTemplateVariant("empty")}
                >
                  Empty File
                </Button>
              </div>
            </div>

            {/* Code Preview */}
            {showPreview && (
              <div
                style={{
                  backgroundColor: "#070a0f",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 12px",
                  border: "1px solid var(--border-subtle)",
                  maxHeight: 140,
                  overflowY: "auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: "#cbd5e1",
                  whiteSpace: "pre"
                }}
              >
                {generateBoilerplate()}
              </div>
            )}
          </form>
        )}

        {/* TAB 2: ADD EXISTING FILES */}
        {activeTab === "existing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Hidden HTML5 File Input */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".v,.sv,.vh,.vhd,.vhdl,.xdc,.sdc,.mem,.hex,.coe"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) {
                  stageFilesFromList(e.target.files);
                }
              }}
            />

            {/* Drag & Drop Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                  stageFilesFromList(e.dataTransfer.files);
                }
              }}
              style={{
                border: isDragging ? "2px dashed var(--accent-blue)" : "2px dashed var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                backgroundColor: isDragging ? "rgba(37, 99, 235, 0.08)" : "var(--bg-secondary)",
                padding: "24px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              onClick={() => {
                if (isDesktop()) {
                  handleDesktopFilePicker();
                } else {
                  fileInputRef.current?.click();
                }
              }}
            >
              <Upload size={28} color={isDragging ? "var(--accent-blue)" : "var(--text-muted)"} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  Drag and drop HDL design files or constraints here
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Supports .v, .sv, .vh, .vhd, .vhdl, .xdc, .sdc, .mem, .hex, .coe
                </div>
              </div>
              <Button
                variant="secondary"
                size="xs"
                icon={<FolderOpen size={13} />}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDesktop()) {
                    handleDesktopFilePicker();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
              >
                Browse Files...
              </Button>
            </div>

            {/* Staged Files List */}
            {stagedFiles.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8
                  }}
                >
                  <label
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em"
                    }}
                  >
                    Staged Files ({stagedFiles.length})
                  </label>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setStagedFiles([])}
                    icon={<Trash2 size={11} />}
                    style={{ color: "var(--accent-rose, #f43f5e)", fontSize: 11 }}
                  >
                    Clear All
                  </Button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 180,
                    overflowY: "auto"
                  }}
                >
                  {stagedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        backgroundColor: "var(--bg-secondary)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: 12
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                        {file.fileType === "xdc" ? (
                          <FileText size={14} color="var(--accent-purple)" />
                        ) : file.fileType === "vhdl" ? (
                          <FileCode size={14} color="#10b981" />
                        ) : file.fileType === "mem" ? (
                          <Database size={14} color="#f59e0b" />
                        ) : (
                          <FileCode size={14} color="var(--accent-blue)" />
                        )}
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{file.name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <select
                          value={file.fileSet}
                          onChange={(e) => {
                            const newSet = e.target.value as FileSetType;
                            setStagedFiles((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, fileSet: newSet } : f))
                            );
                          }}
                          style={{
                            fontSize: 11,
                            backgroundColor: "var(--bg-card)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-xs)",
                            padding: "3px 6px"
                          }}
                        >
                          <option value="sources_1">Design Sources (sources_1)</option>
                          <option value="sim_1">Simulation Sources (sim_1)</option>
                          <option value="constrs_1">Constraints (constrs_1)</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setStagedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: 2
                          }}
                          title="Remove file"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
