import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Save } from "lucide-react";
import { logActivity } from "@/lib/audit";
import { GRADE_SESSIONS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/grades")({
  head: () => ({ meta: [{ title: "Saisie des notes — EduNote Pro" }] }),
  component: GradesPage,
});

function GradesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [session, setSession] = useState("Session 1");
  const [scores, setScores] = useState<Record<string, string>>({});

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name")).data ?? [],
  });
  const { data: modules } = useQuery({
    queryKey: ["modules", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("modules").select("id, code, name").eq("class_id", classId)).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["students-class", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("students").select("id, matricule, first_name, last_name").eq("class_id", classId).order("last_name")).data ?? [],
  });
  const { data: existing } = useQuery({
    queryKey: ["grades", moduleId, session],
    enabled: !!moduleId,
    queryFn: async () => (await supabase.from("grades").select("*").eq("module_id", moduleId).eq("session", session)).data ?? [],
  });

  useEffect(() => {
    const map: Record<string, string> = {};
    existing?.forEach((g) => { map[g.student_id] = String(g.score); });
    setScores(map);
  }, [existing]);

  const saveAll = async () => {
    if (!moduleId) return;
    const rows = Object.entries(scores)
      .filter(([, v]) => v !== "" && !isNaN(Number(v)))
      .map(([student_id, v]) => ({
        student_id, module_id: moduleId, score: Number(v),
        session, created_by: user?.id,
      }));
    if (!rows.length) return toast.error("Aucune note à enregistrer");
    for (const r of rows) {
      if (r.score < 0 || r.score > 20) return toast.error("Notes entre 0 et 20");
    }
    const { error } = await supabase.from("grades").upsert(rows, { onConflict: "student_id,module_id,session" });
    if (error) return toast.error(error.message);
    await logActivity("upsert", "grades", moduleId, { count: rows.length, session });
    toast.success(`${rows.length} note(s) enregistrée(s)`);
    qc.invalidateQueries({ queryKey: ["grades"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saisie des notes</h1>
        <p className="text-muted-foreground mt-1">Saisissez les notes pour une classe et un module</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setModuleId(""); }}>
          <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={moduleId} onValueChange={setModuleId} disabled={!classId}>
          <SelectTrigger><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>{modules?.map((m) => <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={session} onValueChange={setSession}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {GRADE_SESSIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === "Session 2" ? "Session 2 (rattrapage)" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!classId && (
        <p className="text-sm text-muted-foreground">Sélectionnez une classe et un module pour saisir les notes.</p>
      )}

      {moduleId && (
        <>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead className="w-40">Note /20</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.matricule}</TableCell>
                    <TableCell className="font-medium">{s.last_name} {s.first_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number" min="0" max="20" step="0.25"
                        value={scores[s.id] ?? ""}
                        onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!students?.length && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Aucun étudiant dans cette classe</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Button onClick={saveAll}><Save className="h-4 w-4 mr-2" /> Enregistrer toutes les notes</Button>
        </>
      )}
    </div>
  );
}