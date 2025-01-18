import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const graphId = body.graphId; // UUID from Python-SDK
    const name = body.name || "Untitled";

    const newGraph = await prisma.graph.create({
      data: {
        id: graphId,
        name
      }
    });

    return NextResponse.json({ graphId: newGraph.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create graph" }, { status: 500 });
  }
}
