"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";

import dagre from "dagre";

// ========================
// Types
// ========================
type NodeCall = {
  stepIndex: number;
  input: any;
  output: any;
};
type EdgeCall = {
  source: string;
  target: string;
  stepIndex?: number;
  conditionKey?: string;
  used_count?: number;
};
type ObservabilityLog = {
  nodes: Record<string, NodeCall[]>;
  edges: EdgeCall[];
};

/**
 * Try if JSON can be parsed, and return object if it can be parsed. If it fails, null is returned.
 */
function tryParseJson(str: unknown): object | null {
  if (typeof str !== "string") return null;
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function formatIfJson(val: unknown): string {
  if (typeof val !== "string") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  try {
    return JSON.stringify(JSON.parse(val), null, 2);
  } catch {
    return val;
  }
}

function RenderJsonProps({ data }: { data: any }) {
  // If data is an object and has properties at the top level, list them as key:value
  // Otherwise, display formatIfJson(data) in its entirety
  if (!data || typeof data !== "object") {
    return <pre className="text-sm">{formatIfJson(data)}</pre>;
  }
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <pre className="text-sm">(empty object)</pre>;
  }
  return (
    <div className="space-y-2 text-sm">
      {entries.map(([k, v]) => {
        const str = typeof v === "object" ? formatIfJson(v) : String(v);
        return (
          <div key={k}>
            <strong>{k}:</strong> {str}
          </div>
        );
      })}
    </div>
  );
}

function TextField({ label, data }: { label: string; data: any }) {
  return (
    <div className="mb-4">
      <label className="font-bold block mb-1">{label}:</label>
      <div className="p-2 border rounded bg-gray-100">
        <RenderJsonProps data={data} />
      </div>
    </div>
  );
}

function Drawer({
                  open,
                  onClose,
                  allSteps
                }: {
  open: boolean;
  onClose: () => void;
  allSteps: NodeCall[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!open) return null;
  if (!allSteps || allSteps.length === 0) return null;

  const currentStep = allSteps[selectedIndex];

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedIndex(Number(e.target.value));
  };

  return (
    <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-lg p-6 z-50 overflow-auto">
      <button
        className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded mb-4"
        onClick={onClose}
      >
        Close
      </button>
      <h3 className="text-xl font-bold mb-4">Node Steps</h3>

      {/* Select Steps */}
      <select
        className="mb-4 p-1 border"
        onChange={handleSelectChange}
        value={selectedIndex}
      >
        {allSteps.map((step, idx) => (
          <option key={step.stepIndex} value={idx}>
            Step {step.stepIndex}
          </option>
        ))}
      </select>

      <TextField label="Input" data={currentStep.input} />
      <TextField label="Output" data={currentStep.output} />
    </div>
  );
}

export default function GraphPage() {
  const searchParams = useSearchParams();
  const urlGraphId = searchParams.get("graphId");  // ?graphId=xxx

  const [graphId, setGraphId] = useState<number | string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSteps, setDrawerSteps] = useState<NodeCall[]>([]);
  const [waiting, setWaiting] = useState(false); // "DBに何もない"待機フラグ

  const layoutGraph = (rfNodes: Node[], rfEdges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: "LR",
      nodesep: 100,
      ranksep: 200
    });

    rfNodes.forEach((node) => {
      const width = (node.style?.width as number) || 150;
      const height = (node.style?.height as number) || 50;
      dagreGraph.setNode(node.id, { width, height });
    });
    rfEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = rfNodes.map((node) => {
      const npos = dagreGraph.node(node.id);
      node.position = {
        x: npos.x - ( (node.style?.width as number)/2 || 75),
        y: npos.y - ( (node.style?.height as number)/2 || 25)
      };
      return node;
    });
    return { layoutedNodes, edges: rfEdges };
  };

  const fetchLatestGraphId = async () => {
    try {
      const res = await fetch("/api/graph/last");
      const data = await res.json();
      if (data.graphId) {
        setGraphId(data.graphId); // 文字列 or 数値か注意
        setWaiting(false);
      } else {
        setGraphId(null);
        setWaiting(true);
      }
    } catch (err) {
      console.error("Failed to fetch last graphId:", err);
      setGraphId(null);
      setWaiting(true);
    }
  };

  const fetchGraphData = async (gid: string | number) => {
    try {
      const res = await fetch(`/api/graph/load?graphId=${gid}`);
      if (!res.ok) throw new Error(`status=${res.status}`);
      const data: ObservabilityLog = await res.json();
      if (!data.nodes) {
        setNodes([]);
        setEdges([]);
        return;
      }

      // nodes
      const nodeEntries = Object.entries(data.nodes);
      const tmpNodes: Node[] = nodeEntries.map(([nodeName, calls]) => {
        const callsArr = calls as NodeCall[];
        const stepIndexes = callsArr.map(c => c.stepIndex).join(", ");
        let labelText = `Node: ${nodeName}\nstep: ${stepIndexes}`;
        let style: React.CSSProperties = { width:150, height:50 };

        if (nodeName==="start" || nodeName==="end") {
          labelText = nodeName.toUpperCase();
          style = {
            background:"black", color:"white", borderRadius:"50%",
            width:60, height:60, display:"flex", justifyContent:"center", alignItems:"center", fontWeight:"bold"
          };
        }

        return {
          id: nodeName,
          data: {
            label: labelText,
            allSteps: callsArr
          },
          style,
          position: { x:0, y:0 }
        };
      });

      // edges
      const tmpEdges: Edge[] = (data.edges||[]).map((ed, i) => {
        let strokeColor = "black";
        let dash: string|undefined;
        if (ed.conditionKey === "end") {
          strokeColor="red"; dash="4 2";
        }
        return {
          id:`edge-${i}`,
          source: ed.source,
          target: ed.target,
          label: ed.conditionKey ? `condition: ${ed.conditionKey}` : undefined,
          style: {
            stroke: strokeColor,
            strokeDasharray: dash,
            strokeWidth:2
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width:8,
            height:8
          }
        };
      });

      // layout with dagre
      const { layoutedNodes, edges: layoutedEdges } = layoutGraph(tmpNodes, tmpEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

    } catch (err) {
      console.error("Failed to load graph data:", err);
      setNodes([]);
      setEdges([]);
    }
  };

  useEffect(() => {
    if (urlGraphId) {
      setGraphId(urlGraphId); // string
      setWaiting(false);
    } else {
      // poll for latest graph
      fetchLatestGraphId();
      const interval = setInterval(() => {
        fetchLatestGraphId();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [urlGraphId]);

  useEffect(() => {
    if (!graphId) return;

    const loadData = async () => {
      await fetchGraphData(graphId);
    };
    loadData();

    // poll every 3s => re-fetch
    const pollId = setInterval(() => {
      fetchGraphData(graphId);
    }, 3000);

    return () => clearInterval(pollId);
  }, [graphId]);

  const onNodeClick = useCallback((e:React.MouseEvent, node: Node) => {
    const allSteps = node.data?.allSteps || [];
    setDrawerSteps(allSteps);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="w-screen h-screen relative">
      <button
        onClick={() => (window.location.href = "/")}
        className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded absolute top-4 left-4 z-50"
      >
        Back to Home
      </button>
      {waiting && !graphId && (
        <div className="p-4 text-gray-500">
          <p>No graph found in DB yet. Waiting for a new one...</p>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background/>
        <Controls/>
      </ReactFlow>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        allSteps={drawerSteps}
      />
    </div>
  );
}
