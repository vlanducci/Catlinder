
"use client";

type EventModalProps = {
  selectedDate: string;
  title: string;
  startTime: string;
  endTime: string;
  setSelectedDate: (value: string) => void;
  setTitle: (value: string) => void;
  setStartTime: (value: string) => void;
  setEndTime: (value: string) => void;
  onClose: () => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
};

export default function EventModal({
  selectedDate,
  title,
  startTime,
  endTime,
  setSelectedDate,
  setTitle,
  setStartTime,
  setEndTime,
  onClose,
  onSave,
}: EventModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={onSave}
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 text-gray-900 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">New event</h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-500">
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
            className="w-full rounded-lg border border-gray-300 p-2"
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
            className="w-full rounded-lg border border-gray-300 p-2"
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
              className="w-full rounded-lg border border-gray-300 p-2"
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
              className="w-full rounded-lg border border-gray-300 p-2"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
          >
            Save event
          </button>
        </div>
      </form>
    </div>
  );
}
