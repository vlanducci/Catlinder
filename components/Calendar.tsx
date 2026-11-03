
"use client";

// This component manages the calendar interface, including creating, editing, deleting, loading and displaying calendar events.

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import themePlugin from "@fullcalendar/react/themes/pulse";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/pulse/theme.css";
import CalendarMenu, { type CalendarOption } from "./CalendarMenu";
import EventModal, { eventColorVariables } from "./EventModal";
import ThemeToggle from "./ThemeToggle";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const defaultEventColor = `var(${eventColorVariables[0]})`;

// Defines the structure of a calendar event returned by the API.
type CalendarEvent = {
  id: string;
  calendarId?: string;
  title: string;
  start: string;
  end: string;
  color: string;
  allDay?: boolean;
  provider?: "google" | "outlook";
  // Provider IDs stay separate from the composite calendar event IDs used by FullCalendar.
  externalEventId?: string;
};

// Defines the structure of a calendar option returned by the API, which includes the calendar's ID, name, account name, and provider type.
const normalizeEventColor = (color: string) => {
  const normalizedColor = color.trim().toLowerCase();
  const colorVariable = eventColorVariables.find((variable) => {
    const cssColor = getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim()
      .toLowerCase();

    return (
      normalizedColor === variable.toLowerCase() ||
      normalizedColor === `var(${variable})` ||
      normalizedColor === cssColor
    );
  });

  return colorVariable ? `var(${colorVariable})` : color;
};

