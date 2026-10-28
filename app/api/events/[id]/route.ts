
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Context) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const start = new Date(body.start);
    const end = new Date(body.end);
    const color = typeof body.color === "string" ? body.color : "#60a5fa";

    if (
      !title ||
      title.length > 200 ||
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start ||
      !/^#[0-9a-fA-F]{6}$/.test(color)
    ) {
      return NextResponse.json(
        { error: "Invalid event data" },
        { status: 400 }
      );
    }

    const result = await prisma.event.updateMany({
      where: { id, userId },
      data: { title, start, end, color },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = await prisma.event.findFirst({
      where: { id, userId },
    });

    return NextResponse.json(event);
  } catch {
    return NextResponse.json(
      { error: "Unable to update event" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await prisma.event.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
