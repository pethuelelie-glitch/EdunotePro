import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, BookOpen, ClipboardList, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — EduNote Pro" }] }),
  component: Dashboard,
});

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [students, classes, modules, grades] = await Promise.all([
        supabase.from("students").select("id, class_id", { count: "exact" }),
        supabase.from("classes").select("id, name", { count: "exact" }),
        supabase.from("modules").select("id", { count: "exact" }),
        supabase.from("grades").select("score, student_id, module_id"),
      ]);

      const allModules = await supabase.from("modules").select("id, coefficient");
      const coefMap = new Map(allModules.data?.map((m) => [m.id, Number(m.coefficient)]) ?? []);

      const byStudent = new Map<string, { pts: number; coef: number }>();
      grades.data?.forEach((g) => {
        const c = coefMap.get(g.module_id) ?? 1;
        const cur = byStudent.get(g.student_id) ?? { pts: 0, coef: 0 };
        cur.pts += Number(g.score) * c;
        cur.coef += c;
        byStudent.set(g.student_id, cur);
      });
      const avgs = [...byStudent.values()].map((v) => (v.coef > 0 ? v.pts / v.coef : 0));
      const globalAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;

      const studentsByClass = new Map<string, number>();
      students.data?.forEach((s) => {
        studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1);
      });
      const chart =
        classes.data?.map((c) => ({
          name: c.name,
          étudiants: studentsByClass.get(c.id) ?? 0,
        })) ?? [];

      return {
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        modules: modules.count ?? 0,
        grades: grades.data?.length ?? 0,
        avg: globalAvg,
        chart,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de votre établissement</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Users}
          label="Étudiants"
          value={data?.students ?? 0}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon={GraduationCap}
          label="Classes"
          value={data?.classes ?? 0}
          color="bg-success/10 text-success"
        />
        <StatCard
          icon={BookOpen}
          label="Modules"
          value={data?.modules ?? 0}
          color="bg-accent text-accent-foreground"
        />
        <StatCard
          icon={ClipboardList}
          label="Notes saisies"
          value={data?.grades ?? 0}
          color="bg-warning/10 text-warning"
        />
        <StatCard
          icon={TrendingUp}
          label="Moyenne générale"
          value={data?.avg != null ? data.avg.toFixed(2) : "0.00"}
          color="bg-primary/10 text-primary"
        />
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-4">Répartition des étudiants par classe</h3>
        <div className="h-72">
          {!data?.chart?.length ? (
            <p className="text-sm text-muted-foreground flex items-center justify-center h-full">
              Aucune classe — créez une année et des classes pour voir le graphique.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="étudiants" fill="oklch(0.58 0.21 260)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
