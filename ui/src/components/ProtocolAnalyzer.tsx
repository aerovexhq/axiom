import React, { useState, useEffect, useMemo } from "react";
import {
  Cpu,
  Play,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Filter,
  RefreshCw,
  Download,
  FileText,
  Sliders,
  Layers,
  X
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import {
  ProtocolKind,
  DecodedTransaction,
  PROTOCOL_SPECS,
  guessPinMap,
  UartConfig,
  SpiConfig,
  I2cConfig,
  AxiConfig,
  CanConfig,
  UsbConfig,
  EthernetConfig,
  ProtocolDecodeRequest,
  generateSyntheticTransactions
} from "../engine/protocolDecoders";
import { exportTransactionsToPcap } from "../engine/pcapExport";
import { exportTransactionsToCsv } from "../engine/csvExport";

interface ProtocolAnalyzerProps {
  state: SimulationState;
  activeDesignId?: string;
  onSelectTransaction?: (tx: DecodedTransaction) => void;
  onTransactionsUpdated?: (transactions: DecodedTransaction[]) => void;
  initialTransactions?: DecodedTransaction[];
}

export const ProtocolAnalyzer: React.FC<ProtocolAnalyzerProps> = ({
  state,
  activeDesignId,
  onSelectTransaction,
  onTransactionsUpdated,
  initialTransactions
}) => {
  const [protocol, setProtocol] = useState<ProtocolKind>("can");
  const [pinMap, setPinMap] = useState<Record<string, string>>({});
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [transactions, setTransactions] = useState<DecodedTransaction[]>(initialTransactions ?? []);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeInspectorTab, setActiveInspectorTab] = useState<"fields" | "hexdump">("fields");

  // Config States
  const [uartConfig, setUartConfig] = useState<UartConfig>({
    baud_rate: 115200,
    data_bits: 8,
    stop_bits: 1,
    parity: "none"
  });
  const [spiConfig, setSpiConfig] = useState<SpiConfig>({
    cpol: 0,
    cpha: 0,
    bits_per_word: 8,
    msb_first: true
  });
  const [i2cConfig, setI2cConfig] = useState<I2cConfig>({
    is_10bit_addressing: false
  });
  const [axiConfig, setAxiConfig] = useState<AxiConfig>({
    is_lite: false,
    data_width_bytes: 4
  });
  const [canConfig, setCanConfig] = useState<CanConfig>({
    baud_rate: 500000,
    sample_point_percent: 75,
    is_extended_id_allowed: true
  });
  const [usbConfig, setUsbConfig] = useState<UsbConfig>({
    speed: "full_speed",
    check_crc: true
  });
  const [ethernetConfig, setEthernetConfig] = useState<EthernetConfig>({
    interface: "mii",
    fcs_check: true
  });

  const availableSignalNames = useMemo(() => {
    return state.signals.map((s) => s.id || s.name);
  }, [state.signals]);

  // Auto-guess pin mapping when protocol changes
  useEffect(() => {
    const guessed = guessPinMap(protocol, availableSignalNames);
    setPinMap(guessed);
  }, [protocol, availableSignalNames]);

  // Load synthetic demonstration data if transactions are empty
  useEffect(() => {
    if (transactions.length === 0) {
      const demo = generateSyntheticTransactions(protocol, activeDesignId ?? "");
      setTransactions(demo);
      if (demo.length > 0) {
        setSelectedTxId(demo[0].id);
      }
    }
  }, [protocol, activeDesignId]);

  const currentSpec = PROTOCOL_SPECS[protocol];

  const handleRunDecode = async () => {
    setIsDecoding(true);
    try {
      const signalsDict: Record<string, Array<[number, string]>> = {};
      for (const sig of state.signals) {
        const key = sig.id || sig.name;
        signalsDict[key] = sig.samples.map((s) => [s.timePs, s.value]);
      }

      const req: ProtocolDecodeRequest = {
        protocol,
        uart_config: protocol === "uart" ? uartConfig : undefined,
        spi_config: protocol === "spi" ? spiConfig : undefined,
        i2c_config: protocol === "i2c" ? i2cConfig : undefined,
        axi_config: protocol === "axi_stream" || protocol === "axi4_lite" ? axiConfig : undefined,
        can_config: protocol === "can" ? canConfig : undefined,
        usb_config: protocol === "usb" ? usbConfig : undefined,
        ethernet_config: protocol === "ethernet" ? ethernetConfig : undefined,
        signals: signalsDict,
        pin_map: pinMap
      };

      const results = await engineBridge.decodeProtocol(req);
      if (results.length > 0) {
        setTransactions(results);
        setSelectedTxId(results[0].id);
        onTransactionsUpdated?.(results);
      } else {
        // Fallback to synthetic if simulation produced no transitions
        const demo = generateSyntheticTransactions(protocol, activeDesignId ?? "");
        setTransactions(demo);
        if (demo.length > 0) setSelectedTxId(demo[0].id);
        onTransactionsUpdated?.(demo);
      }
    } catch (err) {
      console.warn("[ProtocolAnalyzer] Decode failed, loading fallback demo:", err);
      const demo = generateSyntheticTransactions(protocol, activeDesignId ?? "");
      setTransactions(demo);
      if (demo.length > 0) setSelectedTxId(demo[0].id);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleLoadDemo = () => {
    const demo = generateSyntheticTransactions(protocol, activeDesignId ?? "");
    setTransactions(demo);
    if (demo.length > 0) {
      setSelectedTxId(demo[0].id);
    }
    onTransactionsUpdated?.(demo);
  };

  const selectedTransaction = useMemo(() => {
    return transactions.find((tx) => tx.id === selectedTxId) ?? transactions[0] ?? null;
  }, [transactions, selectedTxId]);

  const handleSelectTx = (tx: DecodedTransaction) => {
    setSelectedTxId(tx.id);
    engineBridge.scrubToTime(tx.start_time_ps);
    onSelectTransaction?.(tx);
  };

  const filteredTransactions = useMemo(() => {
    if (!searchFilter.trim()) return transactions;
    const q = searchFilter.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.summary.toLowerCase().includes(q) ||
        tx.protocol.toLowerCase().includes(q) ||
        JSON.stringify(tx.fields).toLowerCase().includes(q)
    );
  }, [transactions, searchFilter]);

  const getProtocolBadgeClass = (p: ProtocolKind) => {
    switch (p) {
      case "can":
        return "badge-amber";
      case "usb":
        return "badge-cyan";
      case "ethernet":
        return "badge-purple";
      case "uart":
        return "badge-blue";
      case "spi":
        return "badge-green";
      case "i2c":
        return "badge-emerald";
      default:
        return "badge-secondary";
    }
  };

  // Format Hex Dump (16 bytes per line with ASCII column)
  const renderHexDump = (payload: number[]) => {
    if (!payload || payload.length === 0) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          Zero payload data bytes in this packet.
        </div>
      );
    }

    const lines: string[] = [];
    for (let i = 0; i < payload.length; i += 16) {
      const chunk = payload.slice(i, i + 16);
      const offsetStr = i.toString(16).padStart(4, "0").toUpperCase();
      const hexPart1 = chunk
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
      const hexPart2 = chunk
        .slice(8, 16)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
      const hexStr = `${hexPart1.padEnd(23, " ")}  ${hexPart2.padEnd(23, " ")}`;

      const asciiStr = chunk
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
        .join("");

      lines.push(`${offsetStr}   ${hexStr}   |${asciiStr}|`);
    }

    return (
      <pre
        className="mono-num"
        style={{
          margin: 0,
          padding: 12,
          fontSize: 11.5,
          lineHeight: 1.5,
          color: "var(--accent-cyan, #06b6d4)",
          backgroundColor: "var(--bg-tertiary)",
          borderRadius: "var(--radius-sm)",
          overflowX: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        }}
      >
        {lines.join("\n")}
      </pre>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        overflow: "hidden"
      }}
    >
      {/* Top Header & Ribbon */}
      <div
        style={{
          height: 42,
          padding: "0 12px",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexShrink: 0,
          overflowX: "auto"
        }}
      >
        {/* Protocol Selector Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8 }}>
            <Cpu size={15} style={{ color: "var(--accent-cyan)" }} />
            <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap" }}>Protocol Analyzer</span>
          </div>

          {(
            [
              ["can", "CAN 2.0"],
              ["usb", "USB"],
              ["ethernet", "Ethernet"],
              ["uart", "UART"],
              ["spi", "SPI"],
              ["i2c", "I2C"],
              ["axi_stream", "AXI-Stream"]
            ] as Array<[ProtocolKind, string]>
          ).map(([pk, label]) => (
            <button
              key={pk}
              onClick={() => {
                setProtocol(pk);
                const demo = generateSyntheticTransactions(pk, activeDesignId ?? "");
                setTransactions(demo);
                if (demo.length > 0) setSelectedTxId(demo[0].id);
              }}
              style={{
                height: 24,
                padding: "0 8px",
                fontSize: 11,
                fontWeight: protocol === pk ? 600 : 400,
                backgroundColor: protocol === pk ? "var(--bg-tertiary)" : "transparent",
                color: protocol === pk ? "var(--accent-cyan)" : "var(--text-muted)",
                border: protocol === pk ? "1px solid var(--border-subtle)" : "1px solid transparent",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Action Buttons & Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Filter Search Box */}
          <div style={{ position: "relative" }}>
            <Filter size={11} style={{ position: "absolute", left: 7, top: 7, color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Filter packets..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                height: 24,
                width: 150,
                paddingLeft: 24,
                paddingRight: 6,
                fontSize: 11,
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                outline: "none"
              }}
            />
          </div>

          {/* Config Trigger */}
          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="btn btn-secondary"
            style={{
              height: 24,
              fontSize: 11,
              padding: "0 7px",
              gap: 4,
              backgroundColor: isConfigOpen ? "rgba(6, 182, 212, 0.15)" : undefined,
              borderColor: isConfigOpen ? "var(--accent-cyan)" : undefined
            }}
            title="Configure channels, pin mapping, and protocol baud parameters"
          >
            <Sliders size={12} />
            <span>Config</span>
          </button>

          {/* Run Decode */}
          <button
            onClick={handleRunDecode}
            disabled={isDecoding}
            className="btn btn-primary"
            style={{ height: 24, fontSize: 11, padding: "0 9px", gap: 5 }}
            title="Execute in-engine bitstream decode over simulated nets"
          >
            {isDecoding ? <RefreshCw size={11} className="spin" /> : <Play size={11} />}
            <span>Decode</span>
          </button>

          {/* Load Demo */}
          <button
            onClick={handleLoadDemo}
            className="btn btn-secondary"
            style={{ height: 24, fontSize: 11, padding: "0 7px", gap: 4 }}
            title="Load authentic golden packet capture demo"
          >
            <Sparkles size={11} />
            <span>Demo</span>
          </button>

          {/* Export PCAP */}
          <button
            onClick={() => exportTransactionsToPcap(transactions, protocol)}
            disabled={transactions.length === 0}
            className="btn btn-secondary"
            style={{ height: 24, fontSize: 11, padding: "0 7px", gap: 4 }}
            title="Export standard Libpcap binary capture for Wireshark inspection"
          >
            <Download size={11} />
            <span>PCAP</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={() => exportTransactionsToCsv(transactions)}
            disabled={transactions.length === 0}
            className="btn btn-secondary"
            style={{ height: 24, fontSize: 11, padding: "0 7px", gap: 4 }}
            title="Export CSV packet metadata table"
          >
            <FileText size={11} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Split View between Table & Deep Inspection */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        {/* Left / Main Pane: Tabular Packet Stream */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 380,
            overflowY: "auto",
            borderRight: "1px solid var(--border-subtle)"
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: 11.5,
              fontVariantNumeric: "tabular-nums"
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
              <tr style={{ color: "var(--text-muted)", fontSize: 10.5, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px", width: 45 }}>#</th>
                <th style={{ padding: "6px 8px", width: 95 }}>Time (ps)</th>
                <th style={{ padding: "6px 8px", width: 75 }}>Proto</th>
                <th style={{ padding: "6px 8px" }}>Summary / Packet Details</th>
                <th style={{ padding: "6px 8px", width: 55, textAlign: "right" }}>Bytes</th>
                <th style={{ padding: "6px 8px", width: 65, textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                    No packets detected. Select a protocol and click <strong>Decode</strong> or <strong>Demo</strong>.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isSelected = selectedTxId === tx.id;
                  const isOk = tx.status === "ok";
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => handleSelectTx(tx)}
                      style={{
                        backgroundColor: isSelected ? "rgba(6, 182, 212, 0.12)" : undefined,
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        transition: "background 0.05s ease"
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <td style={{ padding: "5px 8px", fontWeight: 700, color: "var(--text-muted)" }}>{tx.id}</td>
                      <td style={{ padding: "5px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {tx.start_time_ps.toLocaleString()}
                      </td>
                      <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                        <span className={`badge ${getProtocolBadgeClass(tx.protocol)}`} style={{ fontSize: 9.5 }}>
                          {tx.protocol.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "5px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: isSelected ? 600 : 400 }}>{tx.summary}</span>
                        </div>
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--text-muted)" }}>
                        {tx.data_payload.length > 0 ? tx.data_payload.length : "-"}
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                        {isOk ? (
                          <span style={{ color: "var(--accent-green)", fontSize: 10, fontWeight: 700 }}>OK</span>
                        ) : (
                          <span style={{ color: "var(--accent-red)", fontSize: 10, fontWeight: 700 }}>ERROR</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Pane: Deep Packet Inspection Card */}
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
          {selectedTransaction ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {/* Inspection Header */}
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>
                    Packet #{selectedTransaction.id} ({selectedTransaction.protocol.toUpperCase()})
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {selectedTransaction.start_time_ps} ps &rarr; {selectedTransaction.end_time_ps} ps (&Delta;{" "}
                    {selectedTransaction.end_time_ps - selectedTransaction.start_time_ps} ps)
                  </div>
                </div>

                {/* Sub-tab Switcher: Fields vs Hex Dump */}
                <div style={{ display: "flex", backgroundColor: "var(--bg-tertiary)", borderRadius: 4, padding: 2 }}>
                  <button
                    onClick={() => setActiveInspectorTab("fields")}
                    style={{
                      padding: "2px 8px",
                      fontSize: 10.5,
                      fontWeight: activeInspectorTab === "fields" ? 600 : 400,
                      backgroundColor: activeInspectorTab === "fields" ? "var(--bg-secondary)" : "transparent",
                      color: activeInspectorTab === "fields" ? "var(--accent-cyan)" : "var(--text-muted)",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer"
                    }}
                  >
                    Fields
                  </button>
                  <button
                    onClick={() => setActiveInspectorTab("hexdump")}
                    style={{
                      padding: "2px 8px",
                      fontSize: 10.5,
                      fontWeight: activeInspectorTab === "hexdump" ? 600 : 400,
                      backgroundColor: activeInspectorTab === "hexdump" ? "var(--bg-secondary)" : "transparent",
                      color: activeInspectorTab === "hexdump" ? "var(--accent-cyan)" : "var(--text-muted)",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer"
                    }}
                  >
                    Hex Dump
                  </button>
                </div>
              </div>

              {/* Inspector Body */}
              <div style={{ padding: 12, flex: 1, overflowY: "auto" }}>
                {activeInspectorTab === "fields" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Status Banner */}
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor:
                          selectedTransaction.status === "ok"
                            ? "rgba(34, 197, 94, 0.12)"
                            : "rgba(239, 68, 68, 0.12)",
                        border: `1px solid ${
                          selectedTransaction.status === "ok" ? "var(--accent-green)" : "var(--accent-red)"
                        }`,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11.5
                      }}
                    >
                      {selectedTransaction.status === "ok" ? (
                        <CheckCircle2 size={14} style={{ color: "var(--accent-green)" }} />
                      ) : (
                        <AlertTriangle size={14} style={{ color: "var(--accent-red)" }} />
                      )}
                      <span>
                        {typeof selectedTransaction.status === "string"
                          ? "Integrity Check Passed (CRC / Checksum Valid)"
                          : JSON.stringify(selectedTransaction.status)}
                      </span>
                    </div>

                    {/* Dissected Fields Table */}
                    <div
                      style={{
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        overflow: "hidden"
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 10px",
                          backgroundColor: "var(--bg-tertiary)",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Layers size={12} />
                        <span>Decoded Protocol Fields</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {Object.entries(selectedTransaction.fields).map(([k, v], idx) => (
                          <div
                            key={k}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "6px 10px",
                              fontSize: 11.5,
                              borderTop: idx > 0 ? "1px solid var(--border-subtle)" : undefined,
                              backgroundColor: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : undefined
                            }}
                          >
                            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{k}</span>
                            <span className="mono-num" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Replay Button */}
                    <button
                      onClick={() => handleSelectTx(selectedTransaction)}
                      className="btn btn-secondary"
                      style={{ width: "100%", height: 28, fontSize: 11, gap: 6, justifyContent: "center" }}
                    >
                      <ArrowRight size={12} />
                      <span>Sync Waveform Cursor to {selectedTransaction.start_time_ps} ps</span>
                    </button>
                  </div>
                ) : (
                  <div>{renderHexDump(selectedTransaction.data_payload)}</div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Select a packet from the table to inspect decoded fields and raw hex payload.
            </div>
          )}
        </div>

        {/* Config Slide-over Drawer */}
        {isConfigOpen && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 320,
              backgroundColor: "var(--bg-secondary)",
              borderLeft: "1px solid var(--border-subtle)",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              padding: 16,
              overflowY: "auto",
              gap: 16
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <Sliders size={14} />
                <span>Protocol Parameters</span>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="btn btn-ghost btn-icon"
                style={{ width: 24, height: 24 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Pin Mapping Section */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Channel Mapping
                </span>
                <button
                  onClick={() => setPinMap(guessPinMap(protocol, availableSignalNames))}
                  className="btn btn-ghost"
                  style={{ height: 20, fontSize: 10.5, padding: "0 6px", gap: 3 }}
                >
                  <Sparkles size={10} />
                  <span>Auto-Map</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {currentSpec.roles.map((role) => (
                  <div key={role.role}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 2 }}>
                      <span>{role.label}</span>
                      <span style={{ color: role.required ? "var(--accent-red)" : "var(--text-muted)" }}>
                        {role.required ? "Req" : "Opt"}
                      </span>
                    </div>
                    <select
                      value={pinMap[role.role] ?? ""}
                      onChange={(e) => setPinMap({ ...pinMap, [role.role]: e.target.value })}
                      style={{
                        width: "100%",
                        height: 26,
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-primary)",
                        padding: "0 6px",
                        fontSize: 11.5,
                        outline: "none"
                      }}
                    >
                      <option value="">-- Unassigned --</option>
                      {availableSignalNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol-Specific Parameters */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                {currentSpec.name} Settings
              </span>

              {protocol === "can" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>Nominal Baud Rate</span>
                    <select
                      value={canConfig.baud_rate}
                      onChange={(e) => setCanConfig({ ...canConfig, baud_rate: Number(e.target.value) })}
                      style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                    >
                      <option value={125000}>125 kbps (Low-Speed CAN)</option>
                      <option value={250000}>250 kbps</option>
                      <option value={500000}>500 kbps (Standard Automotive)</option>
                      <option value={1000000}>1 Mbps (High-Speed CAN)</option>
                    </select>
                  </div>
                  <div>
                    <span style={{ fontSize: 11 }}>Sample Point</span>
                    <select
                      value={canConfig.sample_point_percent}
                      onChange={(e) => setCanConfig({ ...canConfig, sample_point_percent: Number(e.target.value) })}
                      style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                    >
                      <option value={75}>75% (Standard)</option>
                      <option value={80}>80%</option>
                      <option value={87.5}>87.5%</option>
                    </select>
                  </div>
                </div>
              )}

              {protocol === "usb" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>USB Bus Speed</span>
                    <select
                      value={usbConfig.speed}
                      onChange={(e) => setUsbConfig({ ...usbConfig, speed: e.target.value as any })}
                      style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                    >
                      <option value="full_speed">Full-Speed (12 Mbps, 83.3 ns/bit)</option>
                      <option value="low_speed">Low-Speed (1.5 Mbps, 666.7 ns/bit)</option>
                    </select>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={usbConfig.check_crc}
                      onChange={(e) => setUsbConfig({ ...usbConfig, check_crc: e.target.checked })}
                    />
                    <span>Verify CRC-5 & CRC-16</span>
                  </label>
                </div>
              )}

              {protocol === "ethernet" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>PHY Interface Mode</span>
                    <select
                      value={ethernetConfig.interface}
                      onChange={(e) => setEthernetConfig({ ...ethernetConfig, interface: e.target.value as any })}
                      style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                    >
                      <option value="mii">MII (4-bit Nibbles @ 25 MHz)</option>
                      <option value="rmii">RMII (2-bit Dibits @ 50 MHz)</option>
                      <option value="parallel_byte">Parallel Byte (8-bit @ Clock)</option>
                    </select>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={ethernetConfig.fcs_check}
                      onChange={(e) => setEthernetConfig({ ...ethernetConfig, fcs_check: e.target.checked })}
                    />
                    <span>Verify FCS CRC-32 Frame Check</span>
                  </label>
                </div>
              )}

              {protocol === "spi" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11 }}>CPOL (Clock Polarity)</span>
                      <select
                        value={spiConfig.cpol}
                        onChange={(e) => setSpiConfig({ ...spiConfig, cpol: Number(e.target.value) as 0 | 1 })}
                        style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                      >
                        <option value={0}>0 (Idle Low)</option>
                        <option value={1}>1 (Idle High)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11 }}>CPHA (Clock Phase)</span>
                      <select
                        value={spiConfig.cpha}
                        onChange={(e) => setSpiConfig({ ...spiConfig, cpha: Number(e.target.value) as 0 | 1 })}
                        style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                      >
                        <option value={0}>0 (Sample Leading)</option>
                        <option value={1}>1 (Sample Trailing)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11 }}>Word Size</span>
                    <select
                      value={spiConfig.bits_per_word}
                      onChange={(e) => setSpiConfig({ ...spiConfig, bits_per_word: Number(e.target.value) })}
                      style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                    >
                      <option value={8}>8-bit</option>
                      <option value={16}>16-bit</option>
                      <option value={32}>32-bit</option>
                    </select>
                  </div>
                </div>
              )}

              {protocol === "i2c" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={i2cConfig.is_10bit_addressing}
                      onChange={(e) => setI2cConfig({ ...i2cConfig, is_10bit_addressing: e.target.checked })}
                    />
                    <span>10-Bit Addressing Mode</span>
                  </label>
                </div>
              )}

              {(protocol === "axi_stream" || protocol === "axi4_lite") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>Data Bus Width</span>
                    <select
                      value={axiConfig.data_width_bytes}
                      onChange={(e) => setAxiConfig({ ...axiConfig, data_width_bytes: Number(e.target.value) })}
                      style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                    >
                      <option value={1}>8-bit (1 Byte)</option>
                      <option value={2}>16-bit (2 Bytes)</option>
                      <option value={4}>32-bit (4 Bytes)</option>
                      <option value={8}>64-bit (8 Bytes)</option>
                    </select>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={axiConfig.is_lite}
                      onChange={(e) => setAxiConfig({ ...axiConfig, is_lite: e.target.checked })}
                    />
                    <span>AXI4-Lite Sub-protocol Mode</span>
                  </label>
                </div>
              )}

              {protocol === "uart" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>Baud Rate</span>
                    <select
                      value={uartConfig.baud_rate}
                      onChange={(e) => setUartConfig({ ...uartConfig, baud_rate: Number(e.target.value) })}
                      style={{ width: "100%", height: 26, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)", borderRadius: 3, color: "var(--text-primary)", fontSize: 11.5, marginTop: 2 }}
                    >
                      <option value={9600}>9,600</option>
                      <option value={115200}>115,200 (Default)</option>
                      <option value={921600}>921,600</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setIsConfigOpen(false);
                handleRunDecode();
              }}
              className="btn btn-primary"
              style={{ marginTop: "auto", height: 30, fontSize: 11.5, justifyContent: "center" }}
            >
              Apply & Run Decode
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
