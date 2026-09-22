// Libpcap (.pcap) Binary File Exporter for Axiom Protocol Telemetry
// Wireshark-compatible packet capture generation

import { DecodedTransaction, ProtocolKind } from "./protocolDecoders";

const LINKTYPE_ETHERNET = 1;
const LINKTYPE_USER0 = 147;
const LINKTYPE_CAN_SOCKETCAN = 227;
const LINKTYPE_USB_2_0 = 288;

/**
 * Builds a valid binary PCAP buffer from decoded transactions.
 */
export function buildPcapBuffer(transactions: DecodedTransaction[], protocol: ProtocolKind): Uint8Array {
  const linkType = (() => {
    switch (protocol) {
      case "ethernet":
        return LINKTYPE_ETHERNET;
      case "can":
        return LINKTYPE_CAN_SOCKETCAN;
      case "usb":
        return LINKTYPE_USB_2_0;
      default:
        return LINKTYPE_USER0;
    }
  })();

  // Calculate total buffer length
  let totalDataLen = 24; // 24-byte global header

  const packetBuffers: Uint8Array[] = [];

  for (const tx of transactions) {
    let packetPayload: Uint8Array;

    if (protocol === "can") {
      // SocketCAN format: 4-byte ID, 1-byte DLC, 3-byte padding, up to 8 bytes data
      const canId = Number(tx.fields["id"] || 0);
      const isExtended = tx.fields["frame_type"]?.includes("Extended");
      const isRemote = tx.fields["rtr"] === "REMOTE";
      let effId = canId & 0x1fffffff;
      if (isExtended) effId |= 0x80000000;
      if (isRemote) effId |= 0x40000000;

      const dlc = tx.data_payload.length;
      const buf = new Uint8Array(8 + dlc);
      const view = new DataView(buf.buffer);
      view.setUint32(0, effId, false); // Big endian for SocketCAN ID
      buf[4] = dlc;
      buf[5] = 0;
      buf[6] = 0;
      buf[7] = 0;
      buf.set(tx.data_payload, 8);
      packetPayload = buf;
    } else if (protocol === "ethernet" && tx.data_payload.length >= 14) {
      packetPayload = new Uint8Array(tx.data_payload);
    } else {
      packetPayload = new Uint8Array(tx.data_payload.length > 0 ? tx.data_payload : [0x00]);
    }

    packetBuffers.push(packetPayload);
    totalDataLen += 16 + packetPayload.length; // 16-byte packet header + payload
  }

  const pcapBuffer = new Uint8Array(totalDataLen);
  const view = new DataView(pcapBuffer.buffer);

  // 1. Write Global Header (24 bytes, little-endian)
  view.setUint32(0, 0xa1b2c3d4, true); // Magic number
  view.setUint16(4, 2, true);          // Version major (2)
  view.setUint16(6, 4, true);          // Version minor (4)
  view.setInt32(8, 0, true);           // Thiszone (GMT)
  view.setUint32(12, 0, true);         // Sigfigs
  view.setUint32(16, 65535, true);     // Snaplen
  view.setUint32(20, linkType, true);  // Network link type

  // 2. Write Packet Records
  let offset = 24;
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const payload = packetBuffers[i];

    // Timestamp conversion (ps to sec and usec)
    const timePs = tx.start_time_ps;
    const sec = Math.floor(timePs / 1_000_000_000_000);
    const usec = Math.floor((timePs % 1_000_000_000_000) / 1_000_000);

    view.setUint32(offset, sec, true);
    view.setUint32(offset + 4, usec, true);
    view.setUint32(offset + 8, payload.length, true);  // Incl len
    view.setUint32(offset + 12, payload.length, true); // Orig len
    offset += 16;

    pcapBuffer.set(payload, offset);
    offset += payload.length;
  }

  return pcapBuffer;
}

/**
 * Triggers a browser download of the generated PCAP capture file.
 */
export function exportTransactionsToPcap(
  transactions: DecodedTransaction[],
  protocol: ProtocolKind,
  filename?: string
): void {
  const pcapData = buildPcapBuffer(transactions, protocol);
  const blob = new Blob([pcapData.buffer as ArrayBuffer], { type: "application/vnd.tcpdump.pcap" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `axiom_${protocol}_capture_${Date.now()}.pcap`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
