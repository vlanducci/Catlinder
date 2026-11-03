
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

    const title =
      typeof body.title === "string" ? body.title.trim() : "";
    const start = new Date(body.start);
    const end = new Date(body.end);

    console.log("Received colour:", body.color);
    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim()
        : "#60a5fa";
    const allDay = body.allDay === true;

    const errors: string[] = [];

    if (!title) errors.push("Title is required");
    if (title.length > 200) errors.push("Title must be 200 characters or fewer");
    if (!Number.isFinite(start.getTime())) errors.push("Invalid start date");
    if (!Number.isFinite(end.getTime())) errors.push("Invalid end date");
    if (Number.isFinite(start.getTime()) &&
        Number.isFinite(end.getTime()) &&
        end <= start) {
      errors.push("End must be after start");
    }


    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Invalid event data", details: errors },
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
    console.log("Selected colour AFTER validation:", color);

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Unable to create event:", error);

    return NextResponse.json(
      { error: "Unable to create event" },
      { status: 400 }
    );
    
  }

  
}
