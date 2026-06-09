import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  downloadImportTemplate,
  mapRowsToStudents,
  parseImportFile,
  type StudentImportRecord,
} from "@/lib/import-utils";

interface ClassOption {
  id: string;
  name: string;
  academic_year_id: string;
}

interface StudentImportDialogProps {
  classes: ClassOption[];
}

export function StudentImportDialog({ classes }: StudentImportDialogProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const allRecordsRef = useRef<StudentImportRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [defaultClassId, setDefaultClassId] = useState("");
  const [preview, setPreview] = useState<StudentImportRecord[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [recordCount, setRecordCount] = useState(0);

  const defaultClass = classes.find((c) => c.id === defaultClassId);

  const reset = () => {
    allRecordsRef.current = [];
    setRecordCount(0);
    setPreview([]);
    setParseErrors([]);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const rows = await parseImportFile(file);
      const { records, errors } = mapRowsToStudents(rows, defaultClass?.name ?? "Import");
      allRecordsRef.current = records;
      setRecordCount(records.length);
      setPreview(records.slice(0, 10));
      setParseErrors(errors);
      if (!records.length) {
        toast.error(errors[0] ?? "Aucune donnée à importer");
      } else {
        toast.success(`${records.length} élève(s) détecté(s)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de lecture");
      reset();
    }
  };

  const classCache = new Map<string, { id: string; academic_year_id: string }>();

  const ensureClass = async (className: string): Promise<{ id: string; academic_year_id: string } | null> => {
    const key = className.trim().toLowerCase();
    const cached = classCache.get(key);
    if (cached) return cached;

    const match = classes.find((c) => c.name.trim().toLowerCase() === key);
    if (match) {
      const entry = { id: match.id, academic_year_id: match.academic_year_id };
      classCache.set(key, entry);
      return entry;
    }

    let yearId = defaultClass?.academic_year_id;
    if (!yearId) {
      const { data: year } = await supabase
        .from("academic_years")
        .select("id")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      yearId = year?.id;
    }
    if (!yearId) return null;

    const { data, error } = await supabase
      .from("classes")
      .insert({ name: className, academic_year_id: yearId })
      .select("id, academic_year_id")
      .single();
    if (error || !data) return null;
    const entry = { id: data.id, academic_year_id: data.academic_year_id };
    classCache.set(key, entry);
    return entry;
  };

  const runImport = async () => {
    const records = allRecordsRef.current;
    if (!records.length) {
      toast.error("Chargez un fichier valide avant d'importer");
      return;
    }

    setImporting(true);
    let success = 0;
    const failures: string[] = [];

    for (const rec of records) {
      const cls = await ensureClass(rec.class_name);
      if (!cls) {
        failures.push(`Ligne ${rec.rowIndex} : impossible de créer la classe « ${rec.class_name} »`);
        continue;
      }

      const { error } = await supabase.from("students").insert({
        matricule: rec.matricule,
        first_name: rec.first_name,
        last_name: rec.last_name,
        gender: rec.gender,
        date_of_birth: rec.date_of_birth,
        email: rec.email,
        phone: rec.phone,
        address: rec.address,
        class_id: cls.id,
        academic_year_id: cls.academic_year_id,
      });

      if (error) {
        failures.push(`Ligne ${rec.rowIndex} (${rec.matricule}) : ${error.message}`);
      } else {
        success += 1;
      }
    }

    setImporting(false);

    if (success > 0) {
      toast.success(`${success} élève(s) importé(s)`);
      qc.invalidateQueries({ queryKey: ["students"] });
    }
    if (failures.length) {
      toast.error(`${failures.length} erreur(s) — détails dans la console`);
      console.warn("[Import élèves]", failures);
      setParseErrors((prev) => [...prev, ...failures.slice(0, 5)]);
    }
    if (success > 0 && failures.length === 0) {
      setOpen(false);
      reset();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Importer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des élèves</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Formats : Excel, CSV, JSON. Seuls les champs présents sont importés — matricule et noms
            générés automatiquement si absents.
          </p>
          <Button type="button" variant="link" className="h-auto p-0" onClick={downloadImportTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Télécharger le modèle Excel
          </Button>
        </div>

        <div>
          <Label>Classe par défaut (si absente du fichier)</Label>
          <Select value={defaultClassId} onValueChange={setDefaultClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
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
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {fileName ? fileName : "Choisir un fichier"}
          </Button>
        </div>

        {parseErrors.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive max-h-32 overflow-y-auto">
            {parseErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {preview.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Aperçu (10 premières lignes)</p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Classe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => (
                    <TableRow key={`${r.matricule}-${r.rowIndex}`}>
                      <TableCell className="font-mono text-xs">{r.matricule}</TableCell>
                      <TableCell>{r.last_name}</TableCell>
                      <TableCell>{r.first_name}</TableCell>
                      <TableCell>{r.class_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={runImport} disabled={importing || recordCount === 0}>
            {importing ? "Import en cours…" : "Lancer l'import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
