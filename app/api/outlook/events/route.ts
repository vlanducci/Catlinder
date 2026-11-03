import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CalendarTokenError,
  getCalendarAccessToken,
} from "@/lib/calendar-provider-auth";

type CreateEventBody = {
  calendarId?: unknown;
  title?: unknown;
  start?: unknown;
  end?: unknown;
  allDay?: unknown;
};

type MicrosoftCalendar = {
  id: string;
  name: string;
};

type MicrosoftCalendarGroup = {
  id: string;
  name: string;
};

type MicrosoftProfile = {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

type MicrosoftEvent = {
  id: string;
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  isAllDay: boolean;
  isCancelled: boolean;
};

type MicrosoftCollection<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

class MicrosoftGraphError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const formatDate = (dateTime: string) =>
  /(?:Z|[+-]\d{2}:\d{2})$/.test(dateTime)
    ? dateTime
    : `${dateTime}Z`;

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
    const graphCalendarId = calendarIdParts.join(":");
    const title = body.title.trim();
    const start = new Date(body.start);
    const end = new Date(body.end);
    const allDay = body.allDay === true;

    if (
      !accountId ||
      !graphCalendarId ||
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
        provider: "microsoft-entra-id",
      },
    });
    if (!account) {
      return Response.json({ error: "Outlook account not found" }, { status: 404 });
    }

    let accessToken = await getCalendarAccessToken(account, "outlook");
    const createGraphEvent = async (token: string) => {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(graphCalendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: 'outlook.timezone="UTC"',
          },
          body: JSON.stringify({
            subject: title,
            start: {
              dateTime: allDay
                ? `${start.toISOString().slice(0, 10)}T00:00:00`
                : start.toISOString().slice(0, 19),
              timeZone: "UTC",
            },
            end: {
              dateTime: allDay
                ? `${end.toISOString().slice(0, 10)}T00:00:00`
                : end.toISOString().slice(0, 19),
              timeZone: "UTC",
            },
            isAllDay: allDay,
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new MicrosoftGraphError(
          response.status,
          `Unable to create Outlook event (${response.status}): ${await response.text()}`
        );
      }

      return response.json() as Promise<MicrosoftEvent>;
    };

    let createdEvent: MicrosoftEvent;
    try {
      createdEvent = await createGraphEvent(accessToken);
    } catch (error) {
      if (
        !(
          error instanceof MicrosoftGraphError ||
          error instanceof CalendarTokenError
        ) ||
        error.status !== 401
      ) {
        throw error;
      }
      accessToken = await getCalendarAccessToken(account, "outlook", true);
      createdEvent = await createGraphEvent(accessToken);
    }

    return Response.json(
      {
        id: `outlook-${account.id}-${graphCalendarId}-${createdEvent.id}`,
        calendarId: body.calendarId,
        title: createdEvent.subject || title,
        start: createdEvent.isAllDay
          ? createdEvent.start.dateTime.slice(0, 10)
          : formatDate(createdEvent.start.dateTime),
        end: createdEvent.isAllDay
          ? createdEvent.end.dateTime.slice(0, 10)
          : formatDate(createdEvent.end.dateTime),
        allDay: createdEvent.isAllDay,
        color: "var(--event-color-outlook)",
        provider: "outlook",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unable to create Outlook event:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Outlook event",
      },
      {
        status:
          error instanceof MicrosoftGraphError ||
          error instanceof CalendarTokenError
            ? error.status
            : 500,
      }
    );
  }
}

