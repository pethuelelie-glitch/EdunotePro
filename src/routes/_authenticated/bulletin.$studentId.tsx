import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileDown } from "lucide-react";
import { mention, mentionColor } from "@/lib/calculations";
import { exportBulletinPDF } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/bulletin/$studentId")({
  head: () => ({ meta: [{ title: "Bulletin — EduNote Pro" }] }),
  component: BulletinPage,
});

function BulletinPage() {
  const { studentId } = useParams({ from: "/_authenticated/bulletin/$studentId" });
  const [sessionFilter, setSessionFilter] = useState<string>("Toutes les évaluations");

  const { data: sessions } = useQuery({
    queryKey: ["student-sessions", studentId],
    queryFn: async () => {
      const { data } = await supabase.from("grades").select("session").eq("student_id", studentId);
      const unique = Array.from(new Set(data?.map((s) => s.session) ?? []));
      return ["Toutes les évaluations", ...unique.sort()];
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["bulletin", studentId, sessionFilter],
    queryFn: async () => {
      const { data: student } = await supabase
        .from("students")
        .select("*, classes(*, academic_years(*))")
        .eq("id", studentId)
        .single();
      if (!student) return null;

      const { data: modules } = await supabase
        .from("modules")
        .select("*")
        .eq("class_id", student.class_id);

      let gradesQuery = supabase.from("grades").select("*").eq("student_id", studentId);
      if (sessionFilter !== "Toutes les évaluations") {
        gradesQuery = gradesQuery.eq("session", sessionFilter);
      }
      const { data: grades } = await gradesQuery;

      const rows = (modules ?? []).map((m) => {
        const moduleGrades = grades?.filter((x) => x.module_id === m.id) ?? [];
        let score = null;
        let details = "";

        if (moduleGrades.length > 0) {
          const totalCoefGrade = moduleGrades.reduce((s, g) => s + Number(g.coefficient ?? 1), 0);
          const totalPointsGrade = moduleGrades.reduce(
            (s, g) => s + Number(g.score) * Number(g.coefficient ?? 1),
            0,
          );
          score = totalCoefGrade > 0 ? totalPointsGrade / totalCoefGrade : 0;
          details = moduleGrades.map((g) => `${g.score} (coef ${g.coefficient ?? 1})`).join(", ");
        }

        return {
          code: m.code,
          name: m.name,
          coefficient: Number(m.coefficient),
          score,
          details,
        };
      });

      const valid = rows.filter((r) => r.score !== null);
      const totalCoef = valid.reduce((s, r) => s + r.coefficient, 0);
      const totalPoints = valid.reduce((s, r) => s + (r.score as number) * r.coefficient, 0);
      const avg = totalCoef > 0 ? totalPoints / totalCoef : 0;

      // Calculate rank
      const { data: classmates } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", student.class_id);

      let allGradesQuery = supabase
        .from("grades")
        .select("student_id, module_id, score, coefficient")
        .in(
          "module_id",
          (modules ?? []).map((m) => m.id),
        );
      if (sessionFilter !== "Toutes les évaluations") {
        allGradesQuery = allGradesQuery.eq("session", sessionFilter);
      }
      const { data: allGrades } = await allGradesQuery;

      const moduleCoefMap = new Map((modules ?? []).map((m) => [m.id, Number(m.coefficient)]));

      const avgs = (classmates ?? [])
        .map((c) => {
          const studentAllGrades = (allGrades ?? []).filter((g) => g.student_id === c.id);

          // Calculate average per module first
          let totalModCoef = 0;
          let totalModPoints = 0;

          for (const m of modules ?? []) {
            const modGrades = studentAllGrades.filter((g) => g.module_id === m.id);
            if (modGrades.length > 0) {
              const sumGradeCoef = modGrades.reduce((s, g) => s + Number(g.coefficient ?? 1), 0);
              const sumGradePts = modGrades.reduce(
                (s, g) => s + Number(g.score) * Number(g.coefficient ?? 1),
                0,
              );
              const modAvg = sumGradeCoef > 0 ? sumGradePts / sumGradeCoef : 0;

              const mCoef = moduleCoefMap.get(m.id) ?? 0;
              totalModCoef += mCoef;
              totalModPoints += modAvg * mCoef;
            }
          }

          return { id: c.id, avg: totalModCoef > 0 ? totalModPoints / totalModCoef : 0 };
        })
        .sort((a, b) => b.avg - a.avg);

      const rank = avgs.findIndex((a) => a.id === studentId) + 1;

      return { student, rows, avg, totalCoef, totalPoints, rank, totalStudents: avgs.length };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Chargement…</div>;
  if (isError || !data?.student) {
    return (
      <div className="space-y-4">
        <Link to="/students">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <p className="text-muted-foreground">Étudiant introuvable.</p>
      </div>
    );
  }

  const s = data.student;
  const className = (s.classes as { name: string } | null)?.name ?? "";
  const yearLabel =
    (s.classes as { academic_years: { label: string } | null } | null)?.academic_years?.label ?? "";

  const download = () => {
    exportBulletinPDF({
      student: { matricule: s.matricule, first_name: s.first_name, last_name: s.last_name },
      className,
      yearLabel,
      rows: data.rows,
      average: data.avg,
      totalCoef: data.totalCoef,
      totalPoints: data.totalPoints,
      mention: mention(data.avg),
      rank: data.rank,
      totalStudents: data.totalStudents,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/students">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div className="flex gap-2 items-center">
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sessions?.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={download}>
            <FileDown className="h-4 w-4 mr-2" />
            Télécharger PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-primary">EduNote Pro</h1>
          <p className="text-sm text-muted-foreground">Bulletin officiel — {yearLabel}</p>
          <p className="text-sm font-medium mt-1">{sessionFilter}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
          <div>
            <span className="text-muted-foreground">Étudiant :</span> <br />
            <strong>
              {s.first_name} {s.last_name}
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground">Classe :</span> <br />
            <strong>{className}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Matricule :</span> <br />
            <strong className="font-mono">{s.matricule}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Rang :</span> <br />
            <strong>
              {data.rank} / {data.totalStudents}
            </strong>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Module</TableHead>
              {sessionFilter === "Toutes les évaluations" && (
                <TableHead>Détail des notes (coef)</TableHead>
              )}
              <TableHead>Coef. Module</TableHead>
              <TableHead>Moy. /20</TableHead>
              <TableHead>Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                {sessionFilter === "Toutes les évaluations" && (
                  <TableCell className="text-xs text-muted-foreground">
                    {r.details || "—"}
                  </TableCell>
                )}
                <TableCell>{r.coefficient}</TableCell>
                <TableCell className="font-semibold">
                  {r.score === null ? "—" : r.score.toFixed(2)}
                </TableCell>
                <TableCell>
                  {r.score === null ? "—" : (r.score * r.coefficient).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total coefficients</p>
            <p className="text-lg font-semibold">{data.totalCoef}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total points</p>
            <p className="text-lg font-semibold">{data.totalPoints.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Moyenne générale</p>
            <p className={`text-3xl font-bold ${mentionColor(data.avg)}`}>
              {data.avg.toFixed(2)} / 20
            </p>
          </div>
        </div>
        <div className={`mt-3 text-lg font-medium ${mentionColor(data.avg)}`}>
          Mention : {mention(data.avg)}
        </div>
      </div>
    </div>
  );
}
