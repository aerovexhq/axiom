// Axiom EDA — Elaborated BIR Hardware Schematic DAG & Logic Cone Model

export type SchematicNodeKind =
  | "port_in"
  | "port_out"
  | "register"
  | "mux"
  | "operator"
  | "gate"
  | "module";

export interface PortDef {
  id: string;
  name: string;
  width: number;
  direction: "in" | "out";
  isClock?: boolean;
  isReset?: boolean;
  // Offset relative to node top-left
  offsetX?: number;
  offsetY?: number;
}

export interface SourceSpan {
  lineStart: number;
  lineEnd: number;
  colStart?: number;
  colEnd?: number;
}

export interface SchematicNode {
  id: string;
  label: string;
  sublabel?: string;
  kind: SchematicNodeKind;
  scope: string; // e.g. "top", "u_div"
  inputs: PortDef[];
  outputs: PortDef[];
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
  delayPs: number; // Cell propagation delay in ps
  dynamicPowerMw: number; // Static/dynamic estimated dissipation
  expressionText?: string;
  craneliftOp?: string; // In-RAM Cranelift JIT machine instruction
  sourceSpan: SourceSpan;
  // Hierarchical children for macro modules
  childrenNodeIds?: string[];
  expanded?: boolean;
}

export interface WirePoint {
  x: number;
  y: number;
}

export interface SchematicEdge {
  id: string;
  netName: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  width: number;
  isBus: boolean;
  wirePoints: WirePoint[];
  delayPs: number; // Wire interconnect delay in ps
  signalId: string; // References SimulationState.signals
  fanout: number;
}

export interface SchematicGraph {
  id: string;
  topModule: string;
  nodes: SchematicNode[];
  edges: SchematicEdge[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
}

export interface LogicCone {
  targetId: string;
  isFanin: boolean;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  maxDepth: number;
  totalDelayPs: number;
  slackPs: number;
  isSlackViolated: boolean;
  criticalPathNodeIds: string[];
  fanoutCount?: number;
  lumpedCapacitanceFf?: number;
}

// --------------------------------------------------------------------------
// 1. Sugiyama Layered Layout & Manhattan Orthogonal Routing
// --------------------------------------------------------------------------

function routeOrthogonalEdge(
  srcX: number,
  srcY: number,
  dstX: number,
  dstY: number,
  channelOffset = 0
): WirePoint[] {
  const points: WirePoint[] = [];
  points.push({ x: srcX, y: srcY });

  const dx = dstX - srcX;
  const dy = dstY - srcY;

  if (Math.abs(dy) < 4) {
    // Almost straight horizontal
    points.push({ x: dstX, y: dstY });
  } else if (dx > 30) {
    // Normal forward flow with midpoint Manhattan channel
    const midX = srcX + Math.max(20, dx * 0.5) + channelOffset;
    points.push({ x: midX, y: srcY });
    points.push({ x: midX, y: dstY });
    points.push({ x: dstX, y: dstY });
  } else {
    // Feedback or close nodes: Route around
    const outX = srcX + 16 + channelOffset;
    const midY = dy > 0 ? Math.min(srcY, dstY) - 24 : Math.max(srcY, dstY) + 24;
    const inX = dstX - 16 - channelOffset;
    points.push({ x: outX, y: srcY });
    points.push({ x: outX, y: midY });
    points.push({ x: inX, y: midY });
    points.push({ x: inX, y: dstY });
    points.push({ x: dstX, y: dstY });
  }

  return points;
}

function layoutAndRouteGraph(graph: SchematicGraph): SchematicGraph {
  // Layer spacing constants
  const layerSpacingX = 180;
  const nodeSpacingY = 28;
  const startX = 40;
  const startY = 40;

  // Group nodes by layer
  const layerMap = new Map<number, SchematicNode[]>();
  for (const node of graph.nodes) {
    const list = layerMap.get(node.layer) ?? [];
    list.push(node);
    layerMap.set(node.layer, list);
  }

  const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);

  let currentX = startX;
  let maxGlobalY = 0;
  let maxGlobalX = 0;

  for (const layer of sortedLayers) {
    const nodesInLayer = layerMap.get(layer)!;
    let currentY = startY;

    // Determine max width in this layer
    let maxLayerWidth = 0;
    for (const n of nodesInLayer) {
      if (n.width > maxLayerWidth) maxLayerWidth = n.width;
    }

    for (const node of nodesInLayer) {
      node.x = currentX;
      node.y = currentY;

      // Assign port anchor offsets
      const numIn = node.inputs.length;
      node.inputs.forEach((port, idx) => {
        port.offsetX = 0;
        if (port.isClock) {
          port.offsetX = node.width * 0.2;
          port.offsetY = node.height;
        } else if (port.isReset) {
          port.offsetX = node.width * 0.5;
          port.offsetY = node.height;
        } else {
          const step = node.height / (numIn + 1);
          port.offsetY = step * (idx + 1);
        }
      });

      const numOut = node.outputs.length;
      node.outputs.forEach((port, idx) => {
        port.offsetX = node.width;
        const step = node.height / (numOut + 1);
        port.offsetY = step * (idx + 1);
      });

      currentY += node.height + nodeSpacingY;
      if (currentY > maxGlobalY) maxGlobalY = currentY;
    }

    currentX += maxLayerWidth + layerSpacingX;
    if (currentX > maxGlobalX) maxGlobalX = currentX;
  }

  // Route edges
  const nodeMap = new Map<string, SchematicNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  let channelCounter = 0;
  for (const edge of graph.edges) {
    const srcNode = nodeMap.get(edge.sourceNodeId);
    const dstNode = nodeMap.get(edge.targetNodeId);
    if (!srcNode || !dstNode) continue;

    const srcPort = srcNode.outputs.find((p) => p.id === edge.sourcePortId) ?? srcNode.outputs[0];
    const dstPort = dstNode.inputs.find((p) => p.id === edge.targetPortId) ?? dstNode.inputs[0];

    const srcPtX = srcNode.x + (srcPort?.offsetX ?? srcNode.width);
    const srcPtY = srcNode.y + (srcPort?.offsetY ?? srcNode.height / 2);

    const dstPtX = dstNode.x + (dstPort?.offsetX ?? 0);
    const dstPtY = dstNode.y + (dstPort?.offsetY ?? dstNode.height / 2);

    const channelOffset = ((channelCounter % 5) - 2) * 6;
    channelCounter++;

    edge.wirePoints = routeOrthogonalEdge(srcPtX, srcPtY, dstPtX, dstPtY, channelOffset);
  }

