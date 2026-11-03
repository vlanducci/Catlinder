"use client";

import { useState } from "react";

export type CalendarOption = {
  id: string;
  name: string;
  accountName: string;
  provider: "google" | "outlook";
};

type CalendarMenuProps = {
  calendars: CalendarOption[];
  selectedCalendarIds: string[];
  onToggleCalendar: (calendarId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

export default function CalendarMenu({
  calendars,
  selectedCalendarIds,
  onToggleCalendar,
  onSelectAll,
  onClearAll,
}: CalendarMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:opacity-80"
      >
        Calendars ({selectedCalendarIds.length}/{calendars.length})
      </button>

      {isOpen && (
        <section
          role="dialog"
          aria-label="Manage calendars"
          className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] shadow-xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Manage calendars</h2>
              <p className="text-sm text-[var(--muted)]">
                Add calendars and choose what to display.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close calendar menu"
              className="rounded px-2 text-xl leading-none text-[var(--muted)] hover:bg-[var(--background)]"
            >
              ×
            </button>
          </div>

          <div className="mb-3 flex gap-3 text-sm">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-[var(--accent)] hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="text-[var(--accent)] hover:underline"
            >
              Clear all
            </button>
          </div>

          <form action="/api/outlook/connect" method="get">
            <button
              type="submit"
              className="mb-3 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-80"
            >
              Add Microsoft account
            </button>
          </form>
          <form action="/api/google/connect" method="get">
            <button
              type="submit"
              className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:opacity-80"
            >
              Add Google account
            </button>
          </form>

          {calendars.length === 0 ? (
            <p className="rounded-lg bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
              No Outlook calendars were found.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {calendars.map((calendar) => (
                <li key={calendar.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--background)]">
                    <input
                      type="checkbox"
                      checked={selectedCalendarIds.includes(calendar.id)}
                      onChange={() => onToggleCalendar(calendar.id)}
                      className="accent-[var(--accent)]"
                    />
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          calendar.provider === "google"
                            ? "var(--event-color-google)"
                            : "var(--event-color-outlook)",
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        {calendar.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {calendar.accountName}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
