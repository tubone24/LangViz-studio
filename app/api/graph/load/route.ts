import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const graphId = searchParams.get("graphId");
    if (!graphId) {
      return NextResponse.json({ error: "graphId missing" }, { status:400 });
    }

    // steps
    const steps = await prisma.step.findMany({
      where: { graphId },
    });
    // edges
    const edges = await prisma.edge.findMany({
      where: { graphId },
    });

    // Putting it all together in ObservabilityLog format
    // nodes: Record<nodeName, NodeCall[]>
    const nodes: Record<string, Array<any>> = {};
    for (const s of steps) {
      if (!nodes[s.nodeName]) {
        nodes[s.nodeName] = [];
      }
      nodes[s.nodeName].push({
        stepIndex: s.stepIndex,
        input: JSON.parse(s.inputJson || "{}"),
        output: JSON.parse(s.outputJson || "{}")
      });
    }

    const edgesArr = edges.map((e) => ({
      source: e.sourceNode,
      target: e.targetNode,
      conditionKey: e.conditionKey || undefined,
      used_count: e.usedCount
    }));

    return NextResponse.json({ nodes, edges: edgesArr });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
