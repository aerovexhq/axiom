import React, { useState } from "react";
import { FilePlus, Check } from "lucide-react";
import { FileSetType, FileFormat, ProjectFile } from "../engine/projectModel";
import { Modal, Input, Select, Button, Card } from "./ui";
import { useTranslation } from "../i18n/i18nContext";

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
  const { t } = useTranslation();
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

  const handleFileSetChange = (val: string) => {
    const fset = val as FileSetType;
    setFileSet(fset);
    if (fset === "constrs_1") {
      setFileType("xdc");
      setTemplateKind("xdc");
      if (!fileName.endsWith(".xdc")) {
        setFileName(fileName.replace(/\.(v|sv)$/, "") + ".xdc");
      }
    } else if (fset === "sim_1") {
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

  const fileSetOptions = [
    { value: "sources_1", label: "Design Sources (sources_1)", sublabel: "Verilog / SystemVerilog RTL modules" },
    { value: "sim_1", label: "Simulation Sources (sim_1)", sublabel: "Testbenches with stimulus" },
    { value: "constrs_1", label: "Constraints (constrs_1)", sublabel: "Timing & pin constraints (XDC)" }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.modals.addSourceTitle}
      subtitle={t.modals.addSourceSubtitle}
      icon={<FilePlus size={18} />}
      width={600}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t.modals.cancel}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            {t.modals.addSourceBtn}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Target File Set */}
        <Select
          label={t.modals.fileSet}
          value={fileSet}
          onChange={handleFileSetChange}
          options={fileSetOptions}
        />

        {/* File Name */}
        <Input
          label={t.modals.fileName}
          value={fileName}
          onChange={(e) => handleFileNameChange(e.target.value)}
          placeholder="e.g. alu_submodule.v"
          helperText="Supported extensions: .v (Verilog), .sv (SystemVerilog), .xdc (Constraints)"
        />

        {/* Template Kind */}
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
            Initial File Content Template
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { id: "module", title: "RTL Module Skeleton", desc: "Clocked module template with clk, rst_n, and IO registers" },
              { id: "testbench", title: "Simulation Testbench", desc: "Clock generator, reset pulse, and timescale header" },
              { id: "xdc", title: "Timing Constraints (XDC)", desc: "create_clock, IO standard, and package pin directives" },
              { id: "empty", title: "Empty File", desc: "Blank file ready for custom code" }
            ].map((tmpl) => {
              const isSelected = templateKind === tmpl.id;
              return (
                <Card
                  key={tmpl.id}
                  clickable
                  selected={isSelected}
                  onClick={() => setTemplateKind(tmpl.id as any)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "10px 12px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: isSelected ? "var(--accent-blue)" : "var(--text-primary)" }}>
                      {tmpl.title}
                    </span>
                    {isSelected && <Check size={14} color="var(--accent-blue)" />}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, lineHeight: 1.35 }}>
                    {tmpl.desc}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
};
