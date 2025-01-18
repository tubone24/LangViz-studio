import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../prisma";

export async function GET(req: NextRequest) {
  try {
    const latest = await prisma.graph.findFirst({
      orderBy: { createdAt: "desc" }
    });
    if (!latest) {
      return NextResponse.json({ graphId: null });
    }
    return NextResponse.json({ graphId: latest.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch last graph" }, { status: 500 });
  }
}