  graph.bounds = {
    minX: 0,
    minY: 0,
    maxX: maxGlobalX + 60,
    maxY: maxGlobalY + 60,
    width: maxGlobalX + 60,
    height: maxGlobalY + 60
  };

  return graph;
}

// --------------------------------------------------------------------------
// 2. Hardware DAG Synthesizers for Sample Designs
// --------------------------------------------------------------------------

export function generateSchematicGraph(sampleDesignId: string): SchematicGraph {
  if (sampleDesignId === "counter") {
    return generateCounterGraph();
  } else if (sampleDesignId === "hierarchy") {
    return generateHierarchyGraph();
  }
  return generateAluGraph();
}

/**
 * 8-Bit Arithmetic Logic Unit (ALU) DAG
 */
function generateAluGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    // Layer 0: Input Ports
    {
      id: "in_clk",
      label: "clk",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "clk", width: 1, direction: "out", isClock: true }],
      x: 0,
      y: 0,
      width: 70,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.05,
      sourceSpan: { lineStart: 20, lineEnd: 20 }
    },
    {
      id: "in_rst_n",
      label: "rst_n",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "rst_n", width: 1, direction: "out", isReset: true }],
      x: 0,
      y: 0,
      width: 70,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.01,
      sourceSpan: { lineStart: 21, lineEnd: 21 }
    },
    {
      id: "in_opcode",
      label: "opcode[2:0]",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "opcode", width: 3, direction: "out" }],
      x: 0,
      y: 0,
      width: 90,
      height: 32,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.04,
      sourceSpan: { lineStart: 22, lineEnd: 22 }
    },
    {
      id: "in_a",
      label: "a[7:0]",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "a", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 80,
      height: 32,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.08,
      sourceSpan: { lineStart: 23, lineEnd: 23 }
    },
    {
      id: "in_b",
      label: "b[7:0]",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "b", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 80,
      height: 32,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.08,
      sourceSpan: { lineStart: 24, lineEnd: 24 }
    },

    // Layer 1: Combinational Arithmetic & Logic Operators
    {
      id: "op_add",
      label: "ADD (+)",
      sublabel: "9-bit Adder",
      kind: "operator",
      scope: "top",
      inputs: [
        { id: "a", name: "A", width: 8, direction: "in" },
        { id: "b", name: "B", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "sum", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 100,
      height: 52,
      layer: 1,
      delayPs: 145,
      dynamicPowerMw: 0.18,
      expressionText: "a + b",
      craneliftOp: "iadd.i16",
      sourceSpan: { lineStart: 35, lineEnd: 35 }
    },
    {
      id: "op_sub",
      label: "SUB (-)",
      sublabel: "9-bit Subtractor",
      kind: "operator",
      scope: "top",
      inputs: [
        { id: "a", name: "A", width: 8, direction: "in" },
        { id: "b", name: "B", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "diff", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 100,
      height: 52,
      layer: 1,
      delayPs: 155,
      dynamicPowerMw: 0.2,
      expressionText: "a - b",
      craneliftOp: "isub.i16",
      sourceSpan: { lineStart: 36, lineEnd: 36 }
    },
    {
      id: "op_and",
      label: "AND (&)",
      kind: "operator",
      scope: "top",
      inputs: [
        { id: "a", name: "A", width: 8, direction: "in" },
        { id: "b", name: "B", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "res", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 85,
      height: 44,
      layer: 1,
      delayPs: 45,
      dynamicPowerMw: 0.05,
      expressionText: "a & b",
      craneliftOp: "band.i8",
      sourceSpan: { lineStart: 37, lineEnd: 37 }
    },
    {
      id: "op_or",
      label: "OR (|)",
      kind: "operator",
      scope: "top",
      inputs: [
        { id: "a", name: "A", width: 8, direction: "in" },
        { id: "b", name: "B", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "res", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 85,
      height: 44,
      layer: 1,
      delayPs: 45,
      dynamicPowerMw: 0.05,
      expressionText: "a | b",
      craneliftOp: "bor.i8",
      sourceSpan: { lineStart: 38, lineEnd: 38 }
    },
    {
      id: "op_xor",
      label: "XOR (^)",
      kind: "operator",
      scope: "top",
      inputs: [
        { id: "a", name: "A", width: 8, direction: "in" },
        { id: "b", name: "B", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "res", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 85,
      height: 44,
      layer: 1,
      delayPs: 55,
      dynamicPowerMw: 0.06,
      expressionText: "a ^ b",
      craneliftOp: "bxor.i8",
      sourceSpan: { lineStart: 39, lineEnd: 39 }
    },
    {
      id: "op_shl",
      label: "SHL (<<)",
      kind: "operator",
      scope: "top",
      inputs: [{ id: "a", name: "A", width: 8, direction: "in" }],
      outputs: [{ id: "out", name: "res", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 85,
      height: 40,
      layer: 1,
      delayPs: 35,
      dynamicPowerMw: 0.03,
      expressionText: "a << 1",
      craneliftOp: "ishl.i8",
      sourceSpan: { lineStart: 40, lineEnd: 40 }
    },
    {
      id: "op_shr",
      label: "SHR (>>)",
      kind: "operator",
      scope: "top",
      inputs: [{ id: "a", name: "A", width: 8, direction: "in" }],
      outputs: [{ id: "out", name: "res", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 85,
      height: 40,
      layer: 1,
      delayPs: 35,
      dynamicPowerMw: 0.03,
      expressionText: "a >> 1",
      craneliftOp: "ushr.i8",
      sourceSpan: { lineStart: 41, lineEnd: 41 }
    },
    {
      id: "op_not",
      label: "NOT (~)",
      kind: "operator",
      scope: "top",
      inputs: [{ id: "a", name: "A", width: 8, direction: "in" }],
      outputs: [{ id: "out", name: "res", width: 9, direction: "out" }],
      x: 0,
      y: 0,
      width: 85,
      height: 40,
      layer: 1,
      delayPs: 25,
      dynamicPowerMw: 0.02,
      expressionText: "~a",
      craneliftOp: "bnot.i8",
      sourceSpan: { lineStart: 42, lineEnd: 42 }
    },

    // Layer 2: 8:1 Datapath Multiplexer
    {
      id: "mux_alu",
      label: "MUX 8:1",
      sublabel: "next_calc[8:0]",
      kind: "mux",
      scope: "top",
      inputs: [
        { id: "sel", name: "sel[2:0]", width: 3, direction: "in" },
        { id: "i0", name: "0:ADD", width: 9, direction: "in" },
        { id: "i1", name: "1:SUB", width: 9, direction: "in" },
        { id: "i2", name: "2:AND", width: 9, direction: "in" },
        { id: "i3", name: "3:OR", width: 9, direction: "in" },
        { id: "i4", name: "4:XOR", width: 9, direction: "in" },
        { id: "i5", name: "5:SHL", width: 9, direction: "in" },
        { id: "i6", name: "6:SHR", width: 9, direction: "in" },
        { id: "i7", name: "7:NOT", width: 9, direction: "in" }
      ],
      outputs: [
        { id: "res", name: "next_calc[7:0]", width: 8, direction: "out" },
        { id: "carry", name: "next_calc[8]", width: 1, direction: "out" }
      ],
      x: 0,
      y: 0,
      width: 110,
      height: 180,
      layer: 2,
      delayPs: 90,
      dynamicPowerMw: 0.12,
      expressionText: "case (opcode)",
      sourceSpan: { lineStart: 34, lineEnd: 44 }
    },

    // Layer 3: Synchronous State Registers
    {
      id: "reg_result",
      label: "result[7:0]",
      sublabel: "FDRE (8-bit)",
      kind: "register",
      scope: "top",
      inputs: [
        { id: "d", name: "D", width: 8, direction: "in" },
        { id: "clk", name: "CLK", width: 1, direction: "in", isClock: true },
        { id: "rst_n", name: "RST_N", width: 1, direction: "in", isReset: true }
      ],
      outputs: [{ id: "q", name: "Q", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 110,
      height: 70,
      layer: 3,
      delayPs: 60,
      dynamicPowerMw: 0.15,
      expressionText: "result <= next_calc[7:0]",
      craneliftOp: "store.i8",
      sourceSpan: { lineStart: 48, lineEnd: 56 }
    },
    {
      id: "reg_carry",
      label: "carry_flag",
      sublabel: "FDRE (1-bit)",
      kind: "register",
      scope: "top",
      inputs: [
        { id: "d", name: "D", width: 1, direction: "in" },
        { id: "clk", name: "CLK", width: 1, direction: "in", isClock: true },
        { id: "rst_n", name: "RST_N", width: 1, direction: "in", isReset: true }
      ],
      outputs: [{ id: "q", name: "Q", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      layer: 3,
      delayPs: 50,
      dynamicPowerMw: 0.05,
      expressionText: "carry_flag <= next_calc[8]",
      sourceSpan: { lineStart: 54, lineEnd: 54 }
    },

    // Layer 4: Continuous Logic (Zero Flag Comparator)
    {
      id: "cmp_zero",
      label: "EQ (== 0)",
      sublabel: "Zero Detect",
      kind: "operator",
      scope: "top",
      inputs: [{ id: "in", name: "in[7:0]", width: 8, direction: "in" }],
      outputs: [{ id: "out", name: "eq", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 90,
      height: 44,
      layer: 4,
      delayPs: 45,
      dynamicPowerMw: 0.04,
      expressionText: "assign zero_flag = (result == 8'h00);",
      craneliftOp: "icmp eq",
      sourceSpan: { lineStart: 59, lineEnd: 59 }
    },

    // Layer 5: Output Ports
    {
      id: "out_result",
      label: "result[7:0]",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 8, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 90,
      height: 32,
      layer: 5,
      delayPs: 0,
      dynamicPowerMw: 0.08,
      sourceSpan: { lineStart: 25, lineEnd: 25 }
    },
    {
      id: "out_zero",
      label: "zero_flag",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 1, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 80,
      height: 28,
      layer: 5,
      delayPs: 0,
      dynamicPowerMw: 0.02,
      sourceSpan: { lineStart: 26, lineEnd: 26 }
    },
    {
      id: "out_carry",
      label: "carry_flag",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 1, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 80,
      height: 28,
      layer: 5,
      delayPs: 0,
      dynamicPowerMw: 0.02,
      sourceSpan: { lineStart: 27, lineEnd: 27 }
    }
  ];

  const edges: SchematicEdge[] = [
    // Inputs to operators
    { id: "e_a_add", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_add", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },
    { id: "e_b_add", netName: "b[7:0]", sourceNodeId: "in_b", sourcePortId: "out", targetNodeId: "op_add", targetPortId: "b", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "b", fanout: 5 },
    { id: "e_a_sub", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_sub", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },
    { id: "e_b_sub", netName: "b[7:0]", sourceNodeId: "in_b", sourcePortId: "out", targetNodeId: "op_sub", targetPortId: "b", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "b", fanout: 5 },
    { id: "e_a_and", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_and", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },
    { id: "e_b_and", netName: "b[7:0]", sourceNodeId: "in_b", sourcePortId: "out", targetNodeId: "op_and", targetPortId: "b", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "b", fanout: 5 },
    { id: "e_a_or", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_or", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },
    { id: "e_b_or", netName: "b[7:0]", sourceNodeId: "in_b", sourcePortId: "out", targetNodeId: "op_or", targetPortId: "b", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "b", fanout: 5 },
    { id: "e_a_xor", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_xor", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },
    { id: "e_b_xor", netName: "b[7:0]", sourceNodeId: "in_b", sourcePortId: "out", targetNodeId: "op_xor", targetPortId: "b", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "b", fanout: 5 },
    { id: "e_a_shl", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_shl", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },
    { id: "e_a_shr", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_shr", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },
    { id: "e_a_not", netName: "a[7:0]", sourceNodeId: "in_a", sourcePortId: "out", targetNodeId: "op_not", targetPortId: "a", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "a", fanout: 8 },

    // Opcode to MUX selector
    { id: "e_op_sel", netName: "opcode[2:0]", sourceNodeId: "in_opcode", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "sel", width: 3, isBus: true, wirePoints: [], delayPs: 20, signalId: "opcode", fanout: 1 },

    // Operators to MUX inputs
    { id: "e_mux_0", netName: "add_res", sourceNodeId: "op_add", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i0", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },
    { id: "e_mux_1", netName: "sub_res", sourceNodeId: "op_sub", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i1", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },
    { id: "e_mux_2", netName: "and_res", sourceNodeId: "op_and", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i2", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },
    { id: "e_mux_3", netName: "or_res", sourceNodeId: "op_or", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i3", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },
    { id: "e_mux_4", netName: "xor_res", sourceNodeId: "op_xor", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i4", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },
    { id: "e_mux_5", netName: "shl_res", sourceNodeId: "op_shl", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i5", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },
    { id: "e_mux_6", netName: "shr_res", sourceNodeId: "op_shr", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i6", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },
    { id: "e_mux_7", netName: "not_res", sourceNodeId: "op_not", sourcePortId: "out", targetNodeId: "mux_alu", targetPortId: "i7", width: 9, isBus: true, wirePoints: [], delayPs: 15, signalId: "result", fanout: 1 },

    // MUX to Registers
    { id: "e_next_calc", netName: "next_calc[7:0]", sourceNodeId: "mux_alu", sourcePortId: "res", targetNodeId: "reg_result", targetPortId: "d", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "result", fanout: 1 },
    { id: "e_next_carry", netName: "next_calc[8]", sourceNodeId: "mux_alu", sourcePortId: "carry", targetNodeId: "reg_carry", targetPortId: "d", width: 1, isBus: false, wirePoints: [], delayPs: 25, signalId: "carry_flag", fanout: 1 },

    // Clock and Reset trees
    { id: "e_clk_res", netName: "clk", sourceNodeId: "in_clk", sourcePortId: "out", targetNodeId: "reg_result", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 35, signalId: "clk", fanout: 2 },
    { id: "e_rst_res", netName: "rst_n", sourceNodeId: "in_rst_n", sourcePortId: "out", targetNodeId: "reg_result", targetPortId: "rst_n", width: 1, isBus: false, wirePoints: [], delayPs: 35, signalId: "rst_n", fanout: 2 },
    { id: "e_clk_cry", netName: "clk", sourceNodeId: "in_clk", sourcePortId: "out", targetNodeId: "reg_carry", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 35, signalId: "clk", fanout: 2 },
    { id: "e_rst_cry", netName: "rst_n", sourceNodeId: "in_rst_n", sourcePortId: "out", targetNodeId: "reg_carry", targetPortId: "rst_n", width: 1, isBus: false, wirePoints: [], delayPs: 35, signalId: "rst_n", fanout: 2 },

    // Register outputs to Zero Comparator and Output Ports
    { id: "e_res_cmp", netName: "result[7:0]", sourceNodeId: "reg_result", sourcePortId: "q", targetNodeId: "cmp_zero", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 18, signalId: "result", fanout: 2 },
    { id: "e_res_out", netName: "result[7:0]", sourceNodeId: "reg_result", sourcePortId: "q", targetNodeId: "out_result", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 18, signalId: "result", fanout: 2 },
    { id: "e_zero_out", netName: "zero_flag", sourceNodeId: "cmp_zero", sourcePortId: "out", targetNodeId: "out_zero", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "zero_flag", fanout: 1 },
    { id: "e_carry_out", netName: "carry_flag", sourceNodeId: "reg_carry", sourcePortId: "q", targetNodeId: "out_carry", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "carry_flag", fanout: 1 }
  ];

  const graph: SchematicGraph = {
    id: "graph_alu",
    topModule: "alu_8bit",
    nodes,
    edges,
    bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 600, width: 1200, height: 600 }
  };

  return layoutAndRouteGraph(graph);
}

/**
 * Synchronous Counter with Glitch Hazards DAG
 */
function generateCounterGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    // Layer 0: Inputs
    {
      id: "in_clk",
      label: "clk",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "clk", width: 1, direction: "out", isClock: true }],
      x: 0,
      y: 0,
      width: 70,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.05,
      sourceSpan: { lineStart: 73, lineEnd: 73 }
    },
    {
      id: "in_rst_n",
      label: "rst_n",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "rst_n", width: 1, direction: "out", isReset: true }],
      x: 0,
      y: 0,
      width: 70,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.01,
      sourceSpan: { lineStart: 74, lineEnd: 74 }
    },
    {
      id: "in_enable",
      label: "enable",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "enable", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 75,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.03,
      sourceSpan: { lineStart: 75, lineEnd: 75 }
    },
    {
      id: "in_updown",
      label: "up_down",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "up_down", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 80,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.03,
      sourceSpan: { lineStart: 76, lineEnd: 76 }
    },

    // Layer 1: Inc / Dec Operators
    {
      id: "op_inc",
      label: "INC (+1)",
      kind: "operator",
      scope: "top",
      inputs: [{ id: "in", name: "count[7:0]", width: 8, direction: "in" }],
      outputs: [{ id: "out", name: "inc", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 90,
      height: 44,
      layer: 1,
      delayPs: 80,
      dynamicPowerMw: 0.1,
      expressionText: "count + 1'b1",
      craneliftOp: "iadd_imm.i8 1",
      sourceSpan: { lineStart: 87, lineEnd: 87 }
    },
    {
      id: "op_dec",
      label: "DEC (-1)",
      kind: "operator",
      scope: "top",
      inputs: [{ id: "in", name: "count[7:0]", width: 8, direction: "in" }],
      outputs: [{ id: "out", name: "dec", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 90,
      height: 44,
      layer: 1,
      delayPs: 85,
      dynamicPowerMw: 0.1,
      expressionText: "count - 1'b1",
      craneliftOp: "isub_imm.i8 1",
      sourceSpan: { lineStart: 89, lineEnd: 89 }
    },

    // Layer 2: Steering Muxes
    {
      id: "mux_dir",
      label: "DIR MUX",
      sublabel: "up/down sel",
      kind: "mux",
      scope: "top",
      inputs: [
        { id: "sel", name: "up_down", width: 1, direction: "in" },
        { id: "i1", name: "+1", width: 8, direction: "in" },
        { id: "i0", name: "-1", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "next_dir", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 95,
      height: 70,
      layer: 2,
      delayPs: 55,
      dynamicPowerMw: 0.08,
      sourceSpan: { lineStart: 86, lineEnd: 89 }
    },
    {
      id: "mux_en",
      label: "EN MUX",
      sublabel: "clock-gate bypass",
      kind: "mux",
      scope: "top",
      inputs: [
        { id: "sel", name: "enable", width: 1, direction: "in" },
        { id: "i1", name: "active", width: 8, direction: "in" },
        { id: "i0", name: "hold", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "next_cnt", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 95,
      height: 70,
      layer: 3,
      delayPs: 55,
      dynamicPowerMw: 0.08,
      sourceSpan: { lineStart: 85, lineEnd: 90 }
    },

    // Layer 4: State Register
    {
      id: "reg_count",
      label: "count[7:0]",
      sublabel: "FDRE Counter State",
      kind: "register",
      scope: "top",
      inputs: [
        { id: "d", name: "D", width: 8, direction: "in" },
        { id: "clk", name: "CLK", width: 1, direction: "in", isClock: true },
        { id: "rst_n", name: "RST_N", width: 1, direction: "in", isReset: true }
      ],
      outputs: [{ id: "q", name: "Q", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 110,
      height: 75,
      layer: 4,
      delayPs: 60,
      dynamicPowerMw: 0.16,
      expressionText: "count <= next_cnt",
      sourceSpan: { lineStart: 82, lineEnd: 91 }
    },

    // Layer 5: Glitch Hazard Logic & Terminal Comparator
    {
      id: "cmp_terminal",
      label: "EQ (== 8'hFF)",
      sublabel: "Terminal Count",
      kind: "operator",
      scope: "top",
      inputs: [{ id: "in", name: "count[7:0]", width: 8, direction: "in" }],
      outputs: [{ id: "out", name: "tc", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 100,
      height: 45,
      layer: 5,
      delayPs: 65,
      dynamicPowerMw: 0.06,
      expressionText: "assign terminal_count = (count == 8'hFF);",
      sourceSpan: { lineStart: 94, lineEnd: 94 }
    },
    {
      id: "gate_and",
      label: "AND2 (path_a)",
      sublabel: "count[0] & count[1]",
      kind: "gate",
      scope: "top",
      inputs: [
        { id: "i0", name: "c0", width: 1, direction: "in" },
        { id: "i1", name: "c1", width: 1, direction: "in" }
      ],
      outputs: [{ id: "out", name: "path_a", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 100,
      height: 48,
      layer: 5,
      delayPs: 40,
      dynamicPowerMw: 0.04,
      expressionText: "wire path_a = count[0] & count[1];",
      sourceSpan: { lineStart: 97, lineEnd: 97 }
    },
    {
      id: "gate_xor1",
      label: "XOR2 (path_b)",
      sublabel: "count[0] ^ count[1]",
      kind: "gate",
      scope: "top",
      inputs: [
        { id: "i0", name: "c0", width: 1, direction: "in" },
        { id: "i1", name: "c1", width: 1, direction: "in" }
      ],
      outputs: [{ id: "out", name: "path_b", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 100,
      height: 48,
      layer: 5,
      delayPs: 70, // Intentionally longer delay causing delta-hazard!
      dynamicPowerMw: 0.05,
      expressionText: "wire path_b = count[0] ^ count[1];",
      sourceSpan: { lineStart: 98, lineEnd: 98 }
    },
    {
      id: "gate_xor_hazard",
      label: "XOR2 (Glitch Wire)",
      sublabel: "path_a ^ path_b",
      kind: "gate",
      scope: "top",
      inputs: [
        { id: "i0", name: "path_a", width: 1, direction: "in" },
        { id: "i1", name: "path_b", width: 1, direction: "in" }
      ],
      outputs: [{ id: "out", name: "hazard", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 110,
      height: 52,
      layer: 6,
      delayPs: 60,
      dynamicPowerMw: 0.05,
      expressionText: "assign glitch_hazard_wire = path_a ^ path_b;",
      sourceSpan: { lineStart: 99, lineEnd: 99 }
    },

    // Layer 7: Output Ports
    {
      id: "out_count",
      label: "count[7:0]",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 8, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 85,
      height: 32,
      layer: 7,
      delayPs: 0,
      dynamicPowerMw: 0.08,
      sourceSpan: { lineStart: 77, lineEnd: 77 }
    },
    {
      id: "out_tc",
      label: "terminal_count",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 1, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 95,
      height: 28,
      layer: 7,
      delayPs: 0,
      dynamicPowerMw: 0.02,
      sourceSpan: { lineStart: 78, lineEnd: 78 }
    },
    {
      id: "out_glitch",
      label: "glitch_hazard_wire",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 1, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 120,
      height: 28,
      layer: 7,
      delayPs: 0,
      dynamicPowerMw: 0.02,
      sourceSpan: { lineStart: 79, lineEnd: 79 }
    }
  ];

  const edges: SchematicEdge[] = [
    // Inputs
    { id: "e_clk", netName: "clk", sourceNodeId: "in_clk", sourcePortId: "out", targetNodeId: "reg_count", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 30, signalId: "clk", fanout: 1 },
    { id: "e_rst", netName: "rst_n", sourceNodeId: "in_rst_n", sourcePortId: "out", targetNodeId: "reg_count", targetPortId: "rst_n", width: 1, isBus: false, wirePoints: [], delayPs: 30, signalId: "rst_n", fanout: 1 },
    { id: "e_en", netName: "enable", sourceNodeId: "in_enable", sourcePortId: "out", targetNodeId: "mux_en", targetPortId: "sel", width: 1, isBus: false, wirePoints: [], delayPs: 20, signalId: "enable", fanout: 1 },
    { id: "e_updown", netName: "up_down", sourceNodeId: "in_updown", sourcePortId: "out", targetNodeId: "mux_dir", targetPortId: "sel", width: 1, isBus: false, wirePoints: [], delayPs: 20, signalId: "up_down", fanout: 1 },

    // Inc / Dec to DIR Mux
    { id: "e_inc_mux", netName: "count_inc", sourceNodeId: "op_inc", sourcePortId: "out", targetNodeId: "mux_dir", targetPortId: "i1", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "count", fanout: 1 },
    { id: "e_dec_mux", netName: "count_dec", sourceNodeId: "op_dec", sourcePortId: "out", targetNodeId: "mux_dir", targetPortId: "i0", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "count", fanout: 1 },

    // DIR Mux to EN Mux
    { id: "e_dir_en", netName: "dir_val", sourceNodeId: "mux_dir", sourcePortId: "out", targetNodeId: "mux_en", targetPortId: "i1", width: 8, isBus: true, wirePoints: [], delayPs: 15, signalId: "count", fanout: 1 },

    // EN Mux to Register
    { id: "e_en_reg", netName: "next_count", sourceNodeId: "mux_en", sourcePortId: "out", targetNodeId: "reg_count", targetPortId: "d", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "count", fanout: 1 },

    // Register feedback to Inc, Dec, EN Mux hold, and outputs
    { id: "e_fb_inc", netName: "count[7:0]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "op_inc", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "count", fanout: 5 },
    { id: "e_fb_dec", netName: "count[7:0]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "op_dec", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "count", fanout: 5 },
    { id: "e_fb_hold", netName: "count[7:0]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "mux_en", targetPortId: "i0", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "count", fanout: 5 },
    { id: "e_reg_out", netName: "count[7:0]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "out_count", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "count", fanout: 5 },

    // Register to Terminal Count comparator
    { id: "e_reg_tc", netName: "count[7:0]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "cmp_terminal", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "count", fanout: 5 },
    { id: "e_tc_out", netName: "terminal_count", sourceNodeId: "cmp_terminal", sourcePortId: "out", targetNodeId: "out_tc", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "terminal_count", fanout: 1 },

    // Register to Glitch Hazard Gates
    { id: "e_c_and0", netName: "count[0]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "gate_and", targetPortId: "i0", width: 1, isBus: false, wirePoints: [], delayPs: 22, signalId: "count", fanout: 2 },
    { id: "e_c_and1", netName: "count[1]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "gate_and", targetPortId: "i1", width: 1, isBus: false, wirePoints: [], delayPs: 22, signalId: "count", fanout: 2 },
    { id: "e_c_xor0", netName: "count[0]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "gate_xor1", targetPortId: "i0", width: 1, isBus: false, wirePoints: [], delayPs: 22, signalId: "count", fanout: 2 },
    { id: "e_c_xor1", netName: "count[1]", sourceNodeId: "reg_count", sourcePortId: "q", targetNodeId: "gate_xor1", targetPortId: "i1", width: 1, isBus: false, wirePoints: [], delayPs: 22, signalId: "count", fanout: 2 },

    // Glitch logic merge
    { id: "e_path_a", netName: "path_a", sourceNodeId: "gate_and", sourcePortId: "out", targetNodeId: "gate_xor_hazard", targetPortId: "i0", width: 1, isBus: false, wirePoints: [], delayPs: 18, signalId: "glitch_hazard_wire", fanout: 1 },
    { id: "e_path_b", netName: "path_b", sourceNodeId: "gate_xor1", sourcePortId: "out", targetNodeId: "gate_xor_hazard", targetPortId: "i1", width: 1, isBus: false, wirePoints: [], delayPs: 18, signalId: "glitch_hazard_wire", fanout: 1 },
    { id: "e_hazard_out", netName: "glitch_hazard_wire", sourceNodeId: "gate_xor_hazard", sourcePortId: "out", targetNodeId: "out_glitch", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "glitch_hazard_wire", fanout: 1 }
  ];

  const graph: SchematicGraph = {
    id: "graph_counter",
    topModule: "counter_glitch_demo",
    nodes,
    edges,
    bounds: { minX: 0, minY: 0, maxX: 1250, maxY: 650, width: 1250, height: 650 }
  };

  return layoutAndRouteGraph(graph);
}

/**
 * Hierarchical SoC Subsystem DAG
 */
function generateHierarchyGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    // Layer 0: Inputs
    {
      id: "in_sys_clk",
      label: "sys_clk",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "sys_clk", width: 1, direction: "out", isClock: true }],
      x: 0,
      y: 0,
      width: 75,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.05,
      sourceSpan: { lineStart: 133, lineEnd: 133 }
    },
    {
      id: "in_sys_rst_n",
      label: "sys_rst_n",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "sys_rst_n", width: 1, direction: "out", isReset: true }],
      x: 0,
      y: 0,
      width: 80,
      height: 28,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.01,
      sourceSpan: { lineStart: 134, lineEnd: 134 }
    },
    {
      id: "in_data_in",
      label: "data_in[7:0]",
      kind: "port_in",
      scope: "top",
      inputs: [],
      outputs: [{ id: "out", name: "data_in", width: 8, direction: "out" }],
      x: 0,
      y: 0,
      width: 90,
      height: 32,
      layer: 0,
      delayPs: 0,
      dynamicPowerMw: 0.07,
      sourceSpan: { lineStart: 135, lineEnd: 135 }
    },

    // Layer 1: Submodule Macro Envelope (clk_divider u_div)
    {
      id: "mod_u_div",
      label: "u_div : clk_divider",
      sublabel: "Hierarchical Divider Block",
      kind: "module",
      scope: "u_div",
      inputs: [
        { id: "clk_in", name: "clk_in", width: 1, direction: "in", isClock: true },
        { id: "rst_n", name: "rst_n", width: 1, direction: "in", isReset: true }
      ],
      outputs: [{ id: "clk_out", name: "divided_clk", width: 1, direction: "out" }],
      x: 0,
      y: 0,
      width: 140,
      height: 90,
      layer: 1,
      delayPs: 110,
      dynamicPowerMw: 0.22,
      expressionText: "clk_divider u_div (.clk_in(sys_clk), ...)",
      sourceSpan: { lineStart: 142, lineEnd: 146 }
    },

    // Layer 2: Accumulator Adder (16-bit)
    {
      id: "op_accum_add",
      label: "ADD (+)",
      sublabel: "16-bit Accumulator Adder",
      kind: "operator",
      scope: "top",
      inputs: [
        { id: "acc", name: "accum[15:0]", width: 16, direction: "in" },
        { id: "dat", name: "data_in[7:0]", width: 8, direction: "in" }
      ],
      outputs: [{ id: "out", name: "sum[15:0]", width: 16, direction: "out" }],
      x: 0,
      y: 0,
      width: 120,
      height: 55,
      layer: 2,
      delayPs: 160,
      dynamicPowerMw: 0.25,
      expressionText: "accumulator + data_in",
      craneliftOp: "iadd.i16",
      sourceSpan: { lineStart: 153, lineEnd: 153 }
    },

    // Layer 3: Accumulator Register (FDRE 16-bit)
    {
      id: "reg_accum",
      label: "accumulator[15:0]",
      sublabel: "FDRE (16-bit clocked by divided_clk)",
      kind: "register",
      scope: "top",
      inputs: [
        { id: "d", name: "D", width: 16, direction: "in" },
        { id: "clk", name: "CLK", width: 1, direction: "in", isClock: true },
        { id: "rst_n", name: "RST_N", width: 1, direction: "in", isReset: true }
      ],
      outputs: [{ id: "q", name: "Q", width: 16, direction: "out" }],
      x: 0,
      y: 0,
      width: 130,
      height: 80,
      layer: 3,
      delayPs: 70,
      dynamicPowerMw: 0.2,
      expressionText: "accumulator <= accumulator + data_in",
      sourceSpan: { lineStart: 149, lineEnd: 154 }
    },

    // Layer 4: Outputs
    {
      id: "out_accum",
      label: "accum_out[15:0]",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 16, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 110,
      height: 32,
      layer: 4,
      delayPs: 0,
      dynamicPowerMw: 0.12,
      sourceSpan: { lineStart: 136, lineEnd: 136 }
    },
    {
      id: "out_heartbeat",
      label: "core_heartbeat",
      kind: "port_out",
      scope: "top",
      inputs: [{ id: "in", name: "in", width: 1, direction: "in" }],
      outputs: [],
      x: 0,
      y: 0,
      width: 100,
      height: 28,
      layer: 4,
      delayPs: 0,
      dynamicPowerMw: 0.04,
      sourceSpan: { lineStart: 137, lineEnd: 137 }
    }
  ];

  const edges: SchematicEdge[] = [
    // Clocks and resets into u_div
    { id: "e_sys_clk_div", netName: "sys_clk", sourceNodeId: "in_sys_clk", sourcePortId: "out", targetNodeId: "mod_u_div", targetPortId: "clk_in", width: 1, isBus: false, wirePoints: [], delayPs: 30, signalId: "sys_clk", fanout: 1 },
    { id: "e_sys_rst_div", netName: "sys_rst_n", sourceNodeId: "in_sys_rst_n", sourcePortId: "out", targetNodeId: "mod_u_div", targetPortId: "rst_n", width: 1, isBus: false, wirePoints: [], delayPs: 30, signalId: "sys_rst_n", fanout: 2 },

    // Divided clock driving accumulator and heartbeat
    { id: "e_div_clk_accum", netName: "divided_clk", sourceNodeId: "mod_u_div", sourcePortId: "clk_out", targetNodeId: "reg_accum", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 35, signalId: "divided_clk", fanout: 2 },
    { id: "e_div_clk_hb", netName: "core_heartbeat", sourceNodeId: "mod_u_div", sourcePortId: "clk_out", targetNodeId: "out_heartbeat", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 20, signalId: "core_heartbeat", fanout: 2 },

    // Reset to accumulator
    { id: "e_sys_rst_accum", netName: "sys_rst_n", sourceNodeId: "in_sys_rst_n", sourcePortId: "out", targetNodeId: "reg_accum", targetPortId: "rst_n", width: 1, isBus: false, wirePoints: [], delayPs: 30, signalId: "sys_rst_n", fanout: 2 },

    // Data in to accumulator adder
    { id: "e_data_in_add", netName: "data_in[7:0]", sourceNodeId: "in_data_in", sourcePortId: "out", targetNodeId: "op_accum_add", targetPortId: "dat", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "data_in", fanout: 1 },

    // Adder output to Accumulator register D input
    { id: "e_add_to_reg", netName: "next_accum[15:0]", sourceNodeId: "op_accum_add", sourcePortId: "out", targetNodeId: "reg_accum", targetPortId: "d", width: 16, isBus: true, wirePoints: [], delayPs: 25, signalId: "accum_out", fanout: 1 },

    // Accumulator register Q output feedback to adder and output port
    { id: "e_accum_feedback", netName: "accumulator[15:0]", sourceNodeId: "reg_accum", sourcePortId: "q", targetNodeId: "op_accum_add", targetPortId: "acc", width: 16, isBus: true, wirePoints: [], delayPs: 25, signalId: "accum_out", fanout: 2 },
    { id: "e_accum_out", netName: "accum_out[15:0]", sourceNodeId: "reg_accum", sourcePortId: "q", targetNodeId: "out_accum", targetPortId: "in", width: 16, isBus: true, wirePoints: [], delayPs: 20, signalId: "accum_out", fanout: 2 }
  ];

  const graph: SchematicGraph = {
    id: "graph_hierarchy",
    topModule: "soc_subsystem_top",
    nodes,
    edges,
    bounds: { minX: 0, minY: 0, maxX: 1100, maxY: 550, width: 1100, height: 550 }
  };

  return layoutAndRouteGraph(graph);
}

// --------------------------------------------------------------------------
// 3. 1-Click Critical Logic Cone Slicer Algorithm
// --------------------------------------------------------------------------

/**
 * Extracts fan-in combinational logic cone feeding the given node or net,
 * tracing backwards to primary inputs and upstream flip-flops.
 */
export function sliceFaninCone(
  graph: SchematicGraph,
  targetId: string,
  clockPeriodPs = 1000
): LogicCone {
  const nodeMap = new Map<string, SchematicNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  // Determine starting node
  let startNodeId = targetId;
  const edgeMatch = graph.edges.find((e) => e.id === targetId || e.netName === targetId || e.signalId === targetId);
  if (edgeMatch) {
    startNodeId = edgeMatch.targetNodeId;
  }

  const coneNodeIds = new Set<string>();
  const coneEdgeIds = new Set<string>();
  const incomingEdgesMap = new Map<string, SchematicEdge[]>();

  for (const edge of graph.edges) {
    const list = incomingEdgesMap.get(edge.targetNodeId) ?? [];
    list.push(edge);
    incomingEdgesMap.set(edge.targetNodeId, list);
  }

  const queue: Array<{ nodeId: string; currentDepth: number; pathDelayPs: number; path: string[] }> = [
    { nodeId: startNodeId, currentDepth: 0, pathDelayPs: 0, path: [startNodeId] }
  ];

  coneNodeIds.add(startNodeId);

  let maxDepth = 0;
  let maxPathDelayPs = 0;
  let criticalPath: string[] = [startNodeId];

  while (queue.length > 0) {
    const { nodeId, currentDepth, pathDelayPs, path } = queue.shift()!;
    const currentNode = nodeMap.get(nodeId);
    if (!currentNode) continue;

    if (currentDepth > maxDepth) maxDepth = currentDepth;
    if (pathDelayPs > maxPathDelayPs) {
      maxPathDelayPs = pathDelayPs;
      criticalPath = path;
    }

    // If we've reached a primary input or a register (state boundary), stop tracing further back
    if (currentNode.kind === "port_in") continue;
    if (currentNode.kind === "register" && nodeId !== startNodeId) continue;

    const inEdges = incomingEdgesMap.get(nodeId) ?? [];
    for (const edge of inEdges) {
      coneEdgeIds.add(edge.id);
      const srcNode = nodeMap.get(edge.sourceNodeId);
      if (srcNode) {
        coneNodeIds.add(srcNode.id);
        const nextDelay = pathDelayPs + (srcNode.delayPs ?? 0) + (edge.delayPs ?? 0);
        queue.push({
          nodeId: srcNode.id,
          currentDepth: currentDepth + 1,
          pathDelayPs: nextDelay,
          path: [...path, srcNode.id]
        });
      }
    }
  }

  // Slack Calculation: T_slack = T_period - T_data - T_setup (50 ps setup uncertainty)
  const setupTimePs = 50;
  const slackPs = clockPeriodPs - maxPathDelayPs - setupTimePs;
  const isSlackViolated = slackPs < 0;

  return {
    targetId,
    isFanin: true,
    nodeIds: coneNodeIds,
    edgeIds: coneEdgeIds,
    maxDepth,
    totalDelayPs: maxPathDelayPs,
    slackPs,
    isSlackViolated,
    criticalPathNodeIds: criticalPath.reverse()
  };
}

/**
 * Extracts fan-out logic tree driven by the given net or node,
 * tracing forward to all downstream loads.
 */
export function sliceFanoutCone(
  graph: SchematicGraph,
  targetId: string
): LogicCone {
  const nodeMap = new Map<string, SchematicNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  let startNodeId = targetId;
  const edgeMatch = graph.edges.find((e) => e.id === targetId || e.netName === targetId || e.signalId === targetId);
  if (edgeMatch) {
    startNodeId = edgeMatch.sourceNodeId;
  }

  const coneNodeIds = new Set<string>();
  const coneEdgeIds = new Set<string>();
  const outgoingEdgesMap = new Map<string, SchematicEdge[]>();

  for (const edge of graph.edges) {
    const list = outgoingEdgesMap.get(edge.sourceNodeId) ?? [];
    list.push(edge);
    outgoingEdgesMap.set(edge.sourceNodeId, list);
  }

  const queue: string[] = [startNodeId];
  coneNodeIds.add(startNodeId);

  let fanoutCount = 0;
  let lumpedCapacitanceFf = 0;

  while (queue.length > 0) {
    const curId = queue.shift()!;
    const outEdges = outgoingEdgesMap.get(curId) ?? [];

    for (const edge of outEdges) {
      coneEdgeIds.add(edge.id);
      fanoutCount++;
      lumpedCapacitanceFf += (edge.width * 0.8) + 1.2; // 0.8 fF/bit + 1.2 fF pin

      if (!coneNodeIds.has(edge.targetNodeId)) {
        coneNodeIds.add(edge.targetNodeId);
        queue.push(edge.targetNodeId);
      }
    }
  }

  return {
    targetId,
    isFanin: false,
    nodeIds: coneNodeIds,
    edgeIds: coneEdgeIds,
    maxDepth: 1,
    totalDelayPs: 0,
    slackPs: 0,
    isSlackViolated: false,
    criticalPathNodeIds: [startNodeId],
    fanoutCount,
    lumpedCapacitanceFf
  };
}
