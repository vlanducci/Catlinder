
"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import themePlugin from "@fullcalendar/react/themes/pulse";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/pulse/theme.css";

export default function Calendar() {
  const [events, setEvents] = useState<{ title: string; date: string }[]>([]);

  return (
    <FullCalendar
      plugins={[themePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      height="auto"
      events={events}

      dateClick={(arg) => {
        setEvents((previousEvents) => [
          ...previousEvents,
          { title: "New Event", date: arg.dateStr },
        ]);
      }}

      headerToolbar={{
        left: "prev,today,next",
        center: "title",
        right: "addEvent dayGridMonth,timeGridWeek,timeGridDay",
      }}

      buttons={{
        addEvent: {
          text: "Add Event",
          click: () => {
            setEvents((previousEvents) => [
              ...previousEvents,
              {
                title: "New Event",
                date: new Date().toLocaleDateString("en-CA"),
              },
            ]);
          },
        },
      }}

    />
  );
}
