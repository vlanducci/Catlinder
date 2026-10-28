"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import themePlugin from "@fullcalendar/react/themes/pulse";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/pulse/theme.css";
import EventModal from "./EventModal";
import ThemeToggle from "./ThemeToggle";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

const defaultColor = "#60a5fa";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
};

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [color, setColor] = useState(defaultColor);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState("");

  const getLocalDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const openModal = (date: string) => {
    setSelectedDate(date.slice(0, 10));
    setEndDate(date.slice(0, 10));
    setTitle("");
    setStartTime("09:00");
    setEndTime("10:00");
    setColor(defaultColor);
    setEditingEventId(null);
    setIsOpen(true);
  };

  const editEvent = (event: {
    id: string;
    title: string;
    start: Date | null;
    end: Date | null;
    color: string;
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
    setColor(event.color || defaultColor);
    setIsOpen(true);
  };

  const saveEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (endDate < selectedDate || (endDate === selectedDate && endTime <= startTime)) {
      return;
    }

    const eventData = {
      title,
      start: `${selectedDate}T${startTime}:00`,
      end: `${endDate}T${endTime}:00`,
      color,
    };

    if (editingEventId) {
      setEvents((previous) =>
        previous.map((event) =>
          event.id === editingEventId ? { ...event, ...eventData } : event
        )
      );
    } else {
      setEvents((previous) => [
        ...previous,
        { id: crypto.randomUUID(), ...eventData },
      ]);
    }

    setIsOpen(false);
  };

  const deleteEvent = () => {
    if (!editingEventId) return;

    setEvents((previous) =>
      previous.filter((event) => event.id !== editingEventId)
    );
    setIsOpen(false);
  };

  useEffect(() => {
    setIsMounted(true);
    setToday(getLocalDate());
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
          eventColor={defaultColor}
          dateClick={(info) => openModal(info.dateStr)}
          eventClick={(info) =>
            editEvent({
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end,
              color: events.find((event) => event.id === info.event.id)?.color || defaultColor,
            })
          }
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
            backgroundColor: event.color,
            borderColor: event.color,
            textColor: "#1e293b",
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