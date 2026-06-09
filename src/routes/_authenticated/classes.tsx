import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes — EduNote Pro" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [desc, setDesc] = useState("");
  const [yearId, setYearId] = useState("");

  const { data: years } = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => (await supabase.from("academic_years").select("*").order("start_date", { ascending: false })).data ?? [],
  });
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*, academic_years(label)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    if (!yearId) return toast.error("Sélectionnez une année");
    const { error } = await supabase.from("classes").insert({ name, level, description: desc, academic_year_id: yearId });
    if (error) return toast.error(error.message);
    await logActivity("create", "class", undefined, { name });
    toast.success("Classe créée");
    setOpen(false); setName(""); setLevel(""); setDesc(""); setYearId("");
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette classe ?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimée");
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1">Organisez vos promotions</p>
        </div>
        {true && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nouvelle classe</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer une classe</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Licence 1" /></div>
                <div><Label>Niveau</Label><Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="L1" /></div>
                <div><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
                <div>
                  <Label>Année académique</Label>
                  <Select value={yearId} onValueChange={setYearId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {years?.map((y) => <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Année</TableHead>
              <TableHead>Description</TableHead>
              {true && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.level ?? "—"}</TableCell>
                <TableCell>{(c.academic_years as { label: string } | null)?.label ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell>
                {true && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!classes?.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune classe</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}