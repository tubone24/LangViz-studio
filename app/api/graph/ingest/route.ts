import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(body);
    /**
     * {
     *   graphId: 123,
     *   nodes: { nodeA: [ {stepIndex, input, output} ], nodeB: [...] },
     *   edges: [ {source, target, conditionKey, used_count}, ... ]
     * }
     */

    const graphId = body.graphId;

    if (!graphId) {
      throw new Error("graphId is missing!");
    }

    // 1) Delete existing steps, edges (if you expect to overwrite them)
    await prisma.step.deleteMany({ where: { graphId } });
    await prisma.edge.deleteMany({ where: { graphId } });

    // 2) Steps
    const nodesObj = body.nodes || {};
    for (const nodeName of Object.keys(nodesObj)) {
      const calls = nodesObj[nodeName];
      for (const call of calls) {
        await prisma.step.create({
          data: {
            graphId,
            nodeName,
            stepIndex: call.stepIndex,
            inputJson: JSON.stringify(call.input||{}),
            outputJson: JSON.stringify(call.output||{})
          }
        });
      }
    }

    // 3) Edges
    const edgesArr = body.edges || [];
    for (const ed of edgesArr) {
      await prisma.edge.create({
        data: {
          graphId,
          sourceNode: ed.source,
          targetNode: ed.target,
          conditionKey: ed.conditionKey,
          usedCount: ed.used_count||0
        }
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Error in /api/graph/ingest POST:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
