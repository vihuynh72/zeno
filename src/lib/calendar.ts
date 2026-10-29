export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function getTodayEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Calendar request failed with ${response.status}: ${body.slice(0, 300)}`);
    (error as Error & { status?: number; body?: string }).status = response.status;
    (error as Error & { status?: number; body?: string }).body = body;
    throw error;
  }

  const data = (await response.json()) as { items?: GoogleEvent[] };
  return (data.items ?? []).map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    title: item.summary ?? "Untitled event",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
  }));
}
