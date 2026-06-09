import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Database } from "lucide-react";
import { toast } from "sonner";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  downloadFullImportTemplate,
  executeAcademicImport,
  parseAcademicImportFile,
  type AcademicImportPayload,
  type AcademicImportPreview,
} from "@/lib/academic-import-utils";

interface YearOption {
  id: string;
  label: string;
}

interface AcademicImportDialogProps {
  years: YearOption[];
}

const EMPTY: AcademicImportPayload = { year: null, classes: [], modules: [], students: [], grades: [] };

export function AcademicImportDialog({ years }: AcademicImportDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [targetYearLabel, setTargetYearLabel] = useState("");
  const [preview, setPreview] = useState<AcademicImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setPreview(null);
    setFileName("");
    setTargetYearLabel("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const result = await parseAcademicImportFile(file, targetYearLabel);
      setPreview(result);
      if (result.year?.label) setTargetYearLabel(result.year.label);
      const total =
        (result.year ? 1 : 0) +
        result.classes.length +
        result.modules.length +
        result.students.length +
        result.grades.length;
      if (!total) toast.error("Aucune donnée reconnue dans le fichier");
      else toast.success(`${total} enregistrement(s) détecté(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de lecture");
      reset();
    }
  };

  const runImport = async () => {
    if (!preview) return toast.error("Chargez un fichier d'abord");
    const yearLabel = preview.year?.label || targetYearLabel;
    if (!yearLabel) return toast.error("Sélectionnez ou définissez une année académique");

    setImporting(true);
    const result = await executeAcademicImport(supabase, preview, {
      targetYearLabel: yearLabel,
      userId: user?.id,
    });
    setImporting(false);

    const { created } = result;
    const imported =
      created.years + created.classes + created.modules + created.students + created.grades;

    if (imported > 0) {
      toast.success(
        `Import terminé : ${created.years} année, ${created.classes} classes, ${created.modules} modules, ${created.students} élèves, ${created.grades} notes`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["academic_years"] }),
        qc.invalidateQueries({ queryKey: ["classes"] }),
        qc.invalidateQueries({ queryKey: ["modules"] }),
        qc.invalidateQueries({ queryKey: ["students"] }),
        qc.invalidateQueries({ queryKey: ["grades"] }),
      ]);
    }

    if (result.errors.length) {
      toast.error(`${result.errors.length} erreur(s) — voir la console`);
      console.warn("[Import académique]", result.errors);
      setPreview((p) => (p ? { ...p, errors: [...p.errors, ...result.errors.slice(0, 8)] } : p));
    }

    if (imported > 0 && result.errors.length === 0) {
      setOpen(false);
      reset();
    }
  };

  const data = preview ?? { ...EMPTY, errors: [], sheetNames: [] };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Database className="h-4 w-4 mr-2" />
          Import complet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer une année complète</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Importez <strong>toute une année scolaire</strong> : année, classes, modules, élèves et notes.
            Formats : Excel multi-feuilles (.xlsx, .xls, .ods), CSV, JSON.
          </p>
          <p className="text-xs">
            Chaque feuille peut représenter une classe (ex. Primaire, Secondaire). Seuls les champs présents
            sont importés — les colonnes manquantes sont ignorées.
          </p>
          <Button type="button" variant="link" className="h-auto p-0" onClick={downloadFullImportTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Télécharger le modèle Excel complet
          </Button>
        </div>

        <div>
          <Label>Année cible (si absente du fichier)</Label>
          <Select
            value={targetYearLabel}
            onValueChange={async (v) => {
              setTargetYearLabel(v);
              if (inputRef.current?.files?.[0]) {
                const result = await parseAcademicImportFile(inputRef.current.files[0], v);
                setPreview(result);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une année existante ou importer depuis le fichier" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.label}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMPORT_EXTENSIONS}
            className="hidden"
            onChange={onFileChange}
          />
          <Button type="button" variant="secondary" className="w-full" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {fileName || "Choisir un fichier"}
          </Button>
        </div>

        {preview && (
          <div className="space-y-3">
            {preview.sheetNames.length > 0 && (
              <p className="text-xs text-muted-foreground">Feuilles détectées : {preview.sheetNames.join(", ")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {preview.year && <Badge variant="default">Année : {preview.year.label}</Badge>}
              <Badge variant="secondary">{data.classes.length} classe(s)</Badge>
              <Badge variant="secondary">{data.modules.length} module(s)</Badge>
              <Badge variant="secondary">{data.students.length} élève(s)</Badge>
              <Badge variant="secondary">{data.grades.length} note(s)</Badge>
            </div>
          </div>
        )}

        {preview?.errors.length ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive max-h-36 overflow-y-auto">
            {preview.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={runImport} disabled={importing || !preview}>
            {importing ? "Import en cours…" : "Lancer l'import complet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
