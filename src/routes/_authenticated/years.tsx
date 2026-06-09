import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle2, Archive } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AcademicImportDialog } from "@/components/academic-import-dialog";
import { yearStatusLabel } from "@/lib/labels";
import { logActivity } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/years")({
  head: () => ({ meta: [{ title: "Années académiques — EduNote Pro" }] }),
  component: YearsPage,
});

function YearsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { data: years } = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_years").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = async () => {
    if (!label.trim()) return toast.error("Libellé requis");
    if (!start || !end) return toast.error("Dates de début et fin requises");
    const { data, error } = await supabase
      .from("academic_years")
      .insert({ label: label.trim(), start_date: start, end_date: end, status: "upcoming" })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await logActivity("create", "academic_year", data.id, { label });
    toast.success("Année créée");
    setOpen(false);
    setLabel("");
    setStart("");
    setEnd("");
    qc.invalidateQueries({ queryKey: ["academic_years"] });
  };

  const setStatus = async (id: string, status: "active" | "archived" | "upcoming") => {
    if (status === "active") {
      await supabase.from("academic_years").update({ status: "archived" }).eq("status", "active");
    }
    const { error } = await supabase.from("academic_years").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("update_status", "academic_year", id, { status });
    toast.success("Statut mis à jour");
    qc.invalidateQueries({ queryKey: ["academic_years"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette année ? Tous les éléments associés seront supprimés.")) return;
    const { error } = await supabase.from("academic_years").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "academic_year", id);
    toast.success("Supprimée");
    qc.invalidateQueries({ queryKey: ["academic_years"] });
  };

  const colSpan = isAdmin ? 5 : 4;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Années académiques</h1>
          <p className="text-muted-foreground mt-1">Gérez les cycles scolaires</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AcademicImportDialog years={(years ?? []).map((y) => ({ id: y.id, label: y.label }))} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nouvelle année</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer une année académique</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Libellé</Label><Input placeholder="2025-2026" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Début</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                  <div><Label>Fin</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Statut</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {years?.map((y) => (
              <TableRow key={y.id}>
                <TableCell className="font-medium">{y.label}</TableCell>
                <TableCell>{y.start_date}</TableCell>
                <TableCell>{y.end_date}</TableCell>
                <TableCell>
                  <Badge variant={y.status === "active" ? "default" : y.status === "archived" ? "secondary" : "outline"}>
                    {yearStatusLabel(y.status)}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right space-x-1">
                    {y.status !== "active" && (
                      <Button size="sm" variant="ghost" title="Activer" onClick={() => setStatus(y.id, "active")}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    {y.status !== "archived" && (
                      <Button size="sm" variant="ghost" title="Archiver" onClick={() => setStatus(y.id, "archived")}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" title="Supprimer" onClick={() => remove(y.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!years?.length && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
                  Aucune année — cliquez sur « Nouvelle année » pour commencer
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
