import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileDown, Trophy } from "lucide-react";
import { mention, mentionColor } from "@/lib/calculations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/year-report/$yearId")({
  head: () => ({ meta: [{ title: "Rapport Annuel — EduNote Pro" }] }),
  component: YearReportPage,
});

function YearReportPage() {
  const { yearId } = Route.useParams();

  const { data: year, isLoading: isYearLoading } = useQuery({
    queryKey: ["year", yearId],
    queryFn: async () =>
      (await supabase.from("academic_years").select("*").eq("id", yearId).single()).data,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-year", yearId],
    queryFn: async () =>
      (await supabase.from("classes").select("*").eq("academic_year_id", yearId)).data ?? [],
  });

  const classIds = classes?.map((c) => c.id) ?? [];

  const { data: students } = useQuery({
    queryKey: ["students-year", yearId],
    enabled: classIds.length > 0,
    queryFn: async () =>
      (await supabase.from("students").select("*").in("class_id", classIds)).data ?? [],
  });

  const { data: modules } = useQuery({
    queryKey: ["modules-year", yearId],
    enabled: classIds.length > 0,
    queryFn: async () =>
      (await supabase.from("modules").select("*").in("class_id", classIds)).data ?? [],
  });

  const moduleIds = modules?.map((m) => m.id) ?? [];

  const { data: grades } = useQuery({
    queryKey: ["grades-year", yearId],
    enabled: moduleIds.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("grades")
          .select("student_id, module_id, score, coefficient, session")
          .in("module_id", moduleIds)
      ).data ?? [],
  });

  const reports = useMemo(() => {
    if (!classes || !students || !modules || !grades) return [];

    return classes.map((cls) => {
      const clsStudents = students.filter((s) => s.class_id === cls.id);
      const clsModules = modules.filter((m) => m.class_id === cls.id);
      const moduleCoefMap = new Map(clsModules.map((m) => [m.id, Number(m.coefficient)]));

      const rows = clsStudents.map((s) => {
        const studentGrades = grades.filter((g) => g.student_id === s.id);

        let totalModCoef = 0;
        let totalModPoints = 0;

        for (const m of clsModules) {
          const modGrades = studentGrades.filter((g) => g.module_id === m.id);
          if (modGrades.length > 0) {
            const sumGradeCoef = modGrades.reduce((acc, g) => acc + Number(g.coefficient ?? 1), 0);
            const sumGradePts = modGrades.reduce(
              (acc, g) => acc + Number(g.score) * Number(g.coefficient ?? 1),
              0,
            );
            const modAvg = sumGradeCoef > 0 ? sumGradePts / sumGradeCoef : 0;

            const mCoef = moduleCoefMap.get(m.id) ?? 0;
            totalModCoef += mCoef;
            totalModPoints += modAvg * mCoef;
          }
        }

        const avg = totalModCoef > 0 ? totalModPoints / totalModCoef : 0;
        return { ...s, avg };
      });

      rows.sort((a, b) => b.avg - a.avg);
      const rankedRows = rows.map((r, i) => ({ ...r, rank: i + 1 }));

      return {
        class: cls,
        students: rankedRows,
      };
    });
  }, [classes, students, modules, grades]);

  if (isYearLoading) return <div className="text-muted-foreground p-8">Chargement...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2 print:hidden">
            <Link to="/years">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </Link>
            <Badge variant="outline" className="text-sm">Rapport Annuel</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Année Académique {year?.label}
          </h1>
          <p className="text-muted-foreground mt-1">
            Bilan des résultats de toutes les classes
          </p>
        </div>
        <Button onClick={() => window.print()} className="print:hidden">
          <FileDown className="h-4 w-4 mr-2" />
          Imprimer le rapport
        </Button>
      </div>

      <div className="space-y-10">
        {reports.length === 0 && (
          <p className="text-muted-foreground">Aucune donnée trouvée pour cette année académique.</p>
        )}

        {reports.map((report) => (
          <div key={report.class.id} className="rounded-xl border bg-card overflow-hidden shadow-sm break-inside-avoid">
            <div className="bg-muted/50 p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Classe : {report.class.name} {report.class.level && `(${report.class.level})`}
              </h2>
              <span className="text-sm text-muted-foreground font-medium">
                {report.students.length} étudiant{report.students.length > 1 ? "s" : ""}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rang</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Moyenne</TableHead>
                  <TableHead>Mention</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.students.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant={r.rank <= 3 ? "default" : "secondary"} className="font-mono">
                        {r.rank}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r.matricule}</TableCell>
                    <TableCell className="font-medium">
                      {r.last_name} {r.first_name}
                    </TableCell>
                    <TableCell className={`font-semibold ${mentionColor(r.avg)}`}>
                      {r.avg.toFixed(2)}
                    </TableCell>
                    <TableCell className={mentionColor(r.avg)}>
                      {mention(r.avg)}
                    </TableCell>
                  </TableRow>
                ))}
                {report.students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Aucun étudiant dans cette classe
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
