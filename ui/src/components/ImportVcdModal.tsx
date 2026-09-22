import React, { useState, useRef } from "react";
import {
  X, UploadCloud, FileText, AlertTriangle, Play, Check
} from "lucide-react";
import { SignalDef } from "../engine/engineBridge";
import {
  ParsedVcd, GoldenDiffReport, parseVcdText, computeWaveformDiff,
  generateSampleGoldenVcd
} from "../engine/vcdModel";
import { useTranslation } from "../i18n";
import { DropdownSelect } from "./ui";

interface ImportVcdModalProps {
  isOpen: boolean;
  onClose: () => void;
  simSignals: SignalDef[];
  topModule: string;
  onImportGolden: (vcd: ParsedVcd, report: GoldenDiffReport) => void;
}

export const ImportVcdModal: React.FC<ImportVcdModalProps> = ({
  isOpen,
  onClose,
  simSignals,
  topModule,
  onImportGolden
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string>("");
  const [parsedVcd, setParsedVcd] = useState<ParsedVcd | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Mappings: simSignalId -> goldenSignalId
  const [signalMap, setSignalMap] = useState<Record<string, string>>({});
  const [selectedSimIds, setSelectedSimIds] = useState<Set<string>>(
    () => new Set(simSignals.map((s) => s.id))
  );

  if (!isOpen) return null;

  const handleFileProcess = (name: string, content: string) => {
    try {
      setErrorMessage(null);
      const parsed = parseVcdText(content);
      if (parsed.signals.length === 0) {
        setErrorMessage(t("vcdImport.noSignalsError"));
        return;
      }
      setFileName(name);
      setParsedVcd(parsed);

      // Auto-match signals by name
      const newMap: Record<string, string> = {};
      const newSelected = new Set<string>();

      for (const sim of simSignals) {
        const match = parsed.signals.find(
          (g) => g.name === sim.name || g.fullName === sim.fullName || g.fullName.endsWith(`.${sim.name}`)
        );
        if (match) {
          newMap[sim.id] = match.id;
          newSelected.add(sim.id);
        }
      }

      setSignalMap(newMap);
      setSelectedSimIds(newSelected);
    } catch (err) {
      setErrorMessage(`Failed to parse VCD: ${String(err)}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleFileProcess(file.name, text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleFileProcess(file.name, text);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadSample = (injectFault: boolean) => {
    const sampleVcd = generateSampleGoldenVcd(topModule, simSignals, injectFault);
    const title = injectFault ? "golden_fault_demo.vcd" : "golden_vivado_reference.vcd";
    handleFileProcess(title, sampleVcd);
  };

  const handleRunDiff = () => {
    if (!parsedVcd) return;

    // Filter signals based on selection and mapping
    const map = new Map<string, string>();
    for (const simId of selectedSimIds) {
      const goldenId = signalMap[simId];
      if (goldenId) {
        map.set(simId, goldenId);
      }
    }

    const filteredSimSignals = simSignals.filter((s) => selectedSimIds.has(s.id) && signalMap[s.id]);

    if (filteredSimSignals.length === 0) {
      setErrorMessage("No valid signal mappings selected for waveform diff comparison.");
      return;
    }

    const report = computeWaveformDiff(filteredSimSignals, parsedVcd, map);
    onImportGolden(parsedVcd, report);
    onClose();
  };

  const toggleSelectAll = () => {
    if (selectedSimIds.size === simSignals.length) {
      setSelectedSimIds(new Set());
    } else {
      setSelectedSimIds(new Set(simSignals.map((s) => s.id)));
    }
  };

  const toggleSignal = (id: string) => {
    setSelectedSimIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "88vh",
          backgroundColor: "#0d1117",
          border: "1px solid var(--border-subtle, #30363d)",
          borderRadius: 10,
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.65)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#e6edf3"
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle, #30363d)",
            backgroundColor: "#161b22"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={18} color="var(--accent-cyan, #00f0ff)" />
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: "0.02em" }}>
                {t("vcdImport.modalTitle")}
              </h2>
              <span style={{ fontSize: 11, color: "var(--text-muted, #8b949e)" }}>
                {t("vcdImport.modalSubtitle")}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: 6, color: "var(--text-muted, #8b949e)", cursor: "pointer" }}
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: 20,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          {/* Dropzone Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? "var(--accent-cyan, #00f0ff)" : "#30363d"}`,
              borderRadius: 8,
              padding: "24px 20px",
              textAlign: "center",
              backgroundColor: isDragging ? "rgba(0, 240, 255, 0.04)" : "#0c1017",
              transition: "border-color 0.2s, background-color 0.2s"
            }}
          >
            <UploadCloud size={36} color="var(--accent-cyan, #00f0ff)" style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {t("vcdImport.dropText")}
            </div>
            <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 14 }}>
              Supports standard Vivado xsim, ModelSim, Verilator, Synopsys, or Cadence VCD traces
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".vcd,.txt"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 12, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FileText size={14} />
                {t("vcdImport.browseFile")}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleLoadSample(false)}
                style={{ fontSize: 12, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Check size={14} color="var(--accent-emerald, #10b981)" />
                {t("vcdImport.sampleDemo")} (Match)
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleLoadSample(true)}
                style={{ fontSize: 12, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <AlertTriangle size={14} color="var(--accent-rose, #f43f5e)" />
                {t("vcdImport.sampleDemo")} (Diff)
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(244, 63, 94, 0.12)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 12,
                color: "#f87171"
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parsed Metadata Summary Cards */}
          {parsedVcd && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8
                }}
              >
                <div
                  style={{
                    backgroundColor: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: "10px 12px"
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "#8b949e", textTransform: "uppercase", fontWeight: 600 }}>
                    File Name
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--accent-cyan, #00f0ff)",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                    title={fileName}
                  >
                    {fileName}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: "10px 12px"
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "#8b949e", textTransform: "uppercase", fontWeight: 600 }}>
                    {t("vcdImport.timescale")}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", marginTop: 2 }}>
                    {parsedVcd.timescaleStr || `${parsedVcd.timescalePs}ps`}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: "10px 12px"
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "#8b949e", textTransform: "uppercase", fontWeight: 600 }}>
                    {t("vcdImport.signalsCount")}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", marginTop: 2 }}>
                    {parsedVcd.signals.length} Signals
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: "10px 12px"
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "#8b949e", textTransform: "uppercase", fontWeight: 600 }}>
                    {t("vcdImport.duration")}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", marginTop: 2 }}>
                    {parsedVcd.endTimePs >= 1_000_000
                      ? `${(parsedVcd.endTimePs / 1_000_000).toFixed(2)}μs`
                      : parsedVcd.endTimePs >= 1000
                      ? `${(parsedVcd.endTimePs / 1000).toFixed(2)}ns`
                      : `${parsedVcd.endTimePs}ps`}
                  </div>
                </div>
              </div>

              {/* Signal Matching Table */}
              <div
                style={{
                  border: "1px solid #30363d",
                  borderRadius: 6,
                  overflow: "hidden",
                  backgroundColor: "#161b22"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderBottom: "1px solid #30363d",
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: "#0d1117"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedSimIds.size === simSignals.length && simSignals.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer" }}
                    />
                    <span>{t("vcdImport.mapSignalsTitle")} ({selectedSimIds.size} / {simSignals.length} selected)</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>
                    Map simulated net to golden reference VCD
                  </span>
                </div>

                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {simSignals.map((sim) => {
                    const isSelected = selectedSimIds.has(sim.id);
                    const mappedGoldenId = signalMap[sim.id];

                    return (
                      <div
                        key={sim.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 14px",
                          borderBottom: "1px solid rgba(48, 54, 61, 0.5)",
                          fontSize: 12,
                          backgroundColor: isSelected ? "transparent" : "rgba(0, 0, 0, 0.2)",
                          opacity: isSelected ? 1 : 0.6
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSignal(sim.id)}
                            style={{ cursor: "pointer" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                fontFamily: "JetBrains Mono, monospace",
                                fontWeight: 600,
                                color: "#e6edf3"
                              }}
                            >
                              {sim.name}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                color: "#8b949e",
                                padding: "1px 5px",
                                borderRadius: 3,
                                backgroundColor: "rgba(110, 118, 129, 0.2)"
                              }}
                            >
                              [{sim.width}b]
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#8b949e" }}>↔</span>
                          <DropdownSelect<string>
                            value={mappedGoldenId || ""}
                            onChange={(val) => {
                              setSignalMap((prev) => ({ ...prev, [sim.id]: val }));
                            }}
                            options={[
                              { value: "", label: "(Exclude from diff)" },
                              ...parsedVcd.signals.map((g) => ({
                                value: g.id,
                                label: `${g.name} [${g.width}b]`
                              }))
                            ]}
                            size="xs"
                            minWidth={190}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            padding: "14px 20px",
            borderTop: "1px solid var(--border-subtle, #30363d)",
            backgroundColor: "#161b22"
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!parsedVcd || selectedSimIds.size === 0}
            onClick={handleRunDiff}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={13} />
            {t("vcdImport.importDiffBtn")}
          </button>
        </div>
      </div>
    </div>
  );
};
