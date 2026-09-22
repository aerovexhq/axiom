import React, { useState, useEffect, useMemo } from "react";
import {
  Cpu,
  RefreshCw,
  Search,
  Download,
  FileCode,
  X,
  Copy,
  Check
} from "lucide-react";
import {
  SynthesizedCircuit,
  TARGET_DEVICES,
  synthesizeClientFallback
} from "../engine/synthModel";
import { engineBridge } from "../engine/engineBridge";
import { useTranslation } from "../i18n";

interface TechMappingViewerProps {
  activeDesignId?: string;
  topModule?: string;
  sourceCode?: string;
  targetDevice?: string;
  onDeviceChange?: (device: string) => void;
}

export const TechMappingViewer: React.FC<TechMappingViewerProps> = ({
  activeDesignId,
  topModule = "logic_circuit",
  sourceCode = "",
  targetDevice = "xcku5p-ffvb676-2-e",
  onDeviceChange
}) => {
  const { t } = useTranslation();
  const [selectedDevice, setSelectedDevice] = useState<string>(targetDevice);
  const [circuit, setCircuit] = useState<SynthesizedCircuit | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [isVerilogModalOpen, setIsVerilogModalOpen] = useState<boolean>(false);
  const [verilogText, setVerilogText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (targetDevice && targetDevice !== selectedDevice) {
      setSelectedDevice(targetDevice);
    }
  }, [targetDevice]);

  const runSynthesis = async (deviceToUse: string = selectedDevice) => {
    setIsLoading(true);
    try {
      const top = topModule || "top";
      const synth = await engineBridge.synthesizeDesign({
        source: sourceCode,
        topModule: top,
        device: deviceToUse,
        designId: activeDesignId || top
      });
      setCircuit(synth);
      if (synth.cells.length > 0 && (!selectedCellId || !synth.cells.some(c => c.id === selectedCellId))) {
        setSelectedCellId(synth.cells[0].id);
      }
    } catch (err) {
      console.warn("[TechMappingViewer] Synthesis failed, using client fallback:", err);
      const fallback = synthesizeClientFallback(activeDesignId || topModule, topModule, deviceToUse);
      setCircuit(fallback);
      if (fallback.cells.length > 0) {
        setSelectedCellId(fallback.cells[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runSynthesis(selectedDevice);
  }, [selectedDevice, topModule, activeDesignId]);

  const handleDeviceSelect = (dev: string) => {
    setSelectedDevice(dev);
    onDeviceChange?.(dev);
  };

  const handleOpenVerilogModal = async () => {
    if (circuit?.verilog_text) {
      setVerilogText(circuit.verilog_text);
    } else {
      try {
        const text = await engineBridge.exportSynthesizedVerilog({
          source: sourceCode,
          topModule: topModule || "top",
          device: selectedDevice,
          designId: activeDesignId || topModule
        });
        setVerilogText(text);
      } catch {
        setVerilogText("// Synthesis netlist export unavailable");
      }
    }
    setIsVerilogModalOpen(true);
  };

  const handleCopyVerilog = () => {
    if (!verilogText) return;
    navigator.clipboard.writeText(verilogText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadVerilog = () => {
    if (!verilogText) return;
    const blob = new Blob([verilogText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${topModule || "synthesized"}_netlist.v`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered cells list
  const filteredCells = useMemo(() => {
    if (!circuit) return [];
    return circuit.cells.filter((cell) => {
      // Type filter
      if (typeFilter === "LUT" && !cell.kind.toLowerCase().includes("lut")) return false;
      if (typeFilter === "FF" && !cell.kind.toLowerCase().startsWith("fd")) return false;
      if (typeFilter === "CARRY" && !cell.kind.toLowerCase().includes("carry")) return false;
      if (typeFilter === "DSP" && !cell.kind.toLowerCase().includes("dsp")) return false;
      if (typeFilter === "BRAM" && !cell.kind.toLowerCase().includes("ram")) return false;
      if (typeFilter === "IO" && !["ibuf", "obuf", "bufg", "bufgce"].includes(cell.kind.toLowerCase())) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = cell.name.toLowerCase().includes(q);
        const matchesKind = cell.kind.toLowerCase().includes(q);
        const matchesEq = cell.equation?.toLowerCase().includes(q);
        return matchesName || matchesKind || matchesEq;
      }

      return true;
    });
  }, [circuit, typeFilter, searchQuery]);

  const selectedCell = useMemo(() => {
    if (!circuit || !selectedCellId) return null;
    return circuit.cells.find((c) => c.id === selectedCellId) ?? circuit.cells[0] ?? null;
  }, [circuit, selectedCellId]);

  // Generate Truth Table for selected LUT
  const truthTableData = useMemo(() => {
    if (!selectedCell || !selectedCell.kind.toLowerCase().includes("lut")) return null;
    const inputPins = Object.keys(selectedCell.ports)
      .filter((p) => p.startsWith("I") && p !== "INIT")
      .sort((a, b) => {
        const numA = parseInt(a.slice(1), 10) || 0;
        const numB = parseInt(b.slice(1), 10) || 0;
        return numA - numB;
      });

    const k = Math.min(inputPins.length || 1, 6);
    const numRows = 1 << k;
    const initVal = selectedCell.params["INIT"] ?? 0;

    const rows = [];
    for (let i = 0; i < numRows; i++) {
      const outBit = ((initVal >> i) & 1) === 1 ? 1 : 0;
      const inputValues: Record<string, number> = {};
      for (let bit = 0; bit < k; bit++) {
        const pin = inputPins[bit] || `I${bit}`;
        inputValues[pin] = (i >> bit) & 1;
      }
      rows.push({
        index: i,
        inputs: inputValues,
        out: outBit
      });
    }

    return { inputPins, rows, initVal, k };
  }, [selectedCell]);

  const stats = circuit?.stats;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        overflow: "hidden"
      }}
    >
      {/* Top Header Ribbon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          gap: 12,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              color: "var(--accent-purple, #a855f7)"
            }}
          >
            <Cpu size={16} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{t("techMapping.title")}</span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 10,
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--accent-cyan)",
                  fontWeight: 600,
                  border: "1px solid var(--border-subtle)"
                }}
              >
                {circuit?.target_family || t("techMapping.targetDevice")}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Top: <strong style={{ color: "var(--text-primary)" }}>{circuit?.top_module || topModule}</strong>
            </div>
          </div>
        </div>

        {/* Device Selector & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("techMapping.targetDevice")}:</span>
            <select
              value={selectedDevice}
              onChange={(e) => handleDeviceSelect(e.target.value)}
              style={{
                height: 28,
                padding: "0 8px",
                fontSize: 11.5,
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                outline: "none"
              }}
            >
              {TARGET_DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => runSynthesis(selectedDevice)}
            disabled={isLoading}
            className="btn btn-ghost"
            style={{ height: 28, fontSize: 11.5, gap: 5, padding: "0 10px" }}
            title={t("techMapping.mapNetlist")}
          >
            <RefreshCw size={13} className={isLoading ? "spin" : ""} />
            <span>{isLoading ? t("techMapping.mapping") : t("techMapping.mapNetlist")}</span>
          </button>

          <button
            onClick={handleOpenVerilogModal}
            className="btn btn-primary"
            style={{ height: 28, fontSize: 11.5, gap: 5, padding: "0 10px" }}
            title={t("techMapping.exportVerilog")}
          >
            <FileCode size={13} />
            <span>{t("techMapping.exportVerilog")}</span>
          </button>
        </div>
      </div>

      {/* Utilization Statistics Banner */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 8,
            padding: "8px 16px",
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0
          }}
        >
          {/* Slice LUTs */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-muted)" }}>
              <span>{t("techMapping.sliceLuts")}</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{stats.lut_utilization_pct.toFixed(2)}%</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {stats.total_luts} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>/ {stats.target_lut_capacity.toLocaleString()}</span>
            </div>
            <div style={{ width: "100%", height: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(stats.lut_utilization_pct * 10, 100)}%`,
                  height: "100%",
                  backgroundColor: stats.lut_utilization_pct > 80 ? "var(--accent-amber)" : "var(--accent-cyan)"
                }}
              />
            </div>
          </div>

          {/* Flip-Flops */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-muted)" }}>
              <span>{t("techMapping.registers")}</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{stats.ff_utilization_pct.toFixed(2)}%</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {stats.total_ffs} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>/ {stats.target_ff_capacity.toLocaleString()}</span>
            </div>
            <div style={{ width: "100%", height: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(stats.ff_utilization_pct * 10, 100)}%`,
                  height: "100%",
                  backgroundColor: "var(--accent-purple, #a855f7)"
                }}
              />
            </div>
          </div>

          {/* Carry Chains */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("techMapping.carryChains")}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: stats.total_carries > 0 ? "var(--accent-green)" : "var(--text-primary)" }}>
              {stats.total_carries} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>{stats.carry8_count > 0 ? "CARRY8" : "CARRY4"}</span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>Arithmetic Add/Sub</div>
          </div>

          {/* DSP Multipliers */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("techMapping.dspSlices")}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: stats.dsp_count > 0 ? "var(--accent-amber)" : "var(--text-primary)" }}>
              {stats.dsp_count} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>DSP48</span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>Multiply / MAC</div>
          </div>

          {/* Block RAM */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("techMapping.blockRams")}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: stats.bram_count > 0 ? "var(--accent-cyan)" : "var(--text-primary)" }}>
              {stats.bram_count} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>BRAM</span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>Synchronous Memory</div>
          </div>

          {/* I/O Buffers */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("techMapping.ioBuffers")}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {stats.total_iobs} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>Pins</span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{stats.ibuf_count} In / {stats.obuf_count} Out</div>
          </div>

          {/* Logic Depth & Delay */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              gap: 3
            }}
          >
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("techMapping.logicDepth")}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-cyan)" }}>
              {stats.logic_depth} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>levels &bull; {stats.estimated_delay_ps.toFixed(0)} ps</span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{t("techMapping.estDelay")}</div>
          </div>
        </div>
      )}

      {/* Main Dual-Pane Content Area */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Left Pane: Filterable Mapped Primitives Table */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid var(--border-subtle)",
            minWidth: 0,
            backgroundColor: "var(--bg-primary)"
          }}
        >
          {/* Filter Bar */}
          <div
            style={{
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-secondary)",
              flexWrap: "wrap"
            }}
          >
            <div
              style={{
                position: "relative",
                flex: "1 1 180px",
                maxWidth: 260
              }}
            >
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)"
                }}
              />
              <input
                type="text"
                placeholder={t("techMapping.searchCells")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 26,
                  paddingLeft: 26,
                  paddingRight: 8,
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 11.5,
                  outline: "none"
                }}
              />
            </div>

            {/* Type Filter Pills */}
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {[
                { key: "ALL", label: t("techMapping.filterAll") },
                { key: "LUT", label: t("techMapping.filterLut") },
                { key: "FF", label: t("techMapping.filterFf") },
                { key: "CARRY", label: t("techMapping.filterCarry") },
                { key: "DSP", label: t("techMapping.filterDsp") },
                { key: "BRAM", label: t("techMapping.filterBram") },
                { key: "IO", label: t("techMapping.filterIo") },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  style={{
                    padding: "2px 8px",
                    fontSize: 10.5,
                    fontWeight: typeFilter === key ? 600 : 400,
                    borderRadius: 3,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: typeFilter === key ? "var(--bg-tertiary)" : "transparent",
                    color: typeFilter === key ? "var(--accent-cyan)" : "var(--text-muted)"
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
              {filteredCells.length} / {circuit?.cells.length ?? 0} Cells
            </div>
          </div>

          {/* Table Container */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11.5,
                textAlign: "left"
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: "var(--bg-secondary)",
                  borderBottom: "1px solid var(--border-subtle)",
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: "6px 10px", width: 90, color: "var(--text-muted)" }}>Primitive</th>
                  <th style={{ padding: "6px 10px", color: "var(--text-muted)" }}>Cell Instance Name</th>
                  <th style={{ padding: "6px 10px", width: 70, color: "var(--text-muted)" }}>Pins</th>
                  <th style={{ padding: "6px 10px", color: "var(--text-muted)" }}>Boolean Logic / Details</th>
                  <th style={{ padding: "6px 10px", width: 75, textAlign: "right", color: "var(--text-muted)" }}>Delay</th>
                </tr>
              </thead>
              <tbody>
                {filteredCells.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                      No technology-mapped cells found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredCells.map((cell) => {
                    const isSelected = cell.id === selectedCellId;
                    const kindLower = cell.kind.toLowerCase();
                    const isLut = kindLower.includes("lut");
                    const isFf = kindLower.startsWith("fd");
                    const isCarry = kindLower.includes("carry");
                    const isDsp = kindLower.includes("dsp");
                    const isBram = kindLower.includes("ram");

                    let badgeColor = "var(--text-muted)";
                    if (isLut) badgeColor = "var(--accent-cyan)";
                    else if (isFf) badgeColor = "var(--accent-purple, #a855f7)";
                    else if (isCarry) badgeColor = "var(--accent-green)";
                    else if (isDsp) badgeColor = "var(--accent-amber)";
                    else if (isBram) badgeColor = "#38bdf8";

                    return (
                      <tr
                        key={cell.id}
                        onClick={() => setSelectedCellId(cell.id)}
                        style={{
                          backgroundColor: isSelected ? "rgba(6, 182, 212, 0.12)" : "transparent",
                          cursor: "pointer",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
                        }}
                      >
                        <td style={{ padding: "6px 10px" }}>
                          <span
                            style={{
                              padding: "2px 5px",
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 700,
                              backgroundColor: "var(--bg-tertiary)",
                              color: badgeColor,
                              border: `1px solid ${isSelected ? badgeColor : "transparent"}`
                            }}
                          >
                            {cell.kind.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono, monospace)", fontWeight: isSelected ? 600 : 400 }}>
                          {cell.name}
                        </td>
                        <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                          {Object.keys(cell.ports).length} pins
                        </td>
                        <td style={{ padding: "6px 10px", color: cell.equation ? "var(--text-primary)" : "var(--text-muted)", fontStyle: cell.equation ? "normal" : "italic" }}>
                          {cell.equation || (cell.params["INIT"] !== undefined ? `INIT = 0x${cell.params["INIT"].toString(16).toUpperCase()}` : "-")}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "var(--font-mono, monospace)", color: "var(--text-muted)" }}>
                          {cell.delay_ps.toFixed(0)} ps
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Pane: Primitive Deep Inspector */}
        <div
          style={{
            width: 380,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--bg-secondary)",
            overflowY: "auto",
            flexShrink: 0
          }}
        >
          {selectedCell ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 14 }}>
              {/* Header Card */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedCell.name}</span>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 3,
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: "rgba(6, 182, 212, 0.15)",
                      color: "var(--accent-cyan)"
                    }}
                  >
                    {selectedCell.kind.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Scope: <span style={{ color: "var(--text-primary)" }}>{selectedCell.scope}</span> &bull; Delay:{" "}
                  <span style={{ color: "var(--text-primary)" }}>{selectedCell.delay_ps.toFixed(1)} ps</span>
                </div>
              </div>

              {/* Boolean Equation Card */}
              {selectedCell.equation && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                    Boolean Equation
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      backgroundColor: "var(--bg-tertiary)",
                      borderRadius: "var(--radius-sm)",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 11.5,
                      border: "1px solid var(--border-subtle)",
                      color: "var(--accent-cyan)"
                    }}
                  >
                    {selectedCell.equation}
                  </div>
                </div>
              )}

              {/* Port Connectivity Table */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                  {t("techMapping.pinsMapping")}
                </div>
                <div
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden"
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <tr>
                        <th style={{ padding: "4px 8px", width: 70, color: "var(--text-muted)" }}>Pin</th>
                        <th style={{ padding: "4px 8px", color: "var(--text-muted)" }}>Connected Net / Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedCell.ports).map(([pin, net], idx) => (
                        <tr
                          key={pin}
                          style={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                            backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)"
                          }}
                        >
                          <td style={{ padding: "4px 8px", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                            {pin}
                          </td>
                          <td style={{ padding: "4px 8px", fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)" }}>
                            {net}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Configuration Parameters */}
              {Object.keys(selectedCell.params).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                    {t("techMapping.parameters")}
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden"
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <tr>
                          <th style={{ padding: "4px 8px", color: "var(--text-muted)" }}>Parameter</th>
                          <th style={{ padding: "4px 8px", color: "var(--text-muted)", textAlign: "right" }}>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedCell.params).map(([param, val]) => (
                          <tr key={param} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <td style={{ padding: "4px 8px", fontWeight: 600 }}>{param}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-mono, monospace)", color: "var(--accent-cyan)" }}>
                              0x{val.toString(16).toUpperCase()} <span style={{ color: "var(--text-muted)", fontSize: 10 }}>({val})</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Truth Table HUD for LUTs */}
              {truthTableData && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {t("techMapping.truthTableTitle")} ({truthTableData.k}-Input)
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      INIT = 0x{truthTableData.initVal.toString(16).toUpperCase()}
                    </span>
                  </div>

                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: "auto",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)"
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, textAlign: "center" }}>
                      <thead style={{ position: "sticky", top: 0, backgroundColor: "var(--bg-tertiary)" }}>
                        <tr>
                          <th style={{ padding: "3px 6px", color: "var(--text-muted)" }}>#</th>
                          {truthTableData.inputPins.map((pin) => (
                            <th key={pin} style={{ padding: "3px 6px", color: "var(--text-muted)" }}>
                              {pin}
                            </th>
                          ))}
                          <th style={{ padding: "3px 6px", color: "var(--accent-cyan)", fontWeight: 700 }}>O</th>
                        </tr>
                      </thead>
                      <tbody>
                        {truthTableData.rows.map((row) => (
                          <tr
                            key={row.index}
                            style={{
                              backgroundColor: row.out === 1 ? "rgba(6, 182, 212, 0.08)" : "transparent",
                              borderBottom: "1px solid rgba(255, 255, 255, 0.03)"
                            }}
                          >
                            <td style={{ padding: "2px 6px", color: "var(--text-muted)", fontSize: 9.5 }}>{row.index}</td>
                            {truthTableData.inputPins.map((pin) => (
                              <td key={pin} style={{ padding: "2px 6px", fontFamily: "var(--font-mono, monospace)" }}>
                                {row.inputs[pin] ?? 0}
                              </td>
                            ))}
                            <td
                              style={{
                                padding: "2px 6px",
                                fontWeight: 700,
                                color: row.out === 1 ? "var(--accent-cyan)" : "var(--text-muted)",
                                fontFamily: "var(--font-mono, monospace)"
                              }}
                            >
                              {row.out}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              {t("techMapping.noCellSelected")}
            </div>
          )}
        </div>
      </div>

      {/* Structural Verilog Netlist Modal */}
      {isVerilogModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md, 8px)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "var(--bg-tertiary)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileCode size={16} style={{ color: "var(--accent-cyan)" }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {t("techMapping.verilogModalTitle")} ({topModule}.v)
                </span>
              </div>
              <button
                onClick={() => setIsVerilogModalOpen(false)}
                className="btn btn-ghost btn-icon"
                style={{ width: 26, height: 26 }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body / Code View */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, backgroundColor: "#0b0f14" }}>
              <pre
                style={{
                  margin: 0,
                  fontFamily: "var(--font-mono, 'Fira Code', monospace)",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: "#d4d4d4",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all"
                }}
              >
                {verilogText}
              </pre>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
                backgroundColor: "var(--bg-tertiary)"
              }}
            >
              <button
                onClick={handleCopyVerilog}
                className="btn btn-ghost"
                style={{ height: 28, fontSize: 11.5, gap: 5 }}
              >
                {copied ? <Check size={13} style={{ color: "var(--accent-green)" }} /> : <Copy size={13} />}
                <span>{copied ? t("techMapping.copied") : t("common.copy")}</span>
              </button>
              <button
                onClick={handleDownloadVerilog}
                className="btn btn-primary"
                style={{ height: 28, fontSize: 11.5, gap: 5 }}
              >
                <Download size={13} />
                <span>{t("techMapping.downloadVerilog")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
