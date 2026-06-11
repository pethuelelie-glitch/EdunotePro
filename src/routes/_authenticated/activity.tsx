import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Journal d'activité — EduNote Pro" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isAdmin) return null;

  const actionColor = (a: string) =>
    a.startsWith("create") ? "default" : a.startsWith("delete") ? "destructive" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Journal d'activité</h1>
          <p className="text-sm text-muted-foreground">
            Surveillance des actions utilisateurs (500 dernières).
          </p>
        </div>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {logs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aucune activité enregistrée.
                </TableCell>
              </TableRow>
            )}
            {logs?.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-sm">{l.user_email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={actionColor(l.action)}>{l.action}</Badge>
                </TableCell>
                <TableCell className="text-sm">{l.entity_type}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground max-w-md truncate">
                  {l.details ? JSON.stringify(l.details) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
