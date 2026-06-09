import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, FileDown, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { StudentImportDialog } from "@/components/student-import-dialog";
import { logActivity } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Étudiants — EduNote Pro" }] }),
  component: StudentsPage,
});

const emptyForm = {
  matricule: "", first_name: "", last_name: "", gender: "M", date_of_birth: "",
  email: "", phone: "", address: "", class_id: "",
};

function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [form, setForm] = useState(emptyForm);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name, academic_year_id")).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("*, classes(name)").order("last_name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (students ?? []).filter((s) => {
      const matchesText = !q || `${s.first_name} ${s.last_name} ${s.matricule}`.toLowerCase().includes(q);
      const matchesClass = filterClass === "all" || s.class_id === filterClass;
      return matchesText && matchesClass;
    });
  }, [students, search, filterClass]);

  const openEdit = (s: (typeof filtered)[0]) => {
    setEditId(s.id);
    setForm({
      matricule: s.matricule,
      first_name: s.first_name,
      last_name: s.last_name,
      gender: s.gender ?? "M",
      date_of_birth: s.date_of_birth ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      class_id: s.class_id,
    });
  };

  const save = async () => {
    const cls = classes?.find((c) => c.id === form.class_id);
    if (!cls) return toast.error("Sélectionnez une classe");
    if (!form.matricule.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      return toast.error("Matricule, prénom et nom sont requis");
    }

    const payload = {
      matricule: form.matricule.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      gender: form.gender as "M" | "F",
      date_of_birth: form.date_of_birth || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      class_id: cls.id,
      academic_year_id: cls.academic_year_id,
    };

    if (editId) {
      const { error } = await supabase.from("students").update(payload).eq("id", editId);
      if (error) return toast.error(error.message);
      await logActivity("update", "student", editId);
      toast.success("Étudiant modifié");
    } else {
      const { data, error } = await supabase.from("students").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      await logActivity("create", "student", data.id);
      toast.success("Étudiant ajouté");
    }

    setOpen(false);
    setEditId(null);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cet étudiant ?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "student", id);
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const exportData = (fmt: "xlsx" | "csv") => {
    const rows = filtered.map((s) => ({
      Matricule: s.matricule, Nom: s.last_name, Prénom: s.first_name,
      Sexe: s.gender, Email: s.email, Téléphone: s.phone,
      Classe: (s.classes as { name: string } | null)?.name,
    }));
    if (fmt === "xlsx") exportToExcel(rows, "etudiants");
    else exportToCSV(rows, "etudiants");
  };

  const formDialog = (
    <Dialog
      open={open || !!editId}
      onOpenChange={(v) => {
        if (!v) { setOpen(false); setEditId(null); setForm(emptyForm); }
      }}
    >
      {!editId && (
        <DialogTrigger asChild>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Ajouter</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editId ? "Modifier l'étudiant" : "Nouvel étudiant"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Matricule</Label><Input value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} /></div>
          <div>
            <Label>Sexe</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Prénom</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><Label>Nom</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          <div><Label>Date de naissance</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
          <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>Classe</Label>
            <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>{editId ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Étudiants</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} étudiant(s)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportData("xlsx")}><FileDown className="h-4 w-4 mr-2" />Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportData("csv")}><FileDown className="h-4 w-4 mr-2" />CSV</Button>
          {classes && classes.length > 0 && <StudentImportDialog classes={classes} />}
          {formDialog}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher (nom, matricule…)" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom complet</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.matricule}</TableCell>
                <TableCell className="font-medium">{s.last_name} {s.first_name}</TableCell>
                <TableCell>{(s.classes as { name: string } | null)?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.email ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Link to="/bulletin/$studentId" params={{ studentId: s.id }}>
                    <Button size="sm" variant="ghost" title="Bulletin"><FileText className="h-4 w-4" /></Button>
                  </Link>
                  <Button size="sm" variant="ghost" title="Modifier" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Supprimer" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun étudiant</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
