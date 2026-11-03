import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
};

type GooglePage<T> = {
  items?: T[];
  nextPageToken?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

class GoogleCalendarError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function getAccessToken(
  account: {
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    expires_at: number | null;
  },
  forceRefresh = false
) {
  if (
    !forceRefresh &&
    account.access_token &&
    account.expires_at &&
    account.expires_at > Math.floor(Date.now() / 1000) + 60
  ) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new GoogleCalendarError(
      401,
      "Google re-authentication required for this account"
    );
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleCalendarError(
      500,
      "Google authentication configuration is missing"
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new GoogleCalendarError(
      401,
      `Unable to refresh Google access token: ${details}`
    );
  }

  const tokens: GoogleTokenResponse = await response.json();
  if (!tokens.access_token || !tokens.expires_in) {
    throw new GoogleCalendarError(
      401,
      "Google did not return a usable access token"
    );
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
    },
  });

  return tokens.access_token;
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
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    color: string;
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
      const token = await getAccessToken(account);
      let result: Awaited<ReturnType<typeof loadAccountCalendars>>;
      try {
        result = await loadAccountCalendars(token);
      } catch (error) {
        if (!(error instanceof GoogleCalendarError) || error.status !== 401) {
          throw error;
        }
        result = await loadAccountCalendars(
          await getAccessToken(account, true)
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
