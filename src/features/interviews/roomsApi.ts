// Module M2.6 — Interview room booking: data-access layer.
// INTERIM: set_interview_room is not in the generated Database types until Lovable
// regenerates types.ts after apply. Loose-cast now; swap after apply.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const db = supabase as unknown as SupabaseClient; // INTERIM: swap after apply

export interface MeetingRoom {
  name: string;
  email: string;
  capacity: number | null;
}

// List the tenant's M365 rooms via the graph-rooms edge function. Empty when M365
// is dormant / unconfigured (the caller just shows no rooms).
export async function listMeetingRooms(): Promise<MeetingRoom[]> {
  try {
    const { data, error } = await db.functions.invoke("graph-rooms", { body: {} });
    if (error) throw error;
    return ((data as { rooms?: MeetingRoom[] })?.rooms ?? []) as MeetingRoom[];
  } catch (err) {
    console.warn("[rooms] list failed (showing none):", err);
    return [];
  }
}

// Attach a chosen room to an interview (before the calendar adapter runs).
export async function setInterviewRoom(
  interviewId: string,
  roomEmail: string | null,
  roomName: string | null,
): Promise<void> {
  const { error } = await db.rpc("set_interview_room", {
    p_interview_id: interviewId,
    p_room_email: roomEmail ?? "",
    p_room_name: roomName ?? "",
  });
  if (error) throw error;
}
