import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Cpu,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  RefreshCw,
  Download,
  FileText
} from "lucide-react";
import { SimulationState, engineBridge } from "../engine/engineBridge";
import { useTranslation } from "../i18n";
import { DropdownSelect } from "./ui";
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

interface ProtocolDecoderModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SimulationState;
  onSelectTransaction?: (tx: DecodedTransaction) => void;
  onTransactionsUpdated?: (transactions: DecodedTransaction[]) => void;
}

export const ProtocolDecoderModal: React.FC<ProtocolDecoderModalProps> = ({
  isOpen,
  onClose,
  state,
  onSelectTransaction,
  onTransactionsUpdated
}) => {
  const { t } = useTranslation();
  const [protocol, setProtocol] = useState<ProtocolKind>("can");
  const [pinMap, setPinMap] = useState<Record<string, string>>({});
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

  const [isDecoding, setIsDecoding] = useState(false);
  const [transactions, setTransactions] = useState<DecodedTransaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  const availableSignalNames = useMemo(() => {
    return state.signals.map((s) => s.id || s.name);
  }, [state.signals]);

  // Guess pin mapping whenever protocol changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const guessed = guessPinMap(protocol, availableSignalNames);
      setPinMap(guessed);
    }
  }, [protocol, isOpen, availableSignalNames]);

  if (!isOpen) return null;

  const currentSpec = PROTOCOL_SPECS[protocol];

  const handleRunDecode = async () => {
    setIsDecoding(true);
    try {
      // Build signal series dictionary from current state.signals
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
        onTransactionsUpdated?.(results);
      } else {
        const demo = generateSyntheticTransactions(protocol, "");
        setTransactions(demo);
        onTransactionsUpdated?.(demo);
      }
    } catch (err) {
      console.error("[ProtocolDecoderModal] Error decoding protocol:", err);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleJumpToTransaction = (tx: DecodedTransaction) => {
    setSelectedTxId(tx.id);
    engineBridge.scrubToTime(tx.start_time_ps);
    onSelectTransaction?.(tx);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      tx.summary.toLowerCase().includes(q) ||
      tx.protocol.toLowerCase().includes(q) ||
      JSON.stringify(tx.fields).toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 900,
          maxWidth: "96vw",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-secondary)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(6, 182, 212, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-cyan)"
              }}
            >
              <Cpu size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
                {t("protocol.title")}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {t("protocol.subtitle")}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ width: 28, height: 28 }}
            title={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "310px 1fr",
            flex: 1,
            overflow: "hidden"
          }}
        >
          {/* Left Column: Protocol Config & Pin Mapping */}
          <div
            style={{
              padding: 16,
              borderRight: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-secondary)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 16
            }}
          >
            {/* Protocol Selector */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                {t("protocol.selectProtocol")}
              </label>
              <DropdownSelect<ProtocolKind>
                value={protocol}
                onChange={(val) => setProtocol(val)}
                options={[
                  { value: "can", label: "CAN Bus 2.0A/2.0B" },
                  { value: "usb", label: "USB 1.1/2.0 (FS/LS)" },
                  { value: "ethernet", label: "Fast Ethernet (MII/RMII)" },
                  { value: "uart", label: "UART / RS-232" },
                  { value: "spi", label: "SPI (Serial Peripheral Interface)" },
                  { value: "i2c", label: "I2C (Inter-Integrated Circuit)" },
                  { value: "axi_stream", label: "AXI4-Stream" },
                  { value: "axi4_lite", label: "AXI4-Lite" }
                ]}
                size="md"
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.3 }}>
                {currentSpec.description}
              </div>
            </div>

            {/* Pin Mapping Section */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Channel / Pin Mapping
                </label>
                <button
                  onClick={() => setPinMap(guessPinMap(protocol, availableSignalNames))}
                  className="btn btn-ghost"
                  style={{ height: 22, fontSize: 11, padding: "0 6px", gap: 4 }}
                  title="Auto-detect signals from current design"
                >
                  <Sparkles size={11} />
                  <span>Auto-Map</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {currentSpec.roles.map((role) => (
                  <div key={role.role}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{role.label}</span>
                      <span style={{ color: role.required ? "var(--accent-red)" : "var(--text-muted)" }}>
                        {role.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    <DropdownSelect<string>
                      value={pinMap[role.role] ?? ""}
                      onChange={(val) => setPinMap({ ...pinMap, [role.role]: val })}
                      options={[
                        { value: "", label: "-- Select Signal --" },
                        ...availableSignalNames.map((name) => ({ value: name, label: name }))
                      ]}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol-Specific Parameters */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                {t("protocol.configTitle")}
              </label>

              {protocol === "uart" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>Baud Rate (bps)</span>
                    <DropdownSelect<number>
                      value={uartConfig.baud_rate}
                      onChange={(val) => setUartConfig({ ...uartConfig, baud_rate: val })}
                      options={[
                        { value: 9600, label: "9,600" },
                        { value: 19200, label: "19,200" },
                        { value: 38400, label: "38,400" },
                        { value: 57600, label: "57,600" },
                        { value: 115200, label: "115,200 (Default)" },
                        { value: 921600, label: "921,600" }
                      ]}
                      size="xs"
                      buttonStyle={{ marginTop: 2 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 11 }}>Parity</span>
                    <DropdownSelect<any>
                      value={uartConfig.parity}
                      onChange={(val) => setUartConfig({ ...uartConfig, parity: val })}
                      options={[
                        { value: "none", label: "None (8N1)" },
                        { value: "even", label: "Even (8E1)" },
                        { value: "odd", label: "Odd (8O1)" }
                      ]}
                      size="xs"
                      buttonStyle={{ marginTop: 2 }}
                    />
                  </div>
                </div>
              )}

              {protocol === "spi" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 11 }}>CPOL</span>
                      <DropdownSelect<number>
                        value={spiConfig.cpol}
                        onChange={(val) => setSpiConfig({ ...spiConfig, cpol: val })}
                        options={[
                          { value: 0, label: "0 (Idle Low)" },
                          { value: 1, label: "1 (Idle High)" }
                        ]}
                        size="xs"
                        buttonStyle={{ marginTop: 2 }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 11 }}>CPHA</span>
                      <DropdownSelect<number>
                        value={spiConfig.cpha}
                        onChange={(val) => setSpiConfig({ ...spiConfig, cpha: val })}
                        options={[
                          { value: 0, label: "0 (Leading)" },
                          { value: 1, label: "1 (Trailing)" }
                        ]}
                        size="xs"
                        buttonStyle={{ marginTop: 2 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {protocol === "i2c" && (
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={i2cConfig.is_10bit_addressing}
                      onChange={(e) => setI2cConfig({ ...i2cConfig, is_10bit_addressing: e.target.checked })}
                    />
                    <span>10-bit Addressing Mode (Default: 7-bit)</span>
                  </label>
                </div>
              )}

              {protocol === "axi_stream" && (
                <div>
                  <span style={{ fontSize: 11 }}>Data Bus Width</span>
                  <DropdownSelect<number>
                    value={axiConfig.data_width_bytes}
                    onChange={(val) => setAxiConfig({ ...axiConfig, data_width_bytes: val })}
                    options={[
                      { value: 1, label: "8-bit (1 Byte)" },
                      { value: 2, label: "16-bit (2 Bytes)" },
                      { value: 4, label: "32-bit (4 Bytes)" },
                      { value: 8, label: "64-bit (8 Bytes)" }
                    ]}
                    size="xs"
                    buttonStyle={{ marginTop: 2 }}
                  />
                </div>
              )}

              {protocol === "can" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>Baud Rate</span>
                    <DropdownSelect<number>
                      value={canConfig.baud_rate}
                      onChange={(val) => setCanConfig({ ...canConfig, baud_rate: val })}
                      options={[
                        { value: 125000, label: "125 kbps" },
                        { value: 250000, label: "250 kbps" },
                        { value: 500000, label: "500 kbps (Default)" },
                        { value: 1000000, label: "1 Mbps" }
                      ]}
                      size="xs"
                      buttonStyle={{ marginTop: 2 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 11 }}>Sample Point</span>
                    <DropdownSelect<number>
                      value={canConfig.sample_point_percent}
                      onChange={(val) => setCanConfig({ ...canConfig, sample_point_percent: val })}
                      options={[
                        { value: 75, label: "75% (Standard)" },
                        { value: 80, label: "80%" },
                        { value: 87.5, label: "87.5%" }
                      ]}
                      size="xs"
                      buttonStyle={{ marginTop: 2 }}
                    />
                  </div>
                </div>
              )}

              {protocol === "usb" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11 }}>USB Bus Speed</span>
                    <DropdownSelect<any>
                      value={usbConfig.speed}
                      onChange={(val) => setUsbConfig({ ...usbConfig, speed: val })}
                      options={[
                        { value: "full_speed", label: "Full-Speed (12 Mbps)" },
                        { value: "low_speed", label: "Low-Speed (1.5 Mbps)" }
                      ]}
                      size="xs"
                      buttonStyle={{ marginTop: 2 }}
                    />
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
                    <DropdownSelect<any>
                      value={ethernetConfig.interface}
                      onChange={(val) => setEthernetConfig({ ...ethernetConfig, interface: val })}
                      options={[
                        { value: "mii", label: "MII (4-bit Nibbles @ 25 MHz)" },
                        { value: "rmii", label: "RMII (2-bit Dibits @ 50 MHz)" },
                        { value: "parallel_byte", label: "Parallel Byte (8-bit)" }
                      ]}
                      size="xs"
                      buttonStyle={{ marginTop: 2 }}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={ethernetConfig.fcs_check}
                      onChange={(e) => setEthernetConfig({ ...ethernetConfig, fcs_check: e.target.checked })}
                    />
                    <span>Verify FCS CRC-32 Check</span>
                  </label>
                </div>
              )}
            </div>

            {/* Run Decode Button */}
            <div style={{ marginTop: "auto", paddingTop: 10 }}>
              <button
                onClick={handleRunDecode}
                disabled={isDecoding || !state.compiled}
                className="btn btn-primary"
                style={{ width: "100%", height: 34, gap: 8, justifyContent: "center" }}
              >
                {isDecoding ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                <span>{isDecoding ? t("protocol.decoding") : t("protocol.decodePackets")}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Transactions Stream & Table */}
          <div
            style={{
              padding: 16,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            {/* Top Bar with count & filter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {t("protocol.packetStream")} ({filteredTransactions.length})
                </span>
                {transactions.length > 0 && (
                  <span className="badge badge-cyan" style={{ fontSize: 10.5 }}>
                    {protocol.toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ position: "relative" }}>
                  <Filter size={12} style={{ position: "absolute", left: 8, top: 7, color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder={t("common.filter")}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    style={{
                      height: 26,
                      width: 150,
                      paddingLeft: 26,
                      paddingRight: 8,
                      fontSize: 11.5,
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-primary)",
                      outline: "none"
                    }}
                  />
                </div>
                <button
                  onClick={() => exportTransactionsToPcap(transactions, protocol)}
                  disabled={transactions.length === 0}
                  className="btn btn-secondary"
                  style={{ height: 26, fontSize: 11, padding: "0 8px", gap: 4 }}
                  title="Export standard Libpcap (.pcap) capture for Wireshark"
                >
                  <Download size={11} />
                  <span>{t("protocol.exportPcap")}</span>
                </button>
                <button
                  onClick={() => exportTransactionsToCsv(transactions)}
                  disabled={transactions.length === 0}
                  className="btn btn-secondary"
                  style={{ height: 26, fontSize: 11, padding: "0 8px", gap: 4 }}
                  title="Export CSV packet table"
                >
                  <FileText size={11} />
                  <span>{t("protocol.exportCsv")}</span>
                </button>
              </div>
            </div>

            {/* Transactions List */}
            {filteredTransactions.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  padding: 40,
                  textAlign: "center"
                }}
              >
                <Cpu size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  {t("protocol.noTransactions")}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  overflowY: "auto"
                }}
              >
                {filteredTransactions.map((tx) => {
                  const isSelected = selectedTxId === tx.id;
                  const isOk = tx.status === "ok";
                  const hexPayload = tx.data_payload
                    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
                    .join(" ");

                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleJumpToTransaction(tx)}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: isSelected ? "rgba(6, 182, 212, 0.12)" : "var(--bg-secondary)",
                        border: `1px solid ${isSelected ? "var(--accent-cyan)" : "var(--border-subtle)"}`,
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        transition: "all 0.1s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: isOk ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: isOk ? "var(--accent-green)" : "var(--accent-red)",
                            flexShrink: 0
                          }}
                        >
                          {isOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" }}>
                              #{tx.id} {tx.summary}
                            </span>
                            {hexPayload && (
                              <span
                                className="mono-num"
                                style={{
                                  fontSize: 10.5,
                                  backgroundColor: "var(--bg-tertiary)",
                                  padding: "1px 5px",
                                  borderRadius: 3,
                                  color: "var(--accent-cyan)"
                                }}
                              >
                                [{hexPayload}]
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12, marginTop: 2 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <Clock size={11} /> {tx.start_time_ps} ps &rarr; {tx.end_time_ps} ps (&Delta;{" "}
                              {tx.end_time_ps - tx.start_time_ps} ps)
                            </span>
                            {Object.entries(tx.fields).map(([k, v]) => (
                              <span key={k}>
                                <strong>{k}:</strong> {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJumpToTransaction(tx);
                        }}
                        className="btn btn-ghost"
                        style={{ height: 24, fontSize: 11, padding: "0 8px", gap: 4, flexShrink: 0 }}
                        title="Jump simulation and waveform to packet timestamp"
                      >
                        <span>Replay State</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-secondary)",
            fontSize: 11.5,
            color: "var(--text-muted)"
          }}
        >
          <span>
            Current Sim Time: <strong style={{ color: "var(--accent-cyan)" }}>{state.currentSimTimePs} ps</strong> (δ=
            {state.currentDeltaCycle})
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ height: 28 }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
