"use client";

// Shared event form for creating and editing local or connected-calendar events.
export const eventColorVariables = [
  "--event-color-01",
  "--event-color-02",
  "--event-color-03",
  "--event-color-04",
];

type EventModalProps = {
  calendars: {
    id: string;
    name: string;
    accountName: string;
    provider: "google" | "outlook";
  }[];
  destinationCalendarId: string;
  setDestinationCalendarId: (value: string) => void;
  selectedDate: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  isAllDay: boolean;
  isExternalEventEditing: boolean;
  endDate: string;
  setSelectedDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setTitle: (value: string) => void;
  setStartTime: (value: string) => void;
  setEndTime: (value: string) => void;
  setColor: (value: string) => void;
  setIsAllDay: (value: boolean) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  isEditing: boolean;
};

export default function EventModal({
  calendars,
  destinationCalendarId,
  setDestinationCalendarId,
  selectedDate,
  endDate,
  title,
  startTime,
  endTime,
  color,
  isAllDay,
  isExternalEventEditing,
  setSelectedDate,
  setEndDate,
  setTitle,
  setStartTime,
  setEndTime,
  setColor,
  setIsAllDay,
  onClose,
  onSave,
  onDelete,
  isEditing,
}: EventModalProps) {
  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]";

  const secondaryButtonClass =
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--foreground)] transition hover:opacity-80";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={onSave}
        className="w-full max-w-md space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {isEditing ? "Edit event" : "New event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close event form"
            className="rounded-lg px-2 text-2xl text-[var(--muted)] transition hover:bg-[var(--background)]"
          >
            ×
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Event title</span>
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Enter event title"
          />
        </label>

        {!isEditing && (
          <label className="block space-y-1">
            <span className="text-sm font-medium">Add to calendar</span>
            <select
              value={destinationCalendarId}
              onChange={(event) =>
                setDestinationCalendarId(event.target.value)
              }
              className={inputClass}
            >
              <option value="">Catlinder</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name} — {calendar.accountName}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* All-day events use date-only values and do not require time fields. */}
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={isAllDay}
            onChange={(event) => setIsAllDay(event.target.checked)}
            className="accent-[var(--accent)]"
          />
          All-day event
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Date</span>
          <input
            required
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">End date</span>
          {isAllDay && (
            <span className="block text-xs text-[var(--muted)]">
              All-day event end dates are exclusive.
            </span>
          )}
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </label>

        {!isAllDay && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Start time</span>
              <input
                required
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">End time</span>
              <input
                required
                type="time"
                min={startTime}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        )}

        {/* External providers own event colours, so only local events expose this picker. */}
        {!isExternalEventEditing && (!destinationCalendarId || isEditing) && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Event colour</legend>
            <div className="flex items-center gap-3">
              {eventColorVariables.map((eventColor, index) => (
                <button
                  key={eventColor}
                  type="button"
                  aria-label={`Use event colour ${index + 1}`}
                  aria-pressed={color === `var(${eventColor})`}
                  onClick={() => setColor(`var(${eventColor})`)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    color === `var(${eventColor})`
                      ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: `var(${eventColor})` }}
                >
                  {color === `var(${eventColor})` && (
                    <span className="font-bold text-slate-900">✓</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex items-center justify-between gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-red-400/50 px-4 py-2 text-red-500 transition hover:bg-red-500/10"
            >
              Delete
            </button>
          )}

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white transition hover:opacity-80"
            >
              {isEditing ? "Save changes" : "Create event"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}