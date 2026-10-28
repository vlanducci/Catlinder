
"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import themePlugin from "@fullcalendar/react/themes/pulse";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/pulse/theme.css";
import EventModal from "./EventModal";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
};

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getLocalDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const openModal = (date: string) => {
    setSelectedDate(date.slice(0, 10));
    setTitle("");
    setStartTime("09:00");
    setEndTime("10:00");
    setEditingEventId(null);
    setIsOpen(true);
  };

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
    setStartTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
    setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
    setIsOpen(true);
  };

  const saveEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (endTime <= startTime) return;

    const eventData = {
      title,
      start: `${selectedDate}T${startTime}:00`,
      end: `${selectedDate}T${endTime}:00`,
    };

    if (editingEventId) {
      setEvents((previous) =>
        previous.map((event) =>
          event.id === editingEventId
            ? { ...event, ...eventData }
            : event
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

  return (
    <>
      <FullCalendar
        plugins={[
          themePlugin,
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin,
        ]}
        initialView="dayGridMonth"
        height="auto"
        dateClick={(info) => openModal(info.dateStr)}
        eventClick={(info) => editEvent({
          id: info.event.id,
          title: info.event.title,
          start: info.event.start,
          end: info.event.end,
        })}
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
        events={events}
      />

      {isOpen && (
        <EventModal
          selectedDate={selectedDate}
          title={title}
          startTime={startTime}
          endTime={endTime}
          setSelectedDate={setSelectedDate}
          setTitle={setTitle}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
          onClose={() => setIsOpen(false)}
          onSave={saveEvent}
          onDelete={deleteEvent}
          isEditing={editingEventId !== null}
        />
      )}
    </>
  );
}
