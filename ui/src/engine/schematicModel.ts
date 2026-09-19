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
  gridRow?: number; // Vivado-grade datapath alignment row (e.g. 0, 1, 2, ...)
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

export interface KeepOutBox {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function assignPortOffsets(node: SchematicNode): void {
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
}

function routeOrthogonalEdge(
  srcX: number,
  srcY: number,
  dstX: number,
  dstY: number,
  channelOffset = 0,
  obstacles: KeepOutBox[] = []
): WirePoint[] {
  const points: WirePoint[] = [];
  points.push({ x: srcX, y: srcY });

  const dx = dstX - srcX;
  const dy = dstY - srcY;

  // Collision detection helpers
  const getHCollision = (x1: number, x2: number, y: number): KeepOutBox | undefined => {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    return obstacles.find((b) => minX < b.right && maxX > b.left && y >= b.top && y <= b.bottom);
  };

  const getVCollision = (x: number, y1: number, y2: number): KeepOutBox | undefined => {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return obstacles.find((b) => minY < b.bottom && maxY > b.top && x >= b.left && x <= b.right);
  };

  if (Math.abs(dy) < 4 && !getHCollision(srcX, dstX, srcY)) {
    // Almost straight horizontal with zero collisions
    points.push({ x: dstX, y: dstY });
  } else if (dx > 20) {
    // Normal forward flow with midpoint Manhattan channel
    let midX = srcX + Math.max(16, dx * 0.5) + channelOffset;

    // Check if vertical trunk at midX collides with any intermediate obstacle
    const vObs = getVCollision(midX, srcY, dstY);
    if (vObs) {
      // Shift trunk into open inter-layer channel before or after the obstacle
      const beforeX = vObs.left - 10 + channelOffset;
      const afterX = vObs.right + 10 + channelOffset;
      if (beforeX > srcX + 8 && !getVCollision(beforeX, srcY, dstY)) {
        midX = beforeX;
      } else if (afterX < dstX - 8 && !getVCollision(afterX, srcY, dstY)) {
        midX = afterX;
      }
    }

    const hObs1 = getHCollision(srcX, midX, srcY);
    const hObs2 = getHCollision(midX, dstX, dstY);

    if (!hObs1 && !hObs2) {
      // Clean 2-corner Manhattan path
      points.push({ x: midX, y: srcY });
      points.push({ x: midX, y: dstY });
      points.push({ x: dstX, y: dstY });
    } else if (hObs1) {
      // Avoid obstacle directly in front of src: step vertically early
      const detourX = Math.max(srcX + 10, hObs1.left - 10);
      const detourY = srcY <= (hObs1.top + hObs1.bottom) / 2 ? hObs1.top - 12 : hObs1.bottom + 12;
      points.push({ x: detourX, y: srcY });
      points.push({ x: detourX, y: detourY });
      points.push({ x: midX, y: detourY });
      points.push({ x: midX, y: dstY });
      points.push({ x: dstX, y: dstY });
    } else if (hObs2) {
      // Avoid obstacle before dst: route around and step down late
      const detourX = Math.min(dstX - 10, hObs2.right + 10);
      const detourY = dstY <= (hObs2.top + hObs2.bottom) / 2 ? hObs2.top - 12 : hObs2.bottom + 12;
      points.push({ x: midX, y: srcY });
      points.push({ x: midX, y: detourY });
      points.push({ x: detourX, y: detourY });
      points.push({ x: detourX, y: dstY });
      points.push({ x: dstX, y: dstY });
    }
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
  // Layer spacing constants (calibrated for ergonomic, collision-free gate-level layouts)
  const layerSpacingX = 72;
  const nodeSpacingY = 28;
  const rowHeight = 62;
  const startX = 36;
  const startY = 36;

  // Group nodes by layer
  const layerMap = new Map<number, SchematicNode[]>();
  for (const node of graph.nodes) {
    const list = layerMap.get(node.layer) ?? [];
    list.push(node);
    layerMap.set(node.layer, list);
  }

  const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);

  // Determine the max layer height across all layers to vertically center each layer (when not using gridRow)
  let maxLayerHeight = 0;
  for (const layer of sortedLayers) {
    const nodesInLayer = layerMap.get(layer)!;
    let h = 0;
    for (let i = 0; i < nodesInLayer.length; i++) {
      h += nodesInLayer[i].height + (i > 0 ? nodeSpacingY : 0);
    }
    if (h > maxLayerHeight) maxLayerHeight = h;
  }

  let currentX = startX;

  for (const layer of sortedLayers) {
    const nodesInLayer = layerMap.get(layer)!;

    // Determine max width in this layer
    let maxLayerWidth = 0;
    for (const n of nodesInLayer) {
      if (n.width > maxLayerWidth) maxLayerWidth = n.width;
    }

    const layerUsesGridRow = nodesInLayer.some((n) => n.gridRow !== undefined);

    if (layerUsesGridRow) {
      // Vivado-grade datapath grid row alignment
      for (const node of nodesInLayer) {
        node.x = currentX;
        const row = node.gridRow ?? 0;
        node.y = startY + row * rowHeight;
        assignPortOffsets(node);
      }
    } else {
      // Standard vertical centering
      let layerHeight = 0;
      for (let i = 0; i < nodesInLayer.length; i++) {
        layerHeight += nodesInLayer[i].height + (i > 0 ? nodeSpacingY : 0);
      }
      let currentY = startY + Math.max(0, (maxLayerHeight - layerHeight) / 2);

      for (const node of nodesInLayer) {
        node.x = currentX;
        node.y = currentY;
        assignPortOffsets(node);
        currentY += node.height + nodeSpacingY;
      }
    }

    currentX += maxLayerWidth + layerSpacingX;
  }

  // Pre-calculate keep-out boxes for obstacle-aware edge routing
  // Instance label is rendered at y - 6 with font size 10px, so top margin protects labels
  const keepOutBoxes: KeepOutBox[] = graph.nodes.map((n) => ({
    id: n.id,
    left: n.x - 4,
    right: n.x + n.width + 4,
    top: n.y - 18,
    bottom: n.y + n.height + 4
  }));

  // Route edges with obstacle clearance
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

    const channelOffset = ((channelCounter % 5) - 2) * 4;
    channelCounter++;

    const obstacles = keepOutBoxes.filter(
      (b) => b.id !== edge.sourceNodeId && b.id !== edge.targetNodeId
    );

    edge.wirePoints = routeOrthogonalEdge(
      srcPtX,
      srcPtY,
      dstPtX,
      dstPtY,
      channelOffset,
      obstacles
    );
  }

