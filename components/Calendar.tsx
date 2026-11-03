
"use client";

// This component manages the calendar interface, including creating, editing, deleting, loading and displaying calendar events.

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import themePlugin from "@fullcalendar/react/themes/pulse";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/pulse/theme.css";
import EventModal, { eventColors } from "./EventModal";
import ThemeToggle from "./ThemeToggle";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

const defaultEventColor = eventColors[0].value;

// Defines the structure of a calendar event returned by the API.
type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
};

const normalizeEventColor = (color: string) =>
  eventColors.find((eventColor) => eventColor.cssVariable === color)?.value ??
  color;

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);  // Stores the list of events fetched from the API.
  const [selectedDate, setSelectedDate] = useState("");  // Stores the date selected by the user for creating or editing an event.
  const [endDate, setEndDate] = useState("");  // Stores the end date for the event being created or edited.
  const [title, setTitle] = useState("");  // Stores the title of the event being created or edited.
  const [startTime, setStartTime] = useState("09:00");  // Stores the start time for the event being created or edited.
  const [endTime, setEndTime] = useState("10:00");  // Stores the end time for the event being created or edited.
  const [color, setColor] = useState(defaultEventColor);  // Stores the colour for the event being created or edited.
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

  // Opens the event modal for creating a new event, pre-filling the date and resetting other fields.
  const openModal = (date: string) => {
    const dateOnly = date.slice(0, 10);

    setSelectedDate(dateOnly);
    setEndDate(dateOnly);
    setTitle("");
    setStartTime("09:00");
    setEndTime("10:00");
    setColor(defaultEventColor);
    setEditingEventId(null);
    setIsOpen(true);
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

    setEditingEventId(event.id);
    setTitle(event.title);
    setSelectedDate(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    );
    setEndDate(
      `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
    );
    setStartTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
    setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);

    // Finds the saved event in the local state to retrieve its colour.
    const savedEvent = events.find((item) => item.id === event.id);
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
      endDate < selectedDate ||
      (endDate === selectedDate && endTime <= startTime)
    ) {
      return;
    }

    console.log("Selected colour before save:", color);
    // Prepares the event data to be sent to the backend API, including title, start and end times, and colour.
    const eventData = {
      title: title.trim(),
      start: new Date(`${selectedDate}T${startTime}:00`).toISOString(),
      end: new Date(`${endDate}T${endTime}:00`).toISOString(),
      color: normalizeEventColor(color),
    };

    
    // Sends the event data to the backend API, either creating a new event or updating an existing one based on whether an event ID is present.
    try {
      const response = await fetch(
        editingEventId ? `/api/events/${editingEventId}` : "/api/events",  // Determines the API endpoint based on whether an event is being edited or created.
        {
          method: editingEventId ? "PATCH" : "POST",  // Uses PATCH for updating an existing event and POST for creating a new one.
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        }
      );

      // Checks if the response from the server indicates a successful operation. If not, it logs the error and throws an exception.
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Save failed:", response.status, errorText);
        throw new Error(`Save failed (${response.status}): ${errorText}`);
      }

      const savedEvent: CalendarEvent = await response.json();  // Parses the response from the server to get the saved event data.

      // Updates the local state with the newly saved event. If editing, it replaces the existing event; if creating, it adds the new event to the list.
      setEvents((previous) =>
        editingEventId
          ? previous.map((event) =>
              event.id === editingEventId ? savedEvent : event
            )
          : [...previous, savedEvent]
      );
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving event:", error);
      alert(error instanceof Error ? error.message : "Could not save event");
    }
  };

  //  Deletes the currently selected event from the backend and updates the local state accordingly.
  const deleteEvent = async () => {
    if (!editingEventId) return;

    try {
      const response = await fetch(`/api/events/${editingEventId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete event");
      }

      // Updates the local state to remove the deleted event from the list of events.
      setEvents((previous) =>
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
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            color: normalizeEventColor(event.color),
          }))}
        />
      </section>

      {isOpen && (
        <EventModal
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
          isEditing={editingEventId !== null}
        />
      )}
    </main>
  );
}
