import React, { useState } from "react";
import { X, FilePlus } from "lucide-react";
import { FileSetType, FileFormat, ProjectFile } from "../engine/projectModel";

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (file: Omit<ProjectFile, "id">) => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource
}) => {
  const [fileName, setFileName] = useState<string>("submodule.v");
  const [fileSet, setFileSet] = useState<FileSetType>("sources_1");
  const [fileType, setFileType] = useState<FileFormat>("verilog");
  const [templateKind, setTemplateKind] = useState<"empty" | "module" | "testbench" | "xdc">("module");

  if (!isOpen) return null;

  const handleFileNameChange = (val: string) => {
    setFileName(val);
    if (val.endsWith(".xdc")) {
      setFileType("xdc");
      setFileSet("constrs_1");
      setTemplateKind("xdc");
    } else if (val.endsWith(".sv")) {
      setFileType("systemverilog");
    } else if (val.endsWith(".v")) {
      setFileType("verilog");
    }
  };

  const handleFileSetChange = (val: FileSetType) => {
    setFileSet(val);
    if (val === "constrs_1") {
      setFileType("xdc");
      setTemplateKind("xdc");
      if (!fileName.endsWith(".xdc")) {
        setFileName(fileName.replace(/\.(v|sv)$/, "") + ".xdc");
      }
    } else if (val === "sim_1") {
      setTemplateKind("testbench");
      if (fileName.endsWith(".xdc")) {
        setFileName(fileName.replace(/\.xdc$/, "_tb.v"));
        setFileType("verilog");
      }
    }
  };

  const generateContent = (): string => {
    const rawName = fileName.replace(/\.(v|sv|xdc)$/, "");
    if (templateKind === "empty") {
      return `// Vivado Source: ${fileName}\n\n`;
    }
    if (templateKind === "xdc") {
      return `## Vivado Timing & Physical Constraints: ${fileName}
create_clock -period 10.000 -name clk [get_ports clk]

## Pin Placements & IO Standards
set_property PACKAGE_PIN E3 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]
set_property PACKAGE_PIN C12 [get_ports rst_n]
set_property IOSTANDARD LVCMOS33 [get_ports rst_n]
`;
    }
    if (templateKind === "testbench") {
      return `// Vivado Simulation Testbench: ${fileName}
\`timescale 1ns / 1ps

module ${rawName};
  reg clk;
  reg rst_n;

  // Clock generation (100 MHz)
  always #5 clk = ~clk;

  initial begin
    clk = 0;
    rst_n = 0;
    #20 rst_n = 1;

    #500;
    $display("Simulation completed successfully at %0t ps", $time);
    $finish;
  end
endmodule
`;
    }
    // Default Module Skeleton
    return `// Vivado Design Source: ${fileName}
\`timescale 1ns / 1ps

module ${rawName} (
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = fileName.trim();
    if (!finalName) return;

    const content = generateContent();
    onAddSource({
      name: finalName,
      fileSet,
      fileType,
      isTop: false,
      content
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480,
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-primary)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FilePlus size={16} color="var(--accent-blue)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              Add Source to Vivado Project
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* File Name */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              SOURCE FILE NAME
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => handleFileNameChange(e.target.value)}
              placeholder="e.g. uart_rx.v or constraints.xdc"
              autoFocus
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                outline: "none"
              }}
            />
          </div>

          {/* Target File Set */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              TARGET FILE SET
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                { id: "sources_1", label: "Design Sources", sub: "RTL Logic" },
                { id: "sim_1", label: "Sim Sources", sub: "Testbenches" },
                { id: "constrs_1", label: "Constraints", sub: "Timing XDC" }
              ].map((fs) => {
                const isSelected = fileSet === fs.id;
                return (
                  <button
                    type="button"
                    key={fs.id}
                    onClick={() => handleFileSetChange(fs.id as FileSetType)}
                    style={{
                      padding: "8px 6px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${isSelected ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                      backgroundColor: isSelected ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "var(--accent-blue)" : "var(--text-primary)" }}>
                      {fs.label}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                      {fs.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Starter Template */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              STARTER TEMPLATE
            </label>
            <select
              value={templateKind}
              onChange={(e) => setTemplateKind(e.target.value as any)}
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 12,
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                outline: "none"
              }}
            >
              <option value="module">Synchronous RTL Module with Clock & Reset</option>
              <option value="testbench">Verilog Testbench Skeleton</option>
              <option value="xdc">XDC Clock & Timing Constraints</option>
              <option value="empty">Empty File</option>
            </select>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 6,
              paddingTop: 12,
              borderTop: "1px solid var(--border-subtle)"
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: "var(--accent-blue)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)"
              }}
            >
              Add Source File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
