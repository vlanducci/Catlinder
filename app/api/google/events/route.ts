// Google Calendar event API: creates, lists, updates, and deletes events for linked accounts.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CalendarTokenError,
  getCalendarAccessToken,
} from "@/lib/calendar-provider-auth";

type CreateEventBody = {
  calendarId?: unknown;
  eventId?: unknown;
  title?: unknown;
  start?: unknown;
  end?: unknown;
  allDay?: unknown;
};

type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  colorId?: string;
};

type GooglePage<T> = {
  items?: T[];
  nextPageToken?: string;
};

class GoogleCalendarError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body: CreateEventBody = await request.json();
    if (
      typeof body.calendarId !== "string" ||
      typeof body.title !== "string" ||
      typeof body.start !== "string" ||
      typeof body.end !== "string"
    ) {
      return Response.json({ error: "Invalid event data" }, { status: 400 });
    }

    const [accountId, ...calendarIdParts] = body.calendarId.split(":");
    const googleCalendarId = calendarIdParts.join(":");
    const title = body.title.trim();
    const start = new Date(body.start);
    const end = new Date(body.end);
    const allDay = body.allDay === true;

    if (
      !accountId ||
      !googleCalendarId ||
      !title ||
      title.length > 200 ||
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    ) {
      return Response.json({ error: "Invalid event data" }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        provider: "google",
      },
    });
    // Never use a provider event ID until its linked account is confirmed to belong to this user.
    if (!account) {
      return Response.json({ error: "Google account not found" }, { status: 404 });
    }

    let accessToken = await getCalendarAccessToken(account, "google");
    const createGoogleEvent = async (token: string) => {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: title,
            // Google represents all-day events with date-only values and an exclusive end date.
            start: allDay
              ? { date: start.toISOString().slice(0, 10) }
              : { dateTime: start.toISOString() },
            end: allDay
              ? { date: end.toISOString().slice(0, 10) }
              : { dateTime: end.toISOString() },
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new GoogleCalendarError(
          response.status,
          `Unable to create Google Calendar event (${response.status}): ${await response.text()}`
        );
      }

      return response.json() as Promise<GoogleEvent>;
    };

    let createdEvent: GoogleEvent;
    try {
      createdEvent = await createGoogleEvent(accessToken);
    } catch (error) {
      if (
        !(
          error instanceof GoogleCalendarError ||
          error instanceof CalendarTokenError
        ) ||
        error.status !== 401
      ) {
        throw error;
      }
      accessToken = await getCalendarAccessToken(account, "google", true);
      createdEvent = await createGoogleEvent(accessToken);
    }

    const eventStart = createdEvent.start?.dateTime ?? createdEvent.start?.date;
    const eventEnd = createdEvent.end?.dateTime ?? createdEvent.end?.date;
    if (!createdEvent.id || !eventStart || !eventEnd) {
      throw new Error("Google created an event but returned incomplete details");
    }

    return Response.json(
      {
        id: `google-${account.id}-${googleCalendarId}-${createdEvent.id}`,
        calendarId: body.calendarId,
      externalEventId: createdEvent.id,
      title: createdEvent.summary || title,
      start: eventStart,
      end: eventEnd,
        allDay: Boolean(createdEvent.start?.date),
        color: "var(--event-color-google)",
        provider: "google",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unable to create Google Calendar event:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Google Calendar event",
      },
      {
        status:
          error instanceof GoogleCalendarError ||
          error instanceof CalendarTokenError
            ? error.status
            : 500,
      }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body: CreateEventBody = await request.json();
    if (
      typeof body.calendarId !== "string" ||
      typeof body.eventId !== "string" ||
      typeof body.title !== "string" ||
      typeof body.start !== "string" ||
      typeof body.end !== "string"
    ) {
      return Response.json({ error: "Invalid event data" }, { status: 400 });
    }

    const [accountId, ...calendarIdParts] = body.calendarId.split(":");
    const googleCalendarId = calendarIdParts.join(":");
    const eventId = body.eventId.trim();
    const title = body.title.trim();
    const startValue = body.start;
    const endValue = body.end;
    const start = new Date(startValue);
    const end = new Date(endValue);
    const allDay = body.allDay === true;

    if (
      !accountId ||
      !googleCalendarId ||
      !eventId ||
      eventId.length > 1024 ||
      !title ||
      title.length > 200 ||
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    ) {
      return Response.json({ error: "Invalid event data" }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        provider: "google",
      },
    });
    if (!account) {
      return Response.json({ error: "Google account not found" }, { status: 404 });
    }

    // Keep provider requests inside the authenticated account and selected calendar.
    const updateGoogleEvent = async (token: string) => {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: title,
            start: allDay
              ? { date: startValue.slice(0, 10) }
              : { dateTime: start.toISOString() },
            end: allDay
              ? { date: endValue.slice(0, 10) }
              : { dateTime: end.toISOString() },
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new GoogleCalendarError(
          response.status,
          `Unable to update Google Calendar event (${response.status}): ${await response.text()}`
        );
      }

      return response.json() as Promise<GoogleEvent>;
    };

    let updatedEvent: GoogleEvent;
    try {
      updatedEvent = await updateGoogleEvent(
        await getCalendarAccessToken(account, "google")
      );
    } catch (error) {
      if (
        !(
          error instanceof GoogleCalendarError ||
          error instanceof CalendarTokenError
        ) ||
        error.status !== 401
      ) {
        throw error;
      }
      updatedEvent = await updateGoogleEvent(
        await getCalendarAccessToken(account, "google", true)
      );
    }

    const eventStart = updatedEvent.start?.dateTime ?? updatedEvent.start?.date;
    const eventEnd = updatedEvent.end?.dateTime ?? updatedEvent.end?.date;
    if (!eventStart || !eventEnd) {
      throw new Error("Google updated the event but returned incomplete details");
    }

    return Response.json({
      id: `google-${account.id}-${googleCalendarId}-${updatedEvent.id || eventId}`,
      calendarId: body.calendarId,
      externalEventId: updatedEvent.id || eventId,
      title: updatedEvent.summary || title,
      start: eventStart,
      end: eventEnd,
      allDay: Boolean(updatedEvent.start?.date),
      color: "var(--event-color-google)",
      provider: "google",
    });
  } catch (error) {
    console.error("Unable to update Google Calendar event:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update Google Calendar event",
      },
      {
        status:
          error instanceof GoogleCalendarError ||
          error instanceof CalendarTokenError
            ? error.status
            : 500,
      }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body: CreateEventBody = await request.json();
    if (
      typeof body.calendarId !== "string" ||
      typeof body.eventId !== "string"
    ) {
      return Response.json({ error: "Invalid event data" }, { status: 400 });
    }

    const [accountId, ...calendarIdParts] = body.calendarId.split(":");
    const googleCalendarId = calendarIdParts.join(":");
    const eventId = body.eventId.trim();
    if (!accountId || !googleCalendarId || !eventId || eventId.length > 1024) {
      return Response.json({ error: "Invalid event data" }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        provider: "google",
      },
    });
    if (!account) {
      return Response.json({ error: "Google account not found" }, { status: 404 });
    }

    // Delete uses the same account ownership check as updates before contacting Google.
    const deleteGoogleEvent = async (token: string) => {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new GoogleCalendarError(
          response.status,
          `Unable to delete Google Calendar event (${response.status}): ${await response.text()}`
        );
      }
    };

    try {
      await deleteGoogleEvent(await getCalendarAccessToken(account, "google"));
    } catch (error) {
      if (
        !(
          error instanceof GoogleCalendarError ||
          error instanceof CalendarTokenError
        ) ||
        error.status !== 401
      ) {
        throw error;
      }
      await deleteGoogleEvent(
        await getCalendarAccessToken(account, "google", true)
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Unable to delete Google Calendar event:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete Google Calendar event",
      },
      {
        status:
          error instanceof GoogleCalendarError ||
          error instanceof CalendarTokenError
            ? error.status
            : 500,
      }
    );
  }
}

