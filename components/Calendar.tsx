
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
  title: string;
  start: string;
  end?: string;
};

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
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
    setIsOpen(true);
  };

  const saveEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (endTime <= startTime) {
      return;
    }

    setEvents((previous) => [
      ...previous,
      {
        title,
        start: `${selectedDate}T${startTime}:00`,
        end: `${selectedDate}T${endTime}:00`,
      },
    ]);

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
        selectable={false}
        dateClick={(info) => openModal(info.dateStr)}
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
        />
      )}
    </>
  );
}
