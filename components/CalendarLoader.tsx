
"use client";

import dynamic from "next/dynamic";

// The Calendar component is dynamically imported to prevent server-side rendering (SSR) issues, as it relies on browser-specific APIs. The `loading` option provides a fallback UI while the Calendar component is being loaded.
const Calendar = dynamic(() => import("./Calendar"), {
  ssr: false,
  loading: () => <p>Loading calendar...</p>,
});

// The CalendarLoader component serves as a wrapper for the dynamically imported Calendar component. It ensures that the Calendar is only rendered on the client side, avoiding SSR issues.
export default function CalendarLoader() {
  return <Calendar />;
}
