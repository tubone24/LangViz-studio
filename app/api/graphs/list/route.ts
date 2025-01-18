import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../prisma";

export async function GET(req: NextRequest) {
  try {
    const graphs = await prisma.graph.findMany({
      orderBy: { createdAt: "desc" }
    });
    // graphs: [ { id, name, createdAt }, ...]
    return NextResponse.json(graphs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
