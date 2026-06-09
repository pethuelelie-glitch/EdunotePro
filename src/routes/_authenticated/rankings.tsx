import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Trophy, FileText } from "lucide-react";
import { mention, mentionColor } from "@/lib/calculations";
import { exportToExcel } from "@/lib/export-utils";
import { GRADE_SESSIONS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/rankings")({
  head: () => ({ meta: [{ title: "Classement — EduNote Pro" }] }),
  component: RankingsPage,
});

function RankingsPage() {
  const [classId, setClassId] = useState("");
  const [session, setSession] = useState<string>(GRADE_SESSIONS[0]);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name")).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["students-class", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("students").select("*").eq("class_id", classId)).data ?? [],
  });
  const { data: modules } = useQuery({
    queryKey: ["modules-class", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("modules").select("id, coefficient").eq("class_id", classId)).data ?? [],
  });
  const { data: grades } = useQuery({
    queryKey: ["grades-class", classId, session, modules?.map((m) => m.id).join(",")],
    enabled: !!modules?.length,
    queryFn: async () => {
      const ids = modules!.map((m) => m.id);
      return (await supabase.from("grades").select("student_id, module_id, score").in("module_id", ids).eq("session", session)).data ?? [];
    },
  });

  const ranking = useMemo(() => {
    if (!students || !modules) return [];
    const coefMap = new Map(modules.map((m) => [m.id, Number(m.coefficient)]));
    const rows = students.map((s) => {
      const sg = grades?.filter((g) => g.student_id === s.id) ?? [];
      const totalCoef = sg.reduce((acc, g) => acc + (coefMap.get(g.module_id) ?? 0), 0);
      const totalPts = sg.reduce((acc, g) => acc + Number(g.score) * (coefMap.get(g.module_id) ?? 0), 0);
      const avg = totalCoef > 0 ? totalPts / totalCoef : 0;
      return { ...s, avg, totalCoef, totalPts };
    });
    rows.sort((a, b) => b.avg - a.avg);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [students, modules, grades]);

  const exportXls = () => {
    const rows = ranking.map((r) => ({
      Rang: r.rank, Matricule: r.matricule, Nom: r.last_name, Prénom: r.first_name,
      Moyenne: r.avg.toFixed(2), Mention: mention(r.avg),
    }));
    exportToExcel(rows, `classement_${classes?.find((c) => c.id === classId)?.name ?? "classe"}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Trophy className="h-7 w-7 text-primary" />Classement</h1>
          <p className="text-muted-foreground mt-1">Moyennes calculées automatiquement</p>
        </div>
        {classId && (
          <Button variant="outline" onClick={exportXls}><FileDown className="h-4 w-4 mr-2" />Exporter Excel</Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Sélectionnez une classe" /></SelectTrigger>
          <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={session} onValueChange={setSession}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GRADE_SESSIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!classId && (
        <p className="text-sm text-muted-foreground">Sélectionnez une classe pour afficher le classement.</p>
      )}

      {classId && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rang</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Étudiant</TableHead>
                <TableHead>Moyenne</TableHead>
                <TableHead>Mention</TableHead>
                <TableHead className="text-right">Bulletin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={r.rank <= 3 ? "default" : "secondary"} className="font-mono">{r.rank}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{r.matricule}</TableCell>
                  <TableCell className="font-medium">{r.last_name} {r.first_name}</TableCell>
                  <TableCell className={`font-semibold ${mentionColor(r.avg)}`}>{r.avg.toFixed(2)}</TableCell>
                  <TableCell className={mentionColor(r.avg)}>{mention(r.avg)}</TableCell>
                  <TableCell className="text-right">
                    <Link to="/bulletin/$studentId" params={{ studentId: r.id }}>
                      <FileText className="h-4 w-4 inline" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {!ranking.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun étudiant</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}