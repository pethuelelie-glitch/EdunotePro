import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRADE_SESSIONS } from "@/lib/labels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileDown } from "lucide-react";
import { mention, mentionColor } from "@/lib/calculations";
import { exportBulletinPDF } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/bulletin/$studentId")({
  head: () => ({ meta: [{ title: "Bulletin — EduNote Pro" }] }),
  component: BulletinPage,
});

function BulletinPage() {
  const { studentId } = useParams({ from: "/_authenticated/bulletin/$studentId" });
  const [session, setSession] = useState<string>(GRADE_SESSIONS[0]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["bulletin", studentId, session],
    queryFn: async () => {
      const { data: student } = await supabase.from("students").select("*, classes(*, academic_years(*))").eq("id", studentId).single();
      if (!student) return null;
      const { data: modules } = await supabase.from("modules").select("*").eq("class_id", student.class_id);
      const { data: grades } = await supabase.from("grades").select("*").eq("student_id", studentId).eq("session", session);

      const rows = (modules ?? []).map((m) => {
        const g = grades?.find((x) => x.module_id === m.id);
        return { code: m.code, name: m.name, coefficient: Number(m.coefficient), score: g ? Number(g.score) : null };
      });
      const valid = rows.filter((r) => r.score !== null);
      const totalCoef = valid.reduce((s, r) => s + r.coefficient, 0);
      const totalPoints = valid.reduce((s, r) => s + (r.score as number) * r.coefficient, 0);
      const avg = totalCoef > 0 ? totalPoints / totalCoef : 0;

      // rank
      const { data: classmates } = await supabase.from("students").select("id").eq("class_id", student.class_id);
      const { data: allGrades } = await supabase.from("grades").select("student_id, module_id, score")
        .in("module_id", (modules ?? []).map((m) => m.id)).eq("session", session);
      const coefMap = new Map((modules ?? []).map((m) => [m.id, Number(m.coefficient)]));
      const avgs = (classmates ?? []).map((c) => {
        const sg = (allGrades ?? []).filter((g) => g.student_id === c.id);
        const tc = sg.reduce((s, g) => s + (coefMap.get(g.module_id) ?? 0), 0);
        const tp = sg.reduce((s, g) => s + Number(g.score) * (coefMap.get(g.module_id) ?? 0), 0);
        return { id: c.id, avg: tc > 0 ? tp / tc : 0 };
      }).sort((a, b) => b.avg - a.avg);
      const rank = avgs.findIndex((a) => a.id === studentId) + 1;

      return { student, rows, avg, totalCoef, totalPoints, rank, totalStudents: avgs.length };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Chargement…</div>;
  if (isError || !data?.student) {
    return (
      <div className="space-y-4">
        <Link to="/students"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button></Link>
        <p className="text-muted-foreground">Étudiant introuvable.</p>
      </div>
    );
  }

  const s = data.student;
  const className = (s.classes as { name: string } | null)?.name ?? "";
  const yearLabel = ((s.classes as { academic_years: { label: string } | null } | null)?.academic_years?.label) ?? "";

  const download = () => {
    exportBulletinPDF({
      student: { matricule: s.matricule, first_name: s.first_name, last_name: s.last_name },
      className, yearLabel,
      rows: data.rows, average: data.avg, totalCoef: data.totalCoef, totalPoints: data.totalPoints,
      mention: mention(data.avg), rank: data.rank, totalStudents: data.totalStudents,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/students"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button></Link>
        <div className="flex gap-2 items-center">
          <Select value={session} onValueChange={setSession}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{GRADE_SESSIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={download}><FileDown className="h-4 w-4 mr-2" />Télécharger PDF</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-primary">EduNote Pro</h1>
          <p className="text-sm text-muted-foreground">Bulletin officiel — {yearLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div><span className="text-muted-foreground">Étudiant :</span> <strong>{s.first_name} {s.last_name}</strong></div>
          <div><span className="text-muted-foreground">Classe :</span> <strong>{className}</strong></div>
          <div><span className="text-muted-foreground">Matricule :</span> <strong className="font-mono">{s.matricule}</strong></div>
          <div><span className="text-muted-foreground">Rang :</span> <strong>{data.rank} / {data.totalStudents}</strong></div>
        </div>

        <Table>
          <TableHeader>
            <TableRow><TableHead>Code</TableHead><TableHead>Module</TableHead><TableHead>Coef.</TableHead><TableHead>Note /20</TableHead><TableHead>Points</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.coefficient}</TableCell>
                <TableCell>{r.score === null ? "—" : r.score.toFixed(2)}</TableCell>
                <TableCell>{r.score === null ? "—" : (r.score * r.coefficient).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
          <div><p className="text-xs text-muted-foreground">Total coefficients</p><p className="text-lg font-semibold">{data.totalCoef}</p></div>
          <div><p className="text-xs text-muted-foreground">Total points</p><p className="text-lg font-semibold">{data.totalPoints.toFixed(2)}</p></div>
          <div><p className="text-xs text-muted-foreground">Moyenne générale</p><p className={`text-2xl font-bold ${mentionColor(data.avg)}`}>{data.avg.toFixed(2)} / 20</p></div>
        </div>
        <div className={`mt-3 text-lg font-medium ${mentionColor(data.avg)}`}>Mention : {mention(data.avg)}</div>
      </div>
    </div>
  );
}