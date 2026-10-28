
"use client";

const eventColors = [
  { name: "Red", value: "#f87171", variable: "--event-color-01" },
  { name: "Yellow", value: "#fbbf24", variable: "--event-color-02" },
  { name: "Green", value: "#34d399", variable: "--event-color-03" },
  { name: "Blue", value: "#60a5fa", variable: "--event-color-04" },
];

type EventModalProps = {
  selectedDate: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  endDate: string;
  setSelectedDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setTitle: (value: string) => void;
  setStartTime: (value: string) => void;
  setEndTime: (value: string) => void;
  setColor: (value: string) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  isEditing: boolean;
};

export default function EventModal({
  selectedDate,
  endDate,
  title,
  startTime,
  endTime,
  color,
  setSelectedDate,
  setEndDate,
  setTitle,
  setStartTime,
  setEndTime,
  setColor,
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
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </label> 

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

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Event colour</legend>
          <div className="flex items-center gap-3">
            {eventColors.map((eventColor) => (
              <button
                key={eventColor.value}
                type="button"
                title={eventColor.name}
                aria-label={`${eventColor.name} event colour`}
                aria-pressed={color === eventColor.value}
                onClick={() => setColor(eventColor.value)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  color === eventColor.value
                    ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]"
                    : "hover:scale-110"
                }`}
                style={{
                  backgroundColor: `var(${eventColor.variable})`,
                }}
              >
                {color === eventColor.value && (
                  <span className="font-bold text-slate-900">✓</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)]">
            Selected: {eventColors.find((c) => c.value === color)?.name ?? "Custom"}
          </p>
        </fieldset>

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
