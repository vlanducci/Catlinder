
// Authenticated handlers for updating or deleting one of the user's Catlinder events.
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

    const title =
      typeof body.title === "string" ? body.title.trim() : "";
    const start = new Date(body.start);
    const end = new Date(body.end);
    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim()
        : "var(--event-color-04)";
    const allDay = body.allDay === true;

    const errors: string[] = [];

    if (!title) errors.push("Missing title");
    if (title.length > 200) errors.push("Title exceeds 200 characters");
    if (!Number.isFinite(start.getTime())) errors.push("Invalid start date");
    if (!Number.isFinite(end.getTime())) errors.push("Invalid end date");

    if (
      Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime()) &&
      end <= start
    ) {
      errors.push("End must be after start");
    }


    if (errors.length > 0) {
      console.error("Event validation failed:", {
        title,
        start: body.start,
        end: body.end,
        color,
        errors,
      });

      return NextResponse.json(
        { error: "Invalid event data", details: errors },
        { status: 400 }
      );
    }

    // Include the owner in the update filter so another user's event cannot be changed.
    const result = await prisma.event.updateMany({
      where: { id, userId },
      data: { title, start, end, color, allDay },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const event = await prisma.event.findFirst({
      where: { id, userId },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("Unable to update event:", error);

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

  try {
    const { id } = await params;

    // Delete by both event ID and owner, matching the authorization check above.
    const result = await prisma.event.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unable to delete event:", error);

    return NextResponse.json(
      { error: "Unable to delete event" },
      { status: 500 }
    );
  }
}
