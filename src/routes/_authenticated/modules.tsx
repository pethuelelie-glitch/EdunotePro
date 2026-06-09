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

export const Route = createFileRoute("/_authenticated/modules")({
  head: () => ({ meta: [{ title: "Modules — EduNote Pro" }] }),
  component: ModulesPage,
});

function ModulesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [coef, setCoef] = useState("1");
  const [classId, setClassId] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name, academic_year_id")).data ?? [],
  });
  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => (await supabase.from("modules").select("*, classes(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    const cls = classes?.find((c) => c.id === classId);
    if (!cls) return toast.error("Sélectionnez une classe");
    const { error } = await supabase.from("modules").insert({
      code, name, coefficient: Number(coef), class_id: classId, academic_year_id: cls.academic_year_id,
    });
    if (error) return toast.error(error.message);
    await logActivity("create", "module", undefined, { code, name });
    toast.success("Module créé");
    setOpen(false); setCode(""); setName(""); setCoef("1"); setClassId("");
    qc.invalidateQueries({ queryKey: ["modules"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce module ?")) return;
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["modules"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modules</h1>
          <p className="text-muted-foreground mt-1">Matières et coefficients</p>
        </div>
        {true && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nouveau module</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer un module</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ALG101" /></div>
                  <div><Label>Coefficient</Label><Input type="number" step="0.5" min="0.5" value={coef} onChange={(e) => setCoef(e.target.value)} /></div>
                </div>
                <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Algorithmique" /></div>
                <div>
                  <Label>Classe</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
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
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Coefficient</TableHead>
              <TableHead>Classe</TableHead>
              {true && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-sm">{m.code}</TableCell>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.coefficient}</TableCell>
                <TableCell>{(m.classes as { name: string } | null)?.name ?? "—"}</TableCell>
                {true && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!modules?.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun module</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}