  // Calculate tight, exact geometric bounding box across all nodes and routed wires
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of graph.nodes) {
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.x + node.width > maxX) maxX = node.x + node.width;
    if (node.y + node.height > maxY) maxY = node.y + node.height;
  }

  for (const edge of graph.edges) {
    for (const pt of edge.wirePoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 400;
  }

  graph.bounds = {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 10),
    height: Math.max(maxY - minY, 10)
  };

  return graph;
}

// --------------------------------------------------------------------------
// 2. Hardware DAG Synthesizers for Sample Designs
// --------------------------------------------------------------------------

export function generateSchematicGraph(sampleDesignId: string): SchematicGraph {
  if (sampleDesignId === "logic_circuit" || sampleDesignId.includes("logic_circuit")) {
    return generateLogicCircuitGraph();
  } else if (sampleDesignId === "counter" || sampleDesignId.includes("counter")) {
    return generateCounterGraph();
  } else if (sampleDesignId === "hierarchy") {
    return generateHierarchyGraph();
  } else if (sampleDesignId === "uart" || sampleDesignId.includes("uart")) {
    return generateUartGraph();
  } else if (sampleDesignId === "spi" || sampleDesignId.includes("spi")) {
    return generateSpiGraph();
  } else if (sampleDesignId === "pwm" || sampleDesignId.includes("pwm")) {
    return generatePwmGraph();
  } else if (sampleDesignId === "riscv" || sampleDesignId.includes("riscv")) {
    return generateRiscvGraph();
  } else if (sampleDesignId === "alu" || sampleDesignId.includes("alu")) {
    return generateAluGraph();
  }
  return generateLogicCircuitGraph();
}

/**
 * Combinational Logic Circuit (A, B, C → F) DAG
 * Equation: F = ((~A & B) & C) | ~B
 */
function generateLogicCircuitGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    // Layer 0: Input Ports
    {
      id: "in_A",
      label: "A",
      kind: "port_in",
      scope: "logic_circuit",
      inputs: [],
      outputs: [{ id: "out", name: "A", width: 1, direction: "out" }],
      x: 0, y: 0, width: 80, height: 28, layer: 0, gridRow: 0, delayPs: 0, dynamicPowerMw: 0.02,
      sourceSpan: { lineStart: 12, lineEnd: 12 }
    },
    {
      id: "in_B",
      label: "B",
      kind: "port_in",
      scope: "logic_circuit",
      inputs: [],
      outputs: [{ id: "out", name: "B", width: 1, direction: "out" }],
      x: 0, y: 0, width: 80, height: 28, layer: 0, gridRow: 1, delayPs: 0, dynamicPowerMw: 0.02,
      sourceSpan: { lineStart: 13, lineEnd: 13 }
    },
    {
      id: "in_C",
      label: "C",
      kind: "port_in",
      scope: "logic_circuit",
      inputs: [],
      outputs: [{ id: "out", name: "C", width: 1, direction: "out" }],
      x: 0, y: 0, width: 80, height: 28, layer: 0, gridRow: 2, delayPs: 0, dynamicPowerMw: 0.02,
      sourceSpan: { lineStart: 14, lineEnd: 14 }
    },

    // Layer 1: Inverters (NOT gates)
    {
      id: "gate_inv1",
      label: "INV",
      sublabel: "w1 = ~A",
      kind: "gate",
      scope: "logic_circuit",
      inputs: [{ id: "in", name: "A", width: 1, direction: "in" }],
      outputs: [{ id: "out", name: "w1", width: 1, direction: "out" }],
      craneliftOp: "bnot",
      expressionText: "~A",
      x: 0, y: 0, width: 68, height: 38, layer: 1, gridRow: 0, delayPs: 45, dynamicPowerMw: 0.12,
      sourceSpan: { lineStart: 25, lineEnd: 25 }
    },
    {
      id: "gate_inv2",
      label: "INV",
      sublabel: "w4 = ~B",
      kind: "gate",
      scope: "logic_circuit",
      inputs: [{ id: "in", name: "B", width: 1, direction: "in" }],
      outputs: [{ id: "out", name: "w4", width: 1, direction: "out" }],
      craneliftOp: "bnot",
      expressionText: "~B",
      x: 0, y: 0, width: 68, height: 38, layer: 1, gridRow: 2.8, delayPs: 45, dynamicPowerMw: 0.12,
      sourceSpan: { lineStart: 28, lineEnd: 28 }
    },

    // Layer 2: First AND gate (w1 & B)
    {
      id: "gate_and1",
      label: "AND2",
      sublabel: "w2 = w1 & B",
      kind: "gate",
      scope: "logic_circuit",
      inputs: [
        { id: "in1", name: "w1", width: 1, direction: "in" },
        { id: "in2", name: "B", width: 1, direction: "in" }
      ],
      outputs: [{ id: "out", name: "w2", width: 1, direction: "out" }],
      craneliftOp: "band",
      expressionText: "w1 & B",
      x: 0, y: 0, width: 78, height: 48, layer: 2, gridRow: 0.55, delayPs: 60, dynamicPowerMw: 0.18,
      sourceSpan: { lineStart: 26, lineEnd: 26 }
    },

    // Layer 3: Second AND gate (w2 & C)
    {
      id: "gate_and2",
      label: "AND2",
      sublabel: "w3 = w2 & C",
      kind: "gate",
      scope: "logic_circuit",
      inputs: [
        { id: "in1", name: "w2", width: 1, direction: "in" },
        { id: "in2", name: "C", width: 1, direction: "in" }
      ],
      outputs: [{ id: "out", name: "w3", width: 1, direction: "out" }],
      craneliftOp: "band",
      expressionText: "w2 & C",
      x: 0, y: 0, width: 78, height: 48, layer: 3, gridRow: 0.75, delayPs: 60, dynamicPowerMw: 0.18,
      sourceSpan: { lineStart: 27, lineEnd: 27 }
    },

    // Layer 4: OR gate (w3 | w4)
    {
      id: "gate_or1",
      label: "OR2",
      sublabel: "F = w3 | w4",
      kind: "gate",
      scope: "logic_circuit",
      inputs: [
        { id: "in1", name: "w3", width: 1, direction: "in" },
        { id: "in2", name: "w4", width: 1, direction: "in" }
      ],
      outputs: [{ id: "out", name: "F", width: 1, direction: "out" }],
      craneliftOp: "bor",
      expressionText: "w3 | w4",
      x: 0, y: 0, width: 78, height: 48, layer: 4, gridRow: 0.95, delayPs: 65, dynamicPowerMw: 0.20,
      sourceSpan: { lineStart: 29, lineEnd: 29 }
    },

    // Layer 5: Output Port
    {
      id: "out_F",
      label: "F",
      kind: "port_out",
      scope: "logic_circuit",
      inputs: [{ id: "in", name: "F", width: 1, direction: "in" }],
      outputs: [],
      x: 0, y: 0, width: 76, height: 28, layer: 5, gridRow: 1.15, delayPs: 10, dynamicPowerMw: 0.05,
      sourceSpan: { lineStart: 15, lineEnd: 15 }
    }
  ];

  const edges: SchematicEdge[] = [
    { id: "e_A_inv1", netName: "A", sourceNodeId: "in_A", sourcePortId: "out", targetNodeId: "gate_inv1", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 12, signalId: "logic_circuit.A", fanout: 1 },
    { id: "e_inv1_and1", netName: "w1", sourceNodeId: "gate_inv1", sourcePortId: "out", targetNodeId: "gate_and1", targetPortId: "in1", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "logic_circuit.w1", fanout: 1 },
    { id: "e_B_and1", netName: "B", sourceNodeId: "in_B", sourcePortId: "out", targetNodeId: "gate_and1", targetPortId: "in2", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "logic_circuit.B", fanout: 2 },
    { id: "e_B_inv2", netName: "B", sourceNodeId: "in_B", sourcePortId: "out", targetNodeId: "gate_inv2", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "logic_circuit.B", fanout: 2 },
    { id: "e_and1_and2", netName: "w2", sourceNodeId: "gate_and1", sourcePortId: "out", targetNodeId: "gate_and2", targetPortId: "in1", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "logic_circuit.w2", fanout: 1 },
    { id: "e_C_and2", netName: "C", sourceNodeId: "in_C", sourcePortId: "out", targetNodeId: "gate_and2", targetPortId: "in2", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "logic_circuit.C", fanout: 1 },
    { id: "e_and2_or1", netName: "w3", sourceNodeId: "gate_and2", sourcePortId: "out", targetNodeId: "gate_or1", targetPortId: "in1", width: 1, isBus: false, wirePoints: [], delayPs: 18, signalId: "logic_circuit.w3", fanout: 1 },
    { id: "e_inv2_or1", netName: "w4", sourceNodeId: "gate_inv2", sourcePortId: "out", targetNodeId: "gate_or1", targetPortId: "in2", width: 1, isBus: false, wirePoints: [], delayPs: 22, signalId: "logic_circuit.w4", fanout: 1 },
    { id: "e_or1_out", netName: "F", sourceNodeId: "gate_or1", sourcePortId: "out", targetNodeId: "out_F", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "logic_circuit.F", fanout: 1 }
  ];

  const graph: SchematicGraph = {
    id: "logic_circuit_graph",
    topModule: "logic_circuit",
    nodes,
    edges,
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  };
  return layoutAndRouteGraph(graph);
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

