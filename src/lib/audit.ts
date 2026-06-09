import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("activity_logs").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: (details ?? null) as never,
  });
}