// The Calendar component is the main interface for managing and displaying calendar events. It handles state management for events, calendars, and user interactions, including opening modals for creating or editing events, saving events to the backend, and deleting events. It also integrates with external calendar providers like Google and Outlook to fetch and display events from those sources.
export default function Calendar() {
  const [outlookEvents, setOutlookEvents] = useState<CalendarEvent[]>([]);
  const [outlookCalendars, setOutlookCalendars] = useState<CalendarOption[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>(
    {}
  );
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null
  );
  const outlookRequestId = useRef(0);
  const calendarSelectionInitialized = useRef(false);
  const calendarColorsInitialized = useRef(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);  // Stores the list of events fetched from the API.
  const [selectedDate, setSelectedDate] = useState("");  // Stores the date selected by the user for creating or editing an event.
  const [endDate, setEndDate] = useState("");  // Stores the end date for the event being created or edited.
  const [title, setTitle] = useState("");  // Stores the title of the event being created or edited.
  const [startTime, setStartTime] = useState("09:00");  // Stores the start time for the event being created or edited.
  const [endTime, setEndTime] = useState("10:00");  // Stores the end time for the event being created or edited.
  const [isAllDay, setIsAllDay] = useState(false);
  const [color, setColor] = useState(defaultEventColor);  // Stores the colour for the event being created or edited.
  const [destinationCalendarId, setDestinationCalendarId] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);  // Stores the ID of the event currently being edited, or null if creating a new event.
  const [isOpen, setIsOpen] = useState(false);  // Controls the visibility of the event modal.

  // Returns the current date in YYYY-MM-DD format, which is used to pre-fill the date when creating a new event.
  const getLocalDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const loadExternalCalendarEvents = async (start: Date, end: Date) => {
    const requestId = ++outlookRequestId.current;

    try {
      const range =
        `start=${encodeURIComponent(start.toISOString())}` +
        `&end=${encodeURIComponent(end.toISOString())}`;
      const fetchSource = async (provider: "outlook" | "google") => {
        const response = await fetch(`/api/${provider}/events?${range}`);
        if (!response.ok) {
          const error: { error?: string } = await response.json();
          throw new Error(
            error.error ||
              `Failed to load ${provider} calendars (${response.status})`
          );
        }

        const data: {
          calendars: CalendarOption[];
          events: CalendarEvent[];
          errors?: { accountName: string; message: string }[];
        } = await response.json();

        if (!Array.isArray(data.calendars) || !Array.isArray(data.events)) {
          throw new Error(`${provider} returned an invalid events response`);
        }

        return data;
      };

      const [outlookResult, googleResult] = await Promise.allSettled([
        fetchSource("outlook"),
        fetchSource("google"),
      ]);
      const outlookData =
        outlookResult.status === "fulfilled" ? outlookResult.value : null;
      const googleData =
        googleResult.status === "fulfilled" ? googleResult.value : null;
      const calendars = [
        ...(outlookData?.calendars ?? []),
        ...(googleData?.calendars ?? []),
      ];
      const externalEvents = [
        ...(outlookData?.events ?? []),
        ...(googleData?.events ?? []),
      ];
      const errors = [
        ...(outlookData?.errors ?? []),
        ...(googleData?.errors ?? []),
        ...(outlookResult.status === "rejected"
          ? [
              {
                accountName: "Outlook",
                message:
                  outlookResult.reason instanceof Error
                    ? outlookResult.reason.message
                    : "Unable to load Outlook calendars",
              },
            ]
          : []),
        ...(googleResult.status === "rejected"
          ? [
              {
                accountName: "Google",
                message:
                  googleResult.reason instanceof Error
                    ? googleResult.reason.message
                    : "Unable to load Google calendars",
              },
            ]
          : []),
      ];

      if (!outlookData && !googleData) {
        throw new Error(errors.map(({ accountName, message }) =>
          `${accountName}: ${message}`
        ).join("; "));
      }

      if (requestId === outlookRequestId.current) {
        setOutlookCalendars(calendars);
        setOutlookEvents(externalEvents);
        if (!calendarColorsInitialized.current) {
          const storedColors = localStorage.getItem(
            "catlinder-calendar-colors"
          );
          let colors: Record<string, string> = {};

          if (storedColors) {
            try {
              const parsed: unknown = JSON.parse(storedColors);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                colors = Object.fromEntries(
                  Object.entries(parsed).filter(
                    ([, value]) =>
                      typeof value === "string" &&
                      /^#[0-9a-f]{6}$/i.test(value)
                  )
                );
              }
            } catch (error) {
              console.error("Unable to read saved calendar colours:", error);
            }
          }

          for (const calendar of calendars) {
            if (!colors[calendar.id]) {
              const variable =
                calendar.provider === "google"
                  ? "--event-color-google"
                  : "--event-color-outlook";
              colors[calendar.id] = getComputedStyle(
                document.documentElement
              )
                .getPropertyValue(variable)
                .trim();
            }
          }

          calendarColorsInitialized.current = true;
          setCalendarColors(colors);
        } else {
          setCalendarColors((previousColors) => {
            const nextColors = { ...previousColors };
            for (const calendar of calendars) {
              if (!nextColors[calendar.id]) {
                const variable =
                  calendar.provider === "google"
                    ? "--event-color-google"
                    : "--event-color-outlook";
                nextColors[calendar.id] = getComputedStyle(
                  document.documentElement
                )
                  .getPropertyValue(variable)
                  .trim();
              }
            }
            return nextColors;
          });
        }
        setCalendarError(
          errors.length > 0
            ? errors
                .map(({ accountName, message }) => `${accountName}: ${message}`)
                .join("; ")
            : null
        );

        if (!calendarSelectionInitialized.current) {
          const storedSelection = localStorage.getItem(
            "catlinder-outlook-calendars"
          );
          const query = new URLSearchParams(window.location.search);
          const connectedProvider =
            query.get("google") === "connected"
              ? "google"
              : query.get("outlook") === "connected"
                ? "outlook"
                : null;
          const connectionFailed =
            query.get("google") === "error" || query.get("outlook") === "error";
          let selectedIds = calendars.map((calendar) => calendar.id);

          if (storedSelection !== null) {
            try {
              const parsedSelection: unknown = JSON.parse(storedSelection);
              if (
                Array.isArray(parsedSelection) &&
                parsedSelection.every((id): id is string => typeof id === "string")
              ) {
                selectedIds = parsedSelection.filter((id) =>
                  calendars.some((calendar) => calendar.id === id)
                );
                const legacyCalendarIds = new Set(
                  parsedSelection.map((id) => id.split(":").at(-1))
                );
                selectedIds = [
                  ...selectedIds,
                  ...calendars
                    .filter(
                      (calendar) =>
                        calendar.provider === "outlook" &&
                        legacyCalendarIds.has(calendar.id.split(":").at(-1)) &&
                        !selectedIds.includes(calendar.id)
                    )
                    .map((calendar) => calendar.id),
                ];
              }
            } catch (error) {
              console.error("Unable to read saved calendar selection:", error);
            }
          }

          if (connectedProvider) {
            selectedIds = [
              ...selectedIds,
              ...calendars
                .filter(
                  (calendar) =>
                    calendar.provider === connectedProvider &&
                    !selectedIds.includes(calendar.id)
                )
                .map((calendar) => calendar.id),
            ];
            setConnectionMessage(
              `${connectedProvider === "google" ? "Google" : "Microsoft"} account connected.`
            );
          } else if (connectionFailed) {
            setConnectionMessage(
              "Could not connect the account. Please try again and approve calendar access."
            );
          }

          calendarSelectionInitialized.current = true;
          setSelectedCalendarIds(selectedIds);
          if (connectedProvider || connectionFailed) {
            window.history.replaceState(
              window.history.state,
              "",
              window.location.pathname
            );
          }
        }
      }
    } catch (error) {
      if (requestId === outlookRequestId.current) {
        setOutlookEvents([]);
        setCalendarError(
          error instanceof Error ? error.message : "Unable to load Outlook events"
        );
      }

      throw error;
    }
  };

  useEffect(() => {
    if (calendarSelectionInitialized.current) {
      localStorage.setItem(
        "catlinder-outlook-calendars",
        JSON.stringify(selectedCalendarIds)
      );
    }
  }, [selectedCalendarIds]);

  useEffect(() => {
    if (calendarColorsInitialized.current) {
      localStorage.setItem(
        "catlinder-calendar-colors",
        JSON.stringify(calendarColors)
      );
    }
  }, [calendarColors]);

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((selectedIds) =>
      selectedIds.includes(calendarId)
        ? selectedIds.filter((id) => id !== calendarId)
        : [...selectedIds, calendarId]
    );
  };

  const setCalendarColor = (calendarId: string, value: string) => {
    setCalendarColors((previousColors) => ({
      ...previousColors,
      [calendarId]: value,
    }));
  };

  const visibleExternalEvents = outlookEvents.filter((event) =>
    selectedCalendarIds.includes(event.calendarId ?? "")
  );

  // Opens the event modal for creating a new event, pre-filling the date and resetting other fields.
  const openModal = (date: string) => {
    const dateOnly = date.slice(0, 10);

    setSelectedDate(dateOnly);
    setEndDate(dateOnly);
    setTitle("");
    setStartTime("09:00");
    setEndTime("10:00");
    setIsAllDay(false);
    setColor(defaultEventColor);
    setDestinationCalendarId("");
    setEditingEventId(null);
    setIsOpen(true);
  };

  const changeAllDay = (value: boolean) => {
    setIsAllDay(value);
    if (!value || endDate > selectedDate) return;

    const nextDay = new Date(`${selectedDate}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    setEndDate(
      `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`
    );
  };

  // Prepares the event modal for editing an existing event.
  const editEvent = (event: {
    id: string;
    title: string;
    start: Date | null;
    end: Date | null;
  }) => {
    if (!event.start) return;

    const pad = (value: number) => String(value).padStart(2, "0");
    const date = event.start;
    const end = event.end ?? new Date(date.getTime() + 60 * 60 * 1000);
    const savedEvent = [...events, ...outlookEvents].find(
      (item) => item.id === event.id
    );
    const dateValue = savedEvent?.allDay
      ? savedEvent.start.slice(0, 10)
      : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const endDateValue = savedEvent?.allDay
      ? savedEvent.end.slice(0, 10)
      : `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

    setEditingEventId(event.id);
    setDestinationCalendarId("");
    setTitle(event.title);
    setSelectedDate(dateValue);
    setEndDate(endDateValue);
    setStartTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
    setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);

    setIsAllDay(savedEvent?.allDay ?? false);
    setColor(
      savedEvent
        ? normalizeEventColor(savedEvent.color)
        : defaultEventColor
    );

    setIsOpen(true);
  };

  // Saves the event data to the backend and updates the local state.
  const saveEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();  // Prevents the default form submission behavior to handle it via JavaScript.

    // Validates the input fields before proceeding with the save operation.
    if (
      !title.trim() ||
      (isAllDay && endDate <= selectedDate) ||
      (!isAllDay &&
        (endDate < selectedDate ||
          (endDate === selectedDate && endTime <= startTime)))
    ) {
      return;
    }

    const eventBeingEdited = editingEventId
      ? [...events, ...outlookEvents].find(
          (event) => event.id === editingEventId
        )
      : undefined;
    const targetCalendarId =
      eventBeingEdited?.calendarId ?? destinationCalendarId;
    // Provider calendar IDs and event IDs are validated server-side against the signed-in user.
    const externalCalendar = outlookCalendars.find(
      (calendar) => calendar.id === targetCalendarId
    );
    if (targetCalendarId && !externalCalendar) {
      alert(
        "The selected calendar is no longer available. Refresh and try again."
      );
      return;
    }
    if (
      eventBeingEdited?.provider &&
      (!eventBeingEdited.externalEventId || !externalCalendar)
    ) {
      alert("This external event cannot be edited because its calendar is unavailable.");
      return;
    }

    const eventData = {
      title: title.trim(),
      start: isAllDay
        ? selectedDate
        : new Date(`${selectedDate}T${startTime}:00`).toISOString(),
      end: isAllDay
        ? endDate
        : new Date(`${endDate}T${endTime}:00`).toISOString(),
      allDay: isAllDay,
      color: normalizeEventColor(color),
      ...(externalCalendar
        ? {
            calendarId: externalCalendar.id,
            ...(eventBeingEdited?.externalEventId
              ? { eventId: eventBeingEdited.externalEventId }
              : {}),
          }
        : {}),
    };

    try {
      const endpoint = externalCalendar
        ? `/api/${externalCalendar.provider}/events`
        : editingEventId
          ? `/api/events/${editingEventId}`
          : "/api/events";
      const response = await fetch(
        endpoint,  // Determines the API endpoint based on whether an event is being edited or created.
        {
          method: editingEventId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Save failed (${response.status}): ${errorText}`);
      }

      const savedEvent: CalendarEvent = await response.json();

      if (externalCalendar) {
        setOutlookEvents((previous) =>
          editingEventId
            ? previous.map((event) =>
                event.id === editingEventId ? savedEvent : event
              )
            : [...previous, savedEvent]
        );
      } else {
        setEvents((previous) =>
          editingEventId
            ? previous.map((event) =>
                event.id === editingEventId ? savedEvent : event
              )
            : [...previous, savedEvent]
        );
      }
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving event:", error);
      alert(error instanceof Error ? error.message : "Could not save event");
    }
  };

  //  Deletes the currently selected event from the backend and updates the local state accordingly.
  const deleteEvent = async () => {
    if (!editingEventId) return;

    const eventBeingEdited = [...events, ...outlookEvents].find(
      (event) => event.id === editingEventId
    );

    try {
      const response = eventBeingEdited?.provider
        ? await fetch(`/api/${eventBeingEdited.provider}/events`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              calendarId: eventBeingEdited.calendarId,
              eventId: eventBeingEdited.externalEventId,
            }),
          })
        : await fetch(`/api/events/${editingEventId}`, {
            method: "DELETE",
          });

      if (!response.ok) {
        throw new Error("Failed to delete event");
      }

      setEvents((previous) =>
        previous.filter((event) => event.id !== editingEventId)
      );
      setOutlookEvents((previous) =>
        previous.filter((event) => event.id !== editingEventId)
      );

      setIsOpen(false);
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Could not delete the event. Please try again.");
    }
  };

  // Loads the events from the backend API when the component is first mounted. This ensures that the calendar displays the most up-to-date events.
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await fetch("/api/events");

        if (!response.ok) {
          throw new Error("Failed to load events");
        }

        const savedEvents: CalendarEvent[] = await response.json();
        setEvents(savedEvents);
      } catch (error) {
        console.error("Error loading events:", error);
      }
    };

    loadEvents();
  }, []);

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Catlinder</h1>

        <div className="flex items-center gap-3">
          <CalendarMenu
            calendars={outlookCalendars}
            selectedCalendarIds={selectedCalendarIds}
            calendarColors={calendarColors}
            onToggleCalendar={toggleCalendar}
            onCalendarColorChange={setCalendarColor}
            onSelectAll={() =>
              setSelectedCalendarIds(
                outlookCalendars.map((calendar) => calendar.id)
              )
            }
            onClearAll={() => setSelectedCalendarIds([])}
          />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--card)]"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-5">
        {connectionMessage && (
          <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
            {connectionMessage}
          </p>
        )}
        {calendarError && (
          <p role="alert" className="mb-3 rounded-lg border border-red-400/50 bg-red-500/10 p-3 text-sm text-red-500">
            Calendar events could not be loaded: {calendarError}
          </p>
        )}
        {!calendarError &&
          outlookCalendars.length > 0 &&
          selectedCalendarIds.length === 0 && (
            <p className="mb-3 rounded-lg bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
              No external calendars are selected. Choose calendars from the
              Calendars menu to display their events.
            </p>
          )}
        {!calendarError &&
          selectedCalendarIds.length > 0 &&
          visibleExternalEvents.length === 0 && (
            <p className="mb-3 rounded-lg bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
              No events in this date range for the selected calendars.
            </p>
          )}
        <FullCalendar
          plugins={[
            themePlugin,
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
          ]}
          initialView="dayGridMonth"
          height="auto"
          eventDisplay="block"
          dateClick={(info) => openModal(info.dateStr)}
          eventClick={(info) => {
            editEvent({
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end,
            });
          }}
          datesSet={(info) => {
            loadExternalCalendarEvents(info.start, info.end).catch(
              console.error
            );
          }}
          headerToolbar={{
            left: "prev,today,next",
            center: "title",
            right: "addEvent dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttons={{
            addEvent: {
              text: "Add Event",
              click: () => openModal(getLocalDate()),
            },
          }}
          events={[
            ...events.map((event) => ({
              id: event.id,
              title: event.title,
              start: event.start,
              end: event.end,
              allDay: event.allDay,
              color: normalizeEventColor(event.color),
              backgroundColor: normalizeEventColor(event.color),
              borderColor: normalizeEventColor(event.color),
              textColor: "var(--event-text-color)",
            })),
            ...visibleExternalEvents.map((event) => ({
                id: event.id,
                title: event.title,
                start: event.start,
                end: event.end,
                allDay: event.allDay,
                color: calendarColors[event.calendarId ?? ""] ?? event.color,
                backgroundColor:
                  calendarColors[event.calendarId ?? ""] ?? event.color,
                borderColor:
                  calendarColors[event.calendarId ?? ""] ?? event.color,
                textColor: "var(--event-text-color)",
              })),
          ]}
        />
      </section>

      {isOpen && (
        <EventModal
          calendars={outlookCalendars}
          destinationCalendarId={destinationCalendarId}
          setDestinationCalendarId={setDestinationCalendarId}
          selectedDate={selectedDate}
          endDate={endDate}
          title={title}
          startTime={startTime}
          endTime={endTime}
          color={color}
          setSelectedDate={setSelectedDate}
          setEndDate={setEndDate}
          setTitle={setTitle}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
          setColor={setColor}
          onClose={() => setIsOpen(false)}
          onSave={saveEvent}
          onDelete={deleteEvent}
          isAllDay={isAllDay}
          isExternalEventEditing={Boolean(
            editingEventId &&
              outlookEvents.some((event) => event.id === editingEventId)
          )}
          setIsAllDay={changeAllDay}
          isEditing={editingEventId !== null}
        />
      )}
    </main>
  );
}
