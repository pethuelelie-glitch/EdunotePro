import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle2, Archive, BarChart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AcademicImportDialog } from "@/components/academic-import-dialog";
import { yearStatusLabel } from "@/lib/labels";
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

export const Route = createFileRoute("/_authenticated/years")({
  head: () => ({ meta: [{ title: "Années académiques — EduNote Pro" }] }),
  component: YearsPage,
});

const yearSchema = z
  .object({
    label: z.string().min(1, "Le libellé est requis").trim(),
    start_date: z.string().min(1, "La date de début est requise"),
    end_date: z.string().min(1, "La date de fin est requise"),
  })
  .refine((data) => new Date(data.start_date) <= new Date(data.end_date), {
    message: "La date de fin doit être après la date de début",
    path: ["end_date"],
  });

type YearFormValues = z.infer<typeof yearSchema>;

function YearsPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<YearFormValues>({
    resolver: zodResolver(yearSchema),
    defaultValues: {
      label: "",
      start_date: "",
      end_date: "",
    },
  });

  const { data: years } = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (data: YearFormValues) => {
    const { data: inserted, error } = await supabase
      .from("academic_years")
      .insert({ ...data, status: "upcoming", owner_id: user?.id })
      .select("id")
      .single();

    if (error) return toast.error(error.message);

    await logActivity("create", "academic_year", inserted.id, { label: data.label });
    toast.success("Année créée avec succès");

    setOpen(false);
    form.reset();
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
    const { error } = await supabase.from("academic_years").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity("delete", "academic_year", id);
    toast.success("Supprimée");
    qc.invalidateQueries({ queryKey: ["academic_years"] });
  };

  const colSpan = 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Années académiques</h1>
          <p className="text-muted-foreground mt-1">Gérez les cycles scolaires</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AcademicImportDialog years={(years ?? []).map((y) => ({ id: y.id, label: y.label }))} />
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) form.reset();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Nouvelle année
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une année académique</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Libellé</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 2025-2026" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Début</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fin</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </form>
              </Form>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {years?.map((y) => (
              <TableRow key={y.id}>
                <TableCell className="font-medium">{y.label}</TableCell>
                <TableCell>{y.start_date}</TableCell>
                <TableCell>{y.end_date}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      y.status === "active"
                        ? "default"
                        : y.status === "archived"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {yearStatusLabel(y.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {isAdmin && y.status !== "active" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Activer"
                      onClick={() => setStatus(y.id, "active")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && y.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Archiver"
                      onClick={() => setStatus(y.id, "archived")}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  <Link to="/year-report/$yearId" params={{ yearId: y.id }}>
                    <Button size="sm" variant="ghost" title="Voir le rapport">
                      <BarChart className="h-4 w-4 text-primary" />
                    </Button>
                  </Link>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" title="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer l'année académique ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Toutes les classes, modules, étudiants et
                            notes associés seront définitivement supprimés.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(y.id)}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          >
                            Oui, supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
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