async function fetchMicrosoftCollection<T>(
  url: string,
  accessToken: string
): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    if (new URL(nextUrl).origin !== "https://graph.microsoft.com") {
      throw new Error("Microsoft Graph returned an unexpected pagination URL");
    }

    const response = await fetch(nextUrl, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!response.ok) {
      const details = await response.text();
      throw new MicrosoftGraphError(
        response.status,
        `Microsoft Graph request failed (${response.status}): ${details}`
      );
    }

    const data: MicrosoftCollection<T> = await response.json();
    items.push(...data.value);
    nextUrl = data["@odata.nextLink"] ?? null;
  }

  return items;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (
    !start ||
    !end ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(start) >= Date.parse(end)
  ) {
    return Response.json({ error: "Invalid date range" }, { status: 400 });
  }

  try {
    const events: {
      id: string;
      calendarId: string;
      title: string;
      start: string;
      end: string;
      allDay: boolean;
      color: string;
      provider: "outlook";
    }[] = [];
    const calendars: {
      id: string;
      name: string;
      accountId: string;
      accountName: string;
      provider: "outlook";
    }[] = [];
    const errors: { accountName: string; message: string }[] = [];
    const accounts = await prisma.account.findMany({
      where: {
        userId: session.user.id,
        provider: "microsoft-entra-id",
      },
    });

    if (accounts.length === 0) {
      return Response.json({ calendars, events, errors });
    }

    for (const account of accounts) {
      let accountName = "Microsoft account";

      try {
        let accessToken = await getCalendarAccessToken(account, "outlook");

        const loadAccountCalendars = async (token: string) => {
          const profileResponse = await fetch(
            "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }
          );
          if (!profileResponse.ok) {
            throw new MicrosoftGraphError(
              profileResponse.status,
              `Unable to retrieve Microsoft account profile (${profileResponse.status})`
            );
          }

          const profile: MicrosoftProfile = await profileResponse.json();
          accountName =
            profile.mail ||
            profile.userPrincipalName ||
            profile.displayName ||
            accountName;

          const calendarsUrl = new URL(
            "https://graph.microsoft.com/v1.0/me/calendars"
          );
          calendarsUrl.search = new URLSearchParams({
            $select: "id,name",
            $top: "100",
          }).toString();

          const microsoftCalendars =
            await fetchMicrosoftCollection<MicrosoftCalendar>(
              calendarsUrl.toString(),
              token
            );
          const accountEvents: typeof events = [];
          const accountCalendars: typeof calendars = [];
          const accountErrors: typeof errors = [];

          const allCalendars = new Map(
            microsoftCalendars.map((calendar) => [calendar.id, calendar])
          );
          const groupsUrl = new URL(
            "https://graph.microsoft.com/v1.0/me/calendarGroups"
          );
          groupsUrl.search = new URLSearchParams({
            $select: "id,name",
            $top: "100",
          }).toString();

          try {
            const calendarGroups =
              await fetchMicrosoftCollection<MicrosoftCalendarGroup>(
                groupsUrl.toString(),
                token
              );

            for (const group of calendarGroups) {
              const groupCalendarsUrl = new URL(
                `https://graph.microsoft.com/v1.0/me/calendarGroups/${encodeURIComponent(
                  group.id
                )}/calendars`
              );
              groupCalendarsUrl.search = new URLSearchParams({
                $select: "id,name",
                $top: "100",
              }).toString();

              try {
                const groupCalendars =
                  await fetchMicrosoftCollection<MicrosoftCalendar>(
                    groupCalendarsUrl.toString(),
                    token
                  );
                for (const calendar of groupCalendars) {
                  allCalendars.set(calendar.id, calendar);
                }
              } catch (error) {
                if (
                  error instanceof MicrosoftGraphError &&
                  error.status === 401
                ) {
                  throw error;
                }
                accountErrors.push({
                  accountName,
                  message: `${group.name}: ${
                    error instanceof Error
                      ? error.message
                      : "Unable to retrieve calendars in this group"
                  }`,
                });
              }
            }
          } catch (error) {
            if (
              error instanceof MicrosoftGraphError &&
              error.status === 401
            ) {
              throw error;
            }
            accountErrors.push({
              accountName,
              message:
                error instanceof Error
                  ? `Unable to retrieve Outlook calendar groups: ${error.message}`
                  : "Unable to retrieve Outlook calendar groups",
            });
          }

          for (const calendar of allCalendars.values()) {
            const calendarId = `${account.id}:${calendar.id}`;
            accountCalendars.push({
              id: calendarId,
              name: calendar.name,
              accountId: account.id,
              accountName,
              provider: "outlook" as const,
            });

            try {
              const graphUrl = new URL(
                `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
                  calendar.id
                )}/calendarView`
              );
              graphUrl.search = new URLSearchParams({
                startDateTime: start,
                endDateTime: end,
                $select: "id,subject,start,end,isAllDay,isCancelled",
                $top: "100",
              }).toString();

              const calendarEvents =
                await fetchMicrosoftCollection<MicrosoftEvent>(
                  graphUrl.toString(),
                  token
                );

              accountEvents.push(
                ...calendarEvents
                  .filter((event) => !event.isCancelled)
                  .map((event) => ({
                    id: `outlook-${account.id}-${calendar.id}-${event.id}`,
                    calendarId,
                    title: event.subject || "Untitled event",
                    start: event.isAllDay
                      ? event.start.dateTime.slice(0, 10)
                      : formatDate(event.start.dateTime),
                    end: event.isAllDay
                      ? event.end.dateTime.slice(0, 10)
                      : formatDate(event.end.dateTime),
                    allDay: event.isAllDay,
                    color: "var(--event-color-outlook)",
                    provider: "outlook" as const,
                  }))
              );
            } catch (error) {
              if (error instanceof MicrosoftGraphError && error.status === 401) {
                throw error;
              }

              accountErrors.push({
                accountName,
                message: `${calendar.name}: ${
                  error instanceof Error
                    ? error.message
                    : "Unable to retrieve calendar events"
                }`,
              });
            }
          }

          return { accountCalendars, accountEvents, accountErrors };
        };

        try {
          const result = await loadAccountCalendars(accessToken);
          calendars.push(...result.accountCalendars);
          events.push(...result.accountEvents);
          errors.push(...result.accountErrors);
        } catch (error) {
          if (
            !(
              error instanceof MicrosoftGraphError ||
              error instanceof CalendarTokenError
            ) ||
            error.status !== 401
          ) {
            throw error;
          }

          accessToken = await getCalendarAccessToken(account, "outlook", true);
          const result = await loadAccountCalendars(accessToken);
          calendars.push(...result.accountCalendars);
          events.push(...result.accountEvents);
          errors.push(...result.accountErrors);
        }
      } catch (error) {
        console.error(`Outlook calendar load failed for ${accountName}:`, error);
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
  } catch (error) {
    console.error("Outlook events error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve Outlook events",
      },
      {
        status: error instanceof MicrosoftGraphError ? error.status : 500,
      }
    );
  }
}