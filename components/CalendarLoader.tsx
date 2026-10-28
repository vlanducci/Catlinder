
// 

"use client";

import dynamic from "next/dynamic";

const Calendar = dynamic(() => import("./Calendar"), {
  ssr: false,
  loading: () => <p>Loading calendar...</p>,
});

export default function CalendarLoader() {
  return <Calendar />;
}
