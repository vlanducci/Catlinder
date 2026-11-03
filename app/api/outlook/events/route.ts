import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMicrosoftOAuthConfig } from "@/lib/outlook-oauth";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
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

async function getAccountAccessToken(
  account: {
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    expires_at: number | null;
    scope: string | null;
  },
  forceRefresh = false
) {
  if (
    !forceRefresh &&
    account.access_token &&
    account.expires_at &&
    account.expires_at > Math.floor(Date.now() / 1000) + 300
  ) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new MicrosoftGraphError(
      401,
      "Microsoft re-authentication required for this account"
    );
  }

  let tokenUrl: string;
  let clientId: string;
  let clientSecret: string;
  try {
    const config = getMicrosoftOAuthConfig();
    tokenUrl = config.tokenUrl;
    clientId = config.clientId;
    clientSecret = config.clientSecret;
  } catch {
    throw new MicrosoftGraphError(
      500,
      "Microsoft authentication configuration is missing"
    );
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      scope:
        "openid profile email User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared offline_access",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new MicrosoftGraphError(
      401,
      `Unable to refresh Microsoft access token: ${details}`
    );
  }

  const tokens: MicrosoftTokenResponse = await response.json();
  if (!tokens.access_token || !tokens.expires_in) {
    throw new MicrosoftGraphError(
      401,
      "Microsoft did not return a usable access token"
    );
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? account.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      scope: tokens.scope ?? account.scope,
    },
  });

  return tokens.access_token;
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
        let accessToken = await getAccountAccessToken(account);

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
          if (!(error instanceof MicrosoftGraphError) || error.status !== 401) {
            throw error;
          }

          accessToken = await getAccountAccessToken(account, true);
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