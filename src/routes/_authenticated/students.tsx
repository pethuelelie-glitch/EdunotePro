import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Plus,
  Trash2,
  Search,
  FileDown,
  FileText,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { StudentImportDialog } from "@/components/student-import-dialog";
import { logActivity } from "@/lib/audit";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDebounce } from "@/hooks/use-debounce";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Étudiants — EduNote Pro" }] }),
  component: StudentsPage,
});

const studentSchema = z.object({
  matricule: z.string().min(1, "Le matricule est requis").trim(),
  first_name: z.string().min(1, "Le prénom est requis").trim(),
  last_name: z.string().min(1, "Le nom est requis").trim(),
  gender: z.enum(["M", "F"]),
  date_of_birth: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  class_id: z.string().min(1, "La classe est requise"),
});

type StudentFormValues = z.infer<typeof studentSchema>;

const PAGE_SIZE = 20;

function StudentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 500);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, filterClass]);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      matricule: "",
      first_name: "",
      last_name: "",
      gender: "M",
      date_of_birth: "",
      email: "",
      phone: "",
      address: "",
      class_id: "",
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name, academic_year_id")).data ?? [],
  });

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["students", search, filterClass, page],
    queryFn: async () => {
      let query = supabase.from("students").select("*, classes(name)", { count: "exact" });

      if (filterClass !== "all") {
        query = query.eq("class_id", filterClass);
      }
      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,matricule.ilike.%${search}%`,
        );
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await query.order("last_name").range(from, to);
      if (error) throw error;
      return { data, count: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  const students = studentsData?.data ?? [];
  const totalCount = studentsData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const openEdit = (s: Tables<"students"> & { classes: { name: string } | null }) => {
    setEditId(s.id);
    form.reset({
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
    setOpen(true);
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setEditId(null);
      form.reset();
    }
  };

  const onSubmit = async (data: StudentFormValues) => {
    const cls = classes?.find((c) => c.id === data.class_id);
    if (!cls) return toast.error("Classe introuvable");

    const payload = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      date_of_birth: data.date_of_birth || null,
      academic_year_id: cls.academic_year_id,
    };

    if (editId) {
      const { error } = await supabase.from("students").update(payload).eq("id", editId);
      if (error) return toast.error(error.message);
      await logActivity("update", "student", editId);
      toast.success("Étudiant modifié avec succès");
    } else {
      const { data: inserted, error } = await supabase
        .from("students")
        .insert({ ...payload, owner_id: user?.id })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      await logActivity("create", "student", inserted.id);
      toast.success("Étudiant ajouté avec succès");
    }

    setOpen(false);
    setEditId(null);
    form.reset();
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "student", id);
    toast.success("Étudiant supprimé");
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const exportData = async (fmt: "xlsx" | "csv") => {
    toast.info("Génération de l'export en cours...");
    let query = supabase.from("students").select("*, classes(name)").order("last_name");

    if (filterClass !== "all") {
      query = query.eq("class_id", filterClass);
    }
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,matricule.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) return toast.error("Erreur lors de l'export");

    const rows = (data ?? []).map((s) => ({
      Matricule: s.matricule,
      Nom: s.last_name,
      Prénom: s.first_name,
      Sexe: s.gender,
      Email: s.email,
      Téléphone: s.phone,
      Classe: (s.classes as { name: string } | null)?.name,
    }));

    if (fmt === "xlsx") exportToExcel(rows, "etudiants");
    else exportToCSV(rows, "etudiants");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Étudiants</h1>
          <p className="text-muted-foreground mt-1">{totalCount} étudiant(s) au total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportData("xlsx")}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData("csv")}>
            <FileDown className="h-4 w-4 mr-2" />
            CSV
          </Button>
          {classes && classes.length > 0 && <StudentImportDialog classes={classes} />}

          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editId ? "Modifier l'étudiant" : "Nouvel étudiant"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="matricule"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Matricule</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: MAT-123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sexe</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="M">Masculin</SelectItem>
                              <SelectItem value="F">Féminin</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prénom</FormLabel>
                          <FormControl>
                            <Input placeholder="Prénom" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom</FormLabel>
                          <FormControl>
                            <Input placeholder="Nom" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date de naissance</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Téléphone</FormLabel>
                          <FormControl>
                            <Input placeholder="Téléphone" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="email@exemple.com"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Adresse</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Adresse complète"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="class_id"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Classe</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner une classe" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {classes?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting
                        ? "Enregistrement..."
                        : editId
                          ? "Mettre à jour"
                          : "Ajouter"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (nom, matricule…)"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
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
            {isLoading && students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Chargement des étudiants...
                </TableCell>
              </TableRow>
            ) : students.length > 0 ? (
              students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.matricule}</TableCell>
                  <TableCell className="font-medium">
                    {s.last_name} {s.first_name}
                  </TableCell>
                  <TableCell>{(s.classes as { name: string } | null)?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.email ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Link to="/bulletin/$studentId" params={{ studentId: s.id }}>
                      <Button size="sm" variant="ghost" title="Bulletin">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" title="Modifier" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" title="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer l'étudiant ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Toutes les notes de cet étudiant seront
                            supprimées.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(s.id)}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aucun étudiant trouvé
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Affichage {page * PAGE_SIZE + 1} à {Math.min((page + 1) * PAGE_SIZE, totalCount)} sur{" "}
              {totalCount}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <div className="text-sm font-medium">
                Page {page + 1} sur {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
