
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: { userId },
    orderBy: { start: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const start = new Date(body.start);
    const end = new Date(body.end);
    const color = typeof body.color === "string" ? body.color : "#60a5fa";
    const allDay = body.allDay === true;

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

    const event = await prisma.event.create({
      data: {
        title,
        start,
        end,
        color,
        allDay,
        userId,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create event" },
      { status: 400 }
    );
  }
}