// --------------------------------------------------------------------------
// 3. Additional Dynamic Graph Synthesizers
// --------------------------------------------------------------------------

function generateUartGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    { id: "in_clk", label: "clk", kind: "port_in", scope: "uart_transceiver", inputs: [], outputs: [{ id: "out", name: "clk", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 6, lineEnd: 6 } },
    { id: "in_rst_n", label: "rst_n", kind: "port_in", scope: "uart_transceiver", inputs: [], outputs: [{ id: "out", name: "rst_n", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.01, sourceSpan: { lineStart: 7, lineEnd: 7 } },
    { id: "in_tx_start", label: "tx_start", kind: "port_in", scope: "uart_transceiver", inputs: [], outputs: [{ id: "out", name: "tx_start", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 8, lineEnd: 8 } },
    { id: "in_tx_data", label: "tx_data[7:0]", kind: "port_in", scope: "uart_transceiver", inputs: [], outputs: [{ id: "out", name: "tx_data[7:0]", width: 8, direction: "out" }], x: 0, y: 0, width: 110, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.08, sourceSpan: { lineStart: 9, lineEnd: 9 } },
    { id: "in_rx_serial", label: "rx_serial", kind: "port_in", scope: "uart_transceiver", inputs: [], outputs: [{ id: "out", name: "rx_serial", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.04, sourceSpan: { lineStart: 10, lineEnd: 10 } },

    { id: "baud_div", label: "Baud Prescaler", sublabel: "div_by_4", kind: "operator", scope: "uart_transceiver", inputs: [{ id: "clk", name: "clk", width: 1, direction: "in" }], outputs: [{ id: "baud_tick", name: "baud_tick", width: 1, direction: "out" }], x: 0, y: 0, width: 130, height: 44, layer: 1, delayPs: 80, dynamicPowerMw: 0.22, sourceSpan: { lineStart: 18, lineEnd: 32 } },
    { id: "tx_fsm", label: "TX Controller", sublabel: "FSM (IDLE/START/DATA/STOP)", kind: "module", scope: "uart_transceiver", inputs: [{ id: "baud_tick", name: "baud_tick", width: 1, direction: "in" }, { id: "tx_start", name: "tx_start", width: 1, direction: "in" }], outputs: [{ id: "tx_busy", name: "tx_busy", width: 1, direction: "out" }, { id: "tx_done", name: "tx_done", width: 1, direction: "out" }, { id: "shift_en", name: "shift_en", width: 1, direction: "out" }], x: 0, y: 0, width: 150, height: 64, layer: 1, delayPs: 120, dynamicPowerMw: 0.35, sourceSpan: { lineStart: 42, lineEnd: 90 } },
    { id: "rx_fsm", label: "RX Sampler & FSM", sublabel: "8-N-1 Detector", kind: "module", scope: "uart_transceiver", inputs: [{ id: "baud_tick", name: "baud_tick", width: 1, direction: "in" }, { id: "rx_serial", name: "rx_serial", width: 1, direction: "in" }], outputs: [{ id: "rx_ready", name: "rx_ready", width: 1, direction: "out" }, { id: "rx_error", name: "rx_error", width: 1, direction: "out" }, { id: "sample_en", name: "sample_en", width: 1, direction: "out" }], x: 0, y: 0, width: 150, height: 64, layer: 1, delayPs: 140, dynamicPowerMw: 0.38, sourceSpan: { lineStart: 102, lineEnd: 155 } },

    { id: "tx_shift", label: "TX PISO Shifter", sublabel: "8-bit Shift Register", kind: "register", scope: "uart_transceiver", inputs: [{ id: "tx_data", name: "tx_data[7:0]", width: 8, direction: "in" }, { id: "shift_en", name: "shift_en", width: 1, direction: "in" }], outputs: [{ id: "tx_serial", name: "tx_serial", width: 1, direction: "out" }], x: 0, y: 0, width: 140, height: 50, layer: 2, delayPs: 90, dynamicPowerMw: 0.28, sourceSpan: { lineStart: 60, lineEnd: 75 } },
    { id: "rx_shift", label: "RX SIPO Buffer", sublabel: "8-bit Deserializer", kind: "register", scope: "uart_transceiver", inputs: [{ id: "rx_serial", name: "rx_serial", width: 1, direction: "in" }, { id: "sample_en", name: "sample_en", width: 1, direction: "in" }], outputs: [{ id: "rx_data", name: "rx_data[7:0]", width: 8, direction: "out" }], x: 0, y: 0, width: 140, height: 50, layer: 2, delayPs: 95, dynamicPowerMw: 0.30, sourceSpan: { lineStart: 125, lineEnd: 140 } },

    { id: "out_tx_serial", label: "tx_serial", kind: "port_out", scope: "uart_transceiver", inputs: [{ id: "in", name: "tx_serial", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 11, lineEnd: 11 } },
    { id: "out_tx_busy", label: "tx_busy", kind: "port_out", scope: "uart_transceiver", inputs: [{ id: "in", name: "tx_busy", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 12, lineEnd: 12 } },
    { id: "out_tx_done", label: "tx_done", kind: "port_out", scope: "uart_transceiver", inputs: [{ id: "in", name: "tx_done", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 13, lineEnd: 13 } },
    { id: "out_rx_data", label: "rx_data[7:0]", kind: "port_out", scope: "uart_transceiver", inputs: [{ id: "in", name: "rx_data[7:0]", width: 8, direction: "in" }], outputs: [], x: 0, y: 0, width: 110, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.06, sourceSpan: { lineStart: 14, lineEnd: 14 } },
    { id: "out_rx_ready", label: "rx_ready", kind: "port_out", scope: "uart_transceiver", inputs: [{ id: "in", name: "rx_ready", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 15, lineEnd: 15 } }
  ];

  const edges: SchematicEdge[] = [
    { id: "e_clk_baud", netName: "clk", sourceNodeId: "in_clk", sourcePortId: "out", targetNodeId: "baud_div", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "uart_transceiver.clk", fanout: 3 },
    { id: "e_baud_tx", netName: "baud_tick", sourceNodeId: "baud_div", sourcePortId: "baud_tick", targetNodeId: "tx_fsm", targetPortId: "baud_tick", width: 1, isBus: false, wirePoints: [], delayPs: 20, signalId: "uart_transceiver.baud_tick", fanout: 2 },
    { id: "e_baud_rx", netName: "baud_tick", sourceNodeId: "baud_div", sourcePortId: "baud_tick", targetNodeId: "rx_fsm", targetPortId: "baud_tick", width: 1, isBus: false, wirePoints: [], delayPs: 20, signalId: "uart_transceiver.baud_tick", fanout: 2 },
    { id: "e_tx_start", netName: "tx_start", sourceNodeId: "in_tx_start", sourcePortId: "out", targetNodeId: "tx_fsm", targetPortId: "tx_start", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "uart_transceiver.tx_start", fanout: 1 },
    { id: "e_tx_data_shift", netName: "tx_data", sourceNodeId: "in_tx_data", sourcePortId: "out", targetNodeId: "tx_shift", targetPortId: "tx_data", width: 8, isBus: true, wirePoints: [], delayPs: 25, signalId: "uart_transceiver.tx_data", fanout: 1 },
    { id: "e_shift_en", netName: "shift_en", sourceNodeId: "tx_fsm", sourcePortId: "shift_en", targetNodeId: "tx_shift", targetPortId: "shift_en", width: 1, isBus: false, wirePoints: [], delayPs: 20, signalId: "uart_transceiver.shift_en", fanout: 1 },
    { id: "e_tx_busy", netName: "tx_busy", sourceNodeId: "tx_fsm", sourcePortId: "tx_busy", targetNodeId: "out_tx_busy", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "uart_transceiver.tx_busy", fanout: 1 },
    { id: "e_tx_done", netName: "tx_done", sourceNodeId: "tx_fsm", sourcePortId: "tx_done", targetNodeId: "out_tx_done", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "uart_transceiver.tx_done", fanout: 1 },
    { id: "e_tx_serial", netName: "tx_serial", sourceNodeId: "tx_shift", sourcePortId: "tx_serial", targetNodeId: "out_tx_serial", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 12, signalId: "uart_transceiver.tx_serial", fanout: 1 },
    { id: "e_rx_serial", netName: "rx_serial", sourceNodeId: "in_rx_serial", sourcePortId: "out", targetNodeId: "rx_fsm", targetPortId: "rx_serial", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "uart_transceiver.rx_serial", fanout: 2 },
    { id: "e_sample_en", netName: "sample_en", sourceNodeId: "rx_fsm", sourcePortId: "sample_en", targetNodeId: "rx_shift", targetPortId: "sample_en", width: 1, isBus: false, wirePoints: [], delayPs: 20, signalId: "uart_transceiver.sample_en", fanout: 1 },
    { id: "e_rx_data", netName: "rx_data", sourceNodeId: "rx_shift", sourcePortId: "rx_data", targetNodeId: "out_rx_data", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 15, signalId: "uart_transceiver.rx_data", fanout: 1 },
    { id: "e_rx_ready", netName: "rx_ready", sourceNodeId: "rx_fsm", sourcePortId: "rx_ready", targetNodeId: "out_rx_ready", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "uart_transceiver.rx_ready", fanout: 1 }
  ];

  const graph: SchematicGraph = { id: "uart_graph", topModule: "uart_transceiver", nodes, edges, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } };
  return layoutAndRouteGraph(graph);
}

function generateSpiGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    { id: "in_clk", label: "clk", kind: "port_in", scope: "spi_master", inputs: [], outputs: [{ id: "out", name: "clk", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 5, lineEnd: 5 } },
    { id: "in_start", label: "start", kind: "port_in", scope: "spi_master", inputs: [], outputs: [{ id: "out", name: "start", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 7, lineEnd: 7 } },
    { id: "in_tx_byte", label: "tx_byte[7:0]", kind: "port_in", scope: "spi_master", inputs: [], outputs: [{ id: "out", name: "tx_byte[7:0]", width: 8, direction: "out" }], x: 0, y: 0, width: 110, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.08, sourceSpan: { lineStart: 10, lineEnd: 10 } },
    { id: "in_miso", label: "miso", kind: "port_in", scope: "spi_master", inputs: [], outputs: [{ id: "out", name: "miso", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.04, sourceSpan: { lineStart: 18, lineEnd: 18 } },

    { id: "spi_ctrl", label: "SPI Controller", sublabel: "State FSM & SCK Generator", kind: "module", scope: "spi_master", inputs: [{ id: "clk", name: "clk", width: 1, direction: "in" }, { id: "start", name: "start", width: 1, direction: "in" }], outputs: [{ id: "cs_n", name: "cs_n", width: 1, direction: "out" }, { id: "sck", name: "sck", width: 1, direction: "out" }, { id: "shift_en", name: "shift_en", width: 1, direction: "out" }, { id: "busy", name: "busy", width: 1, direction: "out" }, { id: "done", name: "done", width: 1, direction: "out" }], x: 0, y: 0, width: 160, height: 70, layer: 1, delayPs: 110, dynamicPowerMw: 0.42, sourceSpan: { lineStart: 30, lineEnd: 75 } },
    { id: "mosi_shift", label: "MOSI PISO Shifter", sublabel: "MSB First (D7..D0)", kind: "register", scope: "spi_master", inputs: [{ id: "tx_byte", name: "tx_byte[7:0]", width: 8, direction: "in" }, { id: "shift_en", name: "shift_en", width: 1, direction: "in" }], outputs: [{ id: "mosi", name: "mosi", width: 1, direction: "out" }], x: 0, y: 0, width: 140, height: 50, layer: 2, delayPs: 85, dynamicPowerMw: 0.25, sourceSpan: { lineStart: 50, lineEnd: 65 } },
    { id: "miso_sample", label: "MISO SIPO Sampler", sublabel: "Shift In on SCK", kind: "register", scope: "spi_master", inputs: [{ id: "miso", name: "miso", width: 1, direction: "in" }, { id: "sck", name: "sck", width: 1, direction: "in" }], outputs: [{ id: "rx_byte", name: "rx_byte[7:0]", width: 8, direction: "out" }], x: 0, y: 0, width: 140, height: 50, layer: 2, delayPs: 90, dynamicPowerMw: 0.26, sourceSpan: { lineStart: 55, lineEnd: 68 } },

    { id: "out_sck", label: "sck", kind: "port_out", scope: "spi_master", inputs: [{ id: "in", name: "sck", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.08, sourceSpan: { lineStart: 15, lineEnd: 15 } },
    { id: "out_cs_n", label: "cs_n", kind: "port_out", scope: "spi_master", inputs: [{ id: "in", name: "cs_n", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.03, sourceSpan: { lineStart: 16, lineEnd: 16 } },
    { id: "out_mosi", label: "mosi", kind: "port_out", scope: "spi_master", inputs: [{ id: "in", name: "mosi", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 17, lineEnd: 17 } },
    { id: "out_rx_byte", label: "rx_byte[7:0]", kind: "port_out", scope: "spi_master", inputs: [{ id: "in", name: "rx_byte[7:0]", width: 8, direction: "in" }], outputs: [], x: 0, y: 0, width: 110, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.06, sourceSpan: { lineStart: 11, lineEnd: 11 } },
    { id: "out_busy", label: "busy", kind: "port_out", scope: "spi_master", inputs: [{ id: "in", name: "busy", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 12, lineEnd: 12 } },
    { id: "out_done", label: "done", kind: "port_out", scope: "spi_master", inputs: [{ id: "in", name: "done", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 90, height: 28, layer: 3, delayPs: 10, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 13, lineEnd: 13 } }
  ];

  const edges: SchematicEdge[] = [
    { id: "e_clk", netName: "clk", sourceNodeId: "in_clk", sourcePortId: "out", targetNodeId: "spi_ctrl", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "spi_master.clk", fanout: 2 },
    { id: "e_start", netName: "start", sourceNodeId: "in_start", sourcePortId: "out", targetNodeId: "spi_ctrl", targetPortId: "start", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "spi_master.start", fanout: 1 },
    { id: "e_sck", netName: "sck", sourceNodeId: "spi_ctrl", sourcePortId: "sck", targetNodeId: "out_sck", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "spi_master.sck", fanout: 2 },
    { id: "e_cs_n", netName: "cs_n", sourceNodeId: "spi_ctrl", sourcePortId: "cs_n", targetNodeId: "out_cs_n", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "spi_master.cs_n", fanout: 1 },
    { id: "e_busy", netName: "busy", sourceNodeId: "spi_ctrl", sourcePortId: "busy", targetNodeId: "out_busy", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "spi_master.busy", fanout: 1 },
    { id: "e_done", netName: "done", sourceNodeId: "spi_ctrl", sourcePortId: "done", targetNodeId: "out_done", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "spi_master.done", fanout: 1 },
    { id: "e_tx_byte", netName: "tx_byte", sourceNodeId: "in_tx_byte", sourcePortId: "out", targetNodeId: "mosi_shift", targetPortId: "tx_byte", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "spi_master.tx_byte", fanout: 1 },
    { id: "e_shift_en", netName: "shift_en", sourceNodeId: "spi_ctrl", sourcePortId: "shift_en", targetNodeId: "mosi_shift", targetPortId: "shift_en", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "spi_master.shift_en", fanout: 1 },
    { id: "e_mosi", netName: "mosi", sourceNodeId: "mosi_shift", sourcePortId: "mosi", targetNodeId: "out_mosi", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 12, signalId: "spi_master.mosi", fanout: 1 },
    { id: "e_miso", netName: "miso", sourceNodeId: "in_miso", sourcePortId: "out", targetNodeId: "miso_sample", targetPortId: "miso", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "spi_master.miso", fanout: 1 },
    { id: "e_rx_byte", netName: "rx_byte", sourceNodeId: "miso_sample", sourcePortId: "rx_byte", targetNodeId: "out_rx_byte", targetPortId: "in", width: 8, isBus: true, wirePoints: [], delayPs: 15, signalId: "spi_master.rx_byte", fanout: 1 }
  ];

  const graph: SchematicGraph = { id: "spi_graph", topModule: "spi_master", nodes, edges, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } };
  return layoutAndRouteGraph(graph);
}

function generatePwmGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    { id: "in_clk", label: "clk", kind: "port_in", scope: "pwm_generator", inputs: [], outputs: [{ id: "out", name: "clk", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 5, lineEnd: 5 } },
    { id: "in_enable", label: "enable", kind: "port_in", scope: "pwm_generator", inputs: [], outputs: [{ id: "out", name: "enable", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.01, sourceSpan: { lineStart: 7, lineEnd: 7 } },
    { id: "in_duty", label: "duty_cycle[7:0]", kind: "port_in", scope: "pwm_generator", inputs: [], outputs: [{ id: "out", name: "duty_cycle[7:0]", width: 8, direction: "out" }], x: 0, y: 0, width: 120, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.08, sourceSpan: { lineStart: 8, lineEnd: 8 } },
    { id: "in_dead_time", label: "dead_time[3:0]", kind: "port_in", scope: "pwm_generator", inputs: [], outputs: [{ id: "out", name: "dead_time[3:0]", width: 4, direction: "out" }], x: 0, y: 0, width: 120, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.04, sourceSpan: { lineStart: 9, lineEnd: 9 } },

    { id: "period_cnt", label: "Period Counter", sublabel: "8-bit Free-Running (0..255)", kind: "register", scope: "pwm_generator", inputs: [{ id: "clk", name: "clk", width: 1, direction: "in" }, { id: "enable", name: "enable", width: 1, direction: "in" }], outputs: [{ id: "count", name: "count[7:0]", width: 8, direction: "out" }, { id: "sync", name: "sync", width: 1, direction: "out" }], x: 0, y: 0, width: 150, height: 54, layer: 1, delayPs: 90, dynamicPowerMw: 0.35, sourceSpan: { lineStart: 20, lineEnd: 32 } },
    { id: "duty_cmp", label: "Duty Comparator", sublabel: "count < duty_cycle", kind: "operator", scope: "pwm_generator", inputs: [{ id: "count", name: "count[7:0]", width: 8, direction: "in" }, { id: "duty", name: "duty[7:0]", width: 8, direction: "in" }], outputs: [{ id: "raw_pwm", name: "raw_pwm", width: 1, direction: "out" }], x: 0, y: 0, width: 140, height: 50, layer: 2, delayPs: 70, dynamicPowerMw: 0.22, sourceSpan: { lineStart: 28, lineEnd: 30 } },

    { id: "dt_gen", label: "Dead-Time Safe Stage", sublabel: "Half-Bridge Shoot-Through Prev.", kind: "module", scope: "pwm_generator", inputs: [{ id: "raw_pwm", name: "raw_pwm", width: 1, direction: "in" }, { id: "dead_time", name: "dead_time[3:0]", width: 4, direction: "in" }], outputs: [{ id: "pwm_high", name: "pwm_high", width: 1, direction: "out" }, { id: "pwm_low", name: "pwm_low", width: 1, direction: "out" }], x: 0, y: 0, width: 160, height: 60, layer: 3, delayPs: 110, dynamicPowerMw: 0.45, sourceSpan: { lineStart: 38, lineEnd: 65 } },

    { id: "out_pwm_high", label: "pwm_high (Gate H)", kind: "port_out", scope: "pwm_generator", inputs: [{ id: "in", name: "pwm_high", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 130, height: 28, layer: 4, delayPs: 10, dynamicPowerMw: 0.12, sourceSpan: { lineStart: 10, lineEnd: 10 } },
    { id: "out_pwm_low", label: "pwm_low (Gate L)", kind: "port_out", scope: "pwm_generator", inputs: [{ id: "in", name: "pwm_low", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 130, height: 28, layer: 4, delayPs: 10, dynamicPowerMw: 0.12, sourceSpan: { lineStart: 11, lineEnd: 11 } },
    { id: "out_cycle_sync", label: "cycle_sync", kind: "port_out", scope: "pwm_generator", inputs: [{ id: "in", name: "cycle_sync", width: 1, direction: "in" }], outputs: [], x: 0, y: 0, width: 100, height: 28, layer: 4, delayPs: 10, dynamicPowerMw: 0.02, sourceSpan: { lineStart: 13, lineEnd: 13 } }
  ];

  const edges: SchematicEdge[] = [
    { id: "e_clk_cnt", netName: "clk", sourceNodeId: "in_clk", sourcePortId: "out", targetNodeId: "period_cnt", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "pwm_generator.clk", fanout: 2 },
    { id: "e_en_cnt", netName: "enable", sourceNodeId: "in_enable", sourcePortId: "out", targetNodeId: "period_cnt", targetPortId: "enable", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "pwm_generator.enable", fanout: 1 },
    { id: "e_count_cmp", netName: "count", sourceNodeId: "period_cnt", sourcePortId: "count", targetNodeId: "duty_cmp", targetPortId: "count", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "pwm_generator.period_count", fanout: 1 },
    { id: "e_duty_cmp", netName: "duty_cycle", sourceNodeId: "in_duty", sourcePortId: "out", targetNodeId: "duty_cmp", targetPortId: "duty", width: 8, isBus: true, wirePoints: [], delayPs: 20, signalId: "pwm_generator.duty_cycle", fanout: 1 },
    { id: "e_raw_pwm", netName: "raw_pwm", sourceNodeId: "duty_cmp", sourcePortId: "raw_pwm", targetNodeId: "dt_gen", targetPortId: "raw_pwm", width: 1, isBus: false, wirePoints: [], delayPs: 25, signalId: "pwm_generator.raw_pwm", fanout: 1 },
    { id: "e_dt", netName: "dead_time", sourceNodeId: "in_dead_time", sourcePortId: "out", targetNodeId: "dt_gen", targetPortId: "dead_time", width: 4, isBus: true, wirePoints: [], delayPs: 20, signalId: "pwm_generator.dead_time", fanout: 1 },
    { id: "e_pwm_h", netName: "pwm_high", sourceNodeId: "dt_gen", sourcePortId: "pwm_high", targetNodeId: "out_pwm_high", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "pwm_generator.pwm_high", fanout: 1 },
    { id: "e_pwm_l", netName: "pwm_low", sourceNodeId: "dt_gen", sourcePortId: "pwm_low", targetNodeId: "out_pwm_low", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "pwm_generator.pwm_low", fanout: 1 },
    { id: "e_sync", netName: "cycle_sync", sourceNodeId: "period_cnt", sourcePortId: "sync", targetNodeId: "out_cycle_sync", targetPortId: "in", width: 1, isBus: false, wirePoints: [], delayPs: 10, signalId: "pwm_generator.cycle_sync", fanout: 1 }
  ];

  const graph: SchematicGraph = { id: "pwm_graph", topModule: "pwm_generator", nodes, edges, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } };
  return layoutAndRouteGraph(graph);
}

function generateRiscvGraph(): SchematicGraph {
  const nodes: SchematicNode[] = [
    { id: "in_clk", label: "clk", kind: "port_in", scope: "riscv_mini_core", inputs: [], outputs: [{ id: "out", name: "clk", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 5, lineEnd: 5 } },
    { id: "in_step_en", label: "step_en", kind: "port_in", scope: "riscv_mini_core", inputs: [], outputs: [{ id: "out", name: "step_en", width: 1, direction: "out" }], x: 0, y: 0, width: 90, height: 28, layer: 0, delayPs: 0, dynamicPowerMw: 0.01, sourceSpan: { lineStart: 7, lineEnd: 7 } },

    { id: "pc_reg", label: "Program Counter (PC)", sublabel: "32-bit Instruction Pointer", kind: "register", scope: "riscv_mini_core", inputs: [{ id: "clk", name: "clk", width: 1, direction: "in" }, { id: "step_en", name: "step_en", width: 1, direction: "in" }], outputs: [{ id: "pc", name: "pc[31:0]", width: 32, direction: "out" }], x: 0, y: 0, width: 160, height: 50, layer: 1, delayPs: 80, dynamicPowerMw: 0.45, sourceSpan: { lineStart: 55, lineEnd: 75 } },
    { id: "instr_rom", label: "Instruction ROM", sublabel: "Embedded Code Memory", kind: "module", scope: "riscv_mini_core", inputs: [{ id: "pc", name: "pc[31:0]", width: 32, direction: "in" }], outputs: [{ id: "instr", name: "instr[31:0]", width: 32, direction: "out" }], x: 0, y: 0, width: 150, height: 50, layer: 2, delayPs: 120, dynamicPowerMw: 0.60, sourceSpan: { lineStart: 16, lineEnd: 28 } },
    { id: "imm_dec", label: "Immediate & Decoder", sublabel: "I-Type / R-Type Decoder", kind: "operator", scope: "riscv_mini_core", inputs: [{ id: "instr", name: "instr[31:0]", width: 32, direction: "in" }], outputs: [{ id: "imm", name: "imm[31:0]", width: 32, direction: "out" }, { id: "rs1", name: "rs1[2:0]", width: 3, direction: "out" }, { id: "rs2", name: "rs2[2:0]", width: 3, direction: "out" }, { id: "funct3", name: "funct3[2:0]", width: 3, direction: "out" }], x: 0, y: 0, width: 160, height: 64, layer: 3, delayPs: 75, dynamicPowerMw: 0.30, sourceSpan: { lineStart: 31, lineEnd: 38 } },

    { id: "regfile", label: "Register File (x0..x7)", sublabel: "8 x 32-bit Dual-Read Single-Write", kind: "register", scope: "riscv_mini_core", inputs: [{ id: "rs1", name: "rs1", width: 3, direction: "in" }, { id: "rs2", name: "rs2", width: 3, direction: "in" }, { id: "write_data", name: "wdata", width: 32, direction: "in" }], outputs: [{ id: "src_a", name: "src_a[31:0]", width: 32, direction: "out" }, { id: "src_b", name: "src_b[31:0]", width: 32, direction: "out" }, { id: "reg_x1", name: "x1[31:0]", width: 32, direction: "out" }, { id: "reg_x2", name: "x2[31:0]", width: 32, direction: "out" }], x: 0, y: 0, width: 180, height: 74, layer: 4, delayPs: 140, dynamicPowerMw: 0.85, sourceSpan: { lineStart: 41, lineEnd: 46 } },
    { id: "rv32_alu", label: "32-Bit Execution ALU", sublabel: "ADD, SUB, XOR, OR, AND", kind: "operator", scope: "riscv_mini_core", inputs: [{ id: "src_a", name: "src_a", width: 32, direction: "in" }, { id: "src_b", name: "src_b", width: 32, direction: "in" }, { id: "funct3", name: "funct3", width: 3, direction: "in" }], outputs: [{ id: "result", name: "result[31:0]", width: 32, direction: "out" }, { id: "branch", name: "branch", width: 1, direction: "out" }], x: 0, y: 0, width: 160, height: 64, layer: 5, delayPs: 160, dynamicPowerMw: 0.95, sourceSpan: { lineStart: 48, lineEnd: 58 } },

    { id: "out_pc", label: "pc[31:0]", kind: "port_out", scope: "riscv_mini_core", inputs: [{ id: "in", name: "pc", width: 32, direction: "in" }], outputs: [], x: 0, y: 0, width: 110, height: 28, layer: 6, delayPs: 10, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 8, lineEnd: 8 } },
    { id: "out_instr", label: "instr[31:0]", kind: "port_out", scope: "riscv_mini_core", inputs: [{ id: "in", name: "instr", width: 32, direction: "in" }], outputs: [], x: 0, y: 0, width: 120, height: 28, layer: 6, delayPs: 10, dynamicPowerMw: 0.08, sourceSpan: { lineStart: 9, lineEnd: 9 } },
    { id: "out_alu_res", label: "alu_result[31:0]", kind: "port_out", scope: "riscv_mini_core", inputs: [{ id: "in", name: "res", width: 32, direction: "in" }], outputs: [], x: 0, y: 0, width: 130, height: 28, layer: 6, delayPs: 10, dynamicPowerMw: 0.10, sourceSpan: { lineStart: 10, lineEnd: 10 } },
    { id: "out_x1", label: "reg_x1[31:0]", kind: "port_out", scope: "riscv_mini_core", inputs: [{ id: "in", name: "x1", width: 32, direction: "in" }], outputs: [], x: 0, y: 0, width: 110, height: 28, layer: 6, delayPs: 10, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 11, lineEnd: 11 } },
    { id: "out_x2", label: "reg_x2[31:0]", kind: "port_out", scope: "riscv_mini_core", inputs: [{ id: "in", name: "x2", width: 32, direction: "in" }], outputs: [], x: 0, y: 0, width: 110, height: 28, layer: 6, delayPs: 10, dynamicPowerMw: 0.05, sourceSpan: { lineStart: 12, lineEnd: 12 } }
  ];

  const edges: SchematicEdge[] = [
    { id: "e_clk_pc", netName: "clk", sourceNodeId: "in_clk", sourcePortId: "out", targetNodeId: "pc_reg", targetPortId: "clk", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "riscv_mini_core.clk", fanout: 2 },
    { id: "e_step_pc", netName: "step_en", sourceNodeId: "in_step_en", sourcePortId: "out", targetNodeId: "pc_reg", targetPortId: "step_en", width: 1, isBus: false, wirePoints: [], delayPs: 15, signalId: "riscv_mini_core.step_en", fanout: 1 },
    { id: "e_pc_rom", netName: "pc", sourceNodeId: "pc_reg", sourcePortId: "pc", targetNodeId: "instr_rom", targetPortId: "pc", width: 32, isBus: true, wirePoints: [], delayPs: 20, signalId: "riscv_mini_core.pc", fanout: 2 },
    { id: "e_pc_out", netName: "pc", sourceNodeId: "pc_reg", sourcePortId: "pc", targetNodeId: "out_pc", targetPortId: "in", width: 32, isBus: true, wirePoints: [], delayPs: 10, signalId: "riscv_mini_core.pc", fanout: 2 },
    { id: "e_rom_dec", netName: "instr", sourceNodeId: "instr_rom", sourcePortId: "instr", targetNodeId: "imm_dec", targetPortId: "instr", width: 32, isBus: true, wirePoints: [], delayPs: 25, signalId: "riscv_mini_core.instr", fanout: 2 },
    { id: "e_instr_out", netName: "instr", sourceNodeId: "instr_rom", sourcePortId: "instr", targetNodeId: "out_instr", targetPortId: "in", width: 32, isBus: true, wirePoints: [], delayPs: 10, signalId: "riscv_mini_core.instr", fanout: 2 },
    { id: "e_rs1_rf", netName: "rs1", sourceNodeId: "imm_dec", sourcePortId: "rs1", targetNodeId: "regfile", targetPortId: "rs1", width: 3, isBus: true, wirePoints: [], delayPs: 15, signalId: "riscv_mini_core.rs1", fanout: 1 },
    { id: "e_rs2_rf", netName: "rs2", sourceNodeId: "imm_dec", sourcePortId: "rs2", targetNodeId: "regfile", targetPortId: "rs2", width: 3, isBus: true, wirePoints: [], delayPs: 15, signalId: "riscv_mini_core.rs2", fanout: 1 },
    { id: "e_src_a_alu", netName: "src_a", sourceNodeId: "regfile", sourcePortId: "src_a", targetNodeId: "rv32_alu", targetPortId: "src_a", width: 32, isBus: true, wirePoints: [], delayPs: 25, signalId: "riscv_mini_core.src_a", fanout: 1 },
    { id: "e_src_b_alu", netName: "src_b", sourceNodeId: "regfile", sourcePortId: "src_b", targetNodeId: "rv32_alu", targetPortId: "src_b", width: 32, isBus: true, wirePoints: [], delayPs: 25, signalId: "riscv_mini_core.src_b", fanout: 1 },
    { id: "e_f3_alu", netName: "funct3", sourceNodeId: "imm_dec", sourcePortId: "funct3", targetNodeId: "rv32_alu", targetPortId: "funct3", width: 3, isBus: true, wirePoints: [], delayPs: 20, signalId: "riscv_mini_core.funct3", fanout: 1 },
    { id: "e_alu_wb", netName: "alu_result", sourceNodeId: "rv32_alu", sourcePortId: "result", targetNodeId: "regfile", targetPortId: "write_data", width: 32, isBus: true, wirePoints: [], delayPs: 30, signalId: "riscv_mini_core.alu_result", fanout: 2 },
    { id: "e_alu_out", netName: "alu_result", sourceNodeId: "rv32_alu", sourcePortId: "result", targetNodeId: "out_alu_res", targetPortId: "in", width: 32, isBus: true, wirePoints: [], delayPs: 10, signalId: "riscv_mini_core.alu_result", fanout: 2 },
    { id: "e_x1_out", netName: "reg_x1", sourceNodeId: "regfile", sourcePortId: "reg_x1", targetNodeId: "out_x1", targetPortId: "in", width: 32, isBus: true, wirePoints: [], delayPs: 10, signalId: "riscv_mini_core.reg_x1", fanout: 1 },
    { id: "e_x2_out", netName: "reg_x2", sourceNodeId: "regfile", sourcePortId: "reg_x2", targetNodeId: "out_x2", targetPortId: "in", width: 32, isBus: true, wirePoints: [], delayPs: 10, signalId: "riscv_mini_core.reg_x2", fanout: 1 }
  ];

  const graph: SchematicGraph = { id: "riscv_graph", topModule: "riscv_mini_core", nodes, edges, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } };
  return layoutAndRouteGraph(graph);
}