async function fetchGooglePages<T>(
  url: URL,
  accessToken: string
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;

  do {
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      throw new GoogleCalendarError(
        response.status,
        `Google Calendar API request failed (${response.status}): ${details}`
      );
    }

    const page: GooglePage<T> = await response.json();
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return items;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const start = params.get("start");
  const end = params.get("end");
  if (
    !start ||
    !end ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(start) >= Date.parse(end)
  ) {
    return Response.json({ error: "Invalid date range" }, { status: 400 });
  }

  const accounts = await prisma.account.findMany({
    where: {
      userId: session.user.id,
      provider: "google",
    },
  });

  const calendars: {
    id: string;
    name: string;
    accountId: string;
    accountName: string;
    provider: "google";
  }[] = [];
  const events: {
    id: string;
    calendarId: string;
    externalEventId: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    color: "var(--event-color-google)";
    provider: "google";
  }[] = [];
  const errors: { accountName: string; message: string }[] = [];

  for (const account of accounts) {
    let accountName = "Google account";

    const loadAccountCalendars = async (token: string) => {
      const accountCalendars: typeof calendars = [];
      const accountEvents: typeof events = [];
      const profileResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (!profileResponse.ok) {
        throw new GoogleCalendarError(
          profileResponse.status,
          `Unable to retrieve Google account profile (${profileResponse.status})`
        );
      }

      const profile: { email?: string; name?: string } =
        await profileResponse.json();
      accountName = profile.email || profile.name || accountName;

      const calendarsUrl = new URL(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList"
      );
      calendarsUrl.searchParams.set("maxResults", "250");
      const googleCalendars = await fetchGooglePages<GoogleCalendarListEntry>(
        calendarsUrl,
        token
      );

      for (const calendar of googleCalendars) {
        const calendarId = `${account.id}:${calendar.id}`;
        accountCalendars.push({
          id: calendarId,
          name: calendar.summary || calendar.id,
          accountId: account.id,
          accountName,
          provider: "google",
        });

        const eventsUrl = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendar.id
          )}/events`
        );
        eventsUrl.searchParams.set("timeMin", start);
        eventsUrl.searchParams.set("timeMax", end);
        eventsUrl.searchParams.set("singleEvents", "true");
        eventsUrl.searchParams.set("orderBy", "startTime");
        eventsUrl.searchParams.set("showDeleted", "false");
        eventsUrl.searchParams.set("maxResults", "2500");

        const googleEvents = await fetchGooglePages<GoogleEvent>(
          eventsUrl,
          token
        );

        for (const event of googleEvents) {
          const eventStart = event.start?.dateTime ?? event.start?.date;
          const eventEnd = event.end?.dateTime ?? event.end?.date;
          if (!event.id || !eventStart || !eventEnd || event.status === "cancelled") {
            continue;
          }

          const allDay = Boolean(event.start?.date);
          accountEvents.push({
            id: `google-${account.id}-${calendar.id}-${event.id}`,
            calendarId,
            externalEventId: event.id,
            title: event.summary || "Untitled event",
            start: eventStart,
            end: eventEnd,
            allDay,
            color: "var(--event-color-google)",
            provider: "google",
          });
        }
      }

      return { accountCalendars, accountEvents };
    };

    try {
      const token = await getCalendarAccessToken(account, "google");
      let result: Awaited<ReturnType<typeof loadAccountCalendars>>;
      try {
        result = await loadAccountCalendars(token);
      } catch (error) {
        if (
          !(
            error instanceof GoogleCalendarError ||
            error instanceof CalendarTokenError
          ) ||
          error.status !== 401
        ) {
          throw error;
        }
        result = await loadAccountCalendars(
          await getCalendarAccessToken(account, "google", true)
        );
      }

      calendars.push(...result.accountCalendars);
      events.push(...result.accountEvents);
    } catch (error) {
      console.error(`Google calendar load failed for ${accountName}:`, error);
      errors.push({
        accountName,
        message:
          error instanceof Error
            ? error.message
            : "Unable to retrieve calendars for this account",
      });
    }
  }

  return Response.json({ calendars, events, errors });
}
