import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  cellToString,
  normalizeHeader,
  normalizeImportRows,
  parseDate,
  parseGender,
  type ParsedImportRow,
} from "@/lib/import-utils";

export { ACCEPTED_IMPORT_EXTENSIONS };

export type YearStatus = Database["public"]["Enums"]["year_status"];

export interface YearImportRecord {
  label: string;
  start_date: string;
  end_date: string;
  status: YearStatus;
}

export interface ClassImportRecord {
  name: string;
  level: string | null;
  description: string | null;
  year_label: string;
  rowIndex: number;
}

export interface ModuleImportRecord {
  code: string;
  name: string;
  coefficient: number;
  class_name: string;
  year_label: string;
  rowIndex: number;
}

export interface StudentImportRecord {
  matricule: string;
  first_name: string;
  last_name: string;
  gender: "M" | "F" | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  class_name: string;
  year_label: string;
  rowIndex: number;
}

export interface GradeImportRecord {
  matricule: string;
  module_code: string;
  score: number;
  session: string;
  coefficient: number;
  class_name: string;
  year_label: string;
  rowIndex: number;
}

export interface AcademicImportPayload {
  year: YearImportRecord | null;
  classes: ClassImportRecord[];
  modules: ModuleImportRecord[];
  students: StudentImportRecord[];
  grades: GradeImportRecord[];
}

export interface AcademicImportPreview extends AcademicImportPayload {
  errors: string[];
  sheetNames: string[];
}

export interface AcademicImportResult {
  yearId: string | null;
  created: { years: number; classes: number; modules: number; students: number; grades: number };
  errors: string[];
}

const SHEET_ALIASES: Record<string, keyof Omit<AcademicImportPayload, "year">> = {
  classes: "classes",
  classe: "classes",
  class: "classes",
  modules: "modules",
  module: "modules",
  matieres: "modules",
  matiere: "modules",
  eleves: "students",
  eleve: "students",
  etudiants: "students",
  etudiant: "students",
  students: "students",
  student: "students",
  notes: "grades",
  note: "grades",
  grades: "grades",
  grade: "grades",
};

const YEAR_SHEET_ALIASES = new Set(["annee", "year", "academic_year", "annee_academique"]);

function normalizeSheetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseYearStatus(raw: string): YearStatus {
  const v = raw.trim().toLowerCase();
  if (["active", "actif", "actuelle", "en_cours"].includes(v)) return "active";
  if (["archived", "archive", "archivee", "archivée", "terminee", "terminée"].includes(v))
    return "archived";
  return "upcoming";
}

function sheetToRows(sheet: XLSX.WorkSheet): ParsedImportRow[] {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const rows = json.map((row) => {
    const out: ParsedImportRow = {};
    for (const [k, v] of Object.entries(row)) out[k] = cellToString(v);
    return out;
  });
  return normalizeImportRows(rows);
}

function rowHasData(row: ParsedImportRow): boolean {
  return Object.values(row).some((v) => cellToString(v) !== "");
}

function splitFullName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "—", last_name: "—" };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function mapYearRow(row: ParsedImportRow, fallbackLabel = ""): YearImportRecord | null {
  const label = cellToString(row.label ?? row.libelle ?? row.annee ?? row.year) || fallbackLabel;
  if (!label) return null;
  const now = new Date();
  const y = now.getFullYear();
  const start_date =
    parseDate(cellToString(row.start_date ?? row.debut ?? row.date_debut ?? row.start)) ??
    `${y}-09-01`;
  const end_date =
    parseDate(cellToString(row.end_date ?? row.fin ?? row.date_fin ?? row.end)) ?? `${y + 1}-06-30`;
  return {
    label,
    start_date,
    end_date,
    status: parseYearStatus(cellToString(row.status ?? row.statut ?? "upcoming")),
  };
}

type InferredEntity = "year" | "classes" | "modules" | "students" | "grades";

function inferEntityFromHeaders(rows: ParsedImportRow[]): InferredEntity | "flat" {
  if (!rows.length) return "students";
  const headers = new Set(Object.keys(rows[0] ?? {}).map((h) => normalizeHeader(h)));

  // Intelligent Flat Detection: If we see mix of Student AND Grade AND Module
  if (
    (headers.has("nom") || headers.has("last_name")) &&
    (headers.has("note") || headers.has("score")) &&
    (headers.has("matiere") || headers.has("module"))
  ) {
    return "flat";
  }

  if (
    (headers.has("score") || headers.has("note")) &&
    (headers.has("matricule") || headers.has("module_code") || headers.has("code"))
  )
    return "grades";
  if (headers.has("coefficient") || headers.has("coef")) return "modules";
  if (headers.has("start_date") || headers.has("debut") || headers.has("end_date")) return "year";
  if (headers.has("level") || headers.has("niveau")) return "classes";
  if (
    headers.has("matricule") ||
    headers.has("first_name") ||
    headers.has("last_name") ||
    headers.has("full_name") ||
    headers.has("nom") ||
    headers.has("prenom")
  )
    return "students";
  return "students";
}

function appendMapped(
  payload: AcademicImportPayload,
  entity: InferredEntity | "flat",
  rows: ParsedImportRow[],
  defaultYear: string,
  sheetClassName: string,
) {
  if (entity === "flat") {
    extractFlatRows(rows, payload, defaultYear);
    return;
  }
  if (entity === "year") {
    payload.year = mapYearRow(rows[0] ?? {}, defaultYear) ?? payload.year;
    return;
  }
  if (entity === "classes") {
    payload.classes.push(...mapClasses(rows, defaultYear).records);
    return;
  }
  if (entity === "modules") {
    payload.modules.push(...mapModules(rows, defaultYear, sheetClassName).records);
    return;
  }
  if (entity === "grades") {
    payload.grades.push(...mapGrades(rows, defaultYear, sheetClassName).records);
    return;
  }
  payload.students.push(...mapStudents(rows, defaultYear, sheetClassName).records);
}

function extractFlatRows(
  rows: ParsedImportRow[],
  payload: AcademicImportPayload,
  defaultYear: string,
) {
  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    if (!rowHasData(row)) return;

    const year_label = cellToString(row.year_label ?? row.annee ?? row.year) || defaultYear;

    // Extract Class
    const class_name = cellToString(row.class_name ?? row.classe ?? row.class);
    if (
      class_name &&
      !payload.classes.some((c) => c.name.toLowerCase() === class_name.toLowerCase())
    ) {
      payload.classes.push({
        name: class_name,
        level: null,
        description: null,
        year_label,
        rowIndex,
      });
    }

    // Extract Module
    const module_name = cellToString(row.module_name ?? row.matiere ?? row.module ?? row.cours);
    let module_code = cellToString(row.module_code ?? row.code);
    if (module_name && !module_code) module_code = slugCode(module_name, rowIndex);

    if (module_code && class_name) {
      if (!payload.modules.some((m) => m.code === module_code && m.class_name === class_name)) {
        payload.modules.push({
          code: module_code,
          name: module_name || module_code,
          coefficient:
            Number(cellToString(row.coefficient ?? row.coef ?? row.coef_matiere ?? "1")) || 1,
          class_name,
          year_label,
          rowIndex,
        });
      }
    }

    // Extract Student
    let first_name = cellToString(row.first_name ?? row.prenom);
    let last_name = cellToString(row.last_name ?? row.nom);
    const fullName = cellToString(row.full_name ?? row.nom_complet);

    if (fullName && !first_name && !last_name) {
      const split = splitFullName(fullName);
      first_name = split.first_name;
      last_name = split.last_name;
    }

    let matricule = cellToString(row.matricule ?? row.id);

    if (last_name || first_name || matricule) {
      if (!first_name) first_name = last_name || "—";
      if (!last_name) last_name = first_name || "—";
      if (!matricule) matricule = `AUTO-${slugCode(first_name + last_name, rowIndex)}`;

      if (!payload.students.some((s) => s.matricule === matricule)) {
        payload.students.push({
          matricule,
          first_name,
          last_name,
          gender: parseGender(cellToString(row.gender ?? row.sexe)),
          date_of_birth: parseDate(cellToString(row.date_of_birth ?? row.date_naissance)),
          email: cellToString(row.email) || null,
          phone: cellToString(row.phone ?? row.telephone) || null,
          address: cellToString(row.address ?? row.adresse) || null,
          class_name: class_name || "Import Global",
          year_label,
          rowIndex,
        });
      }
    }

    // Extract Grade
    const scoreRaw = cellToString(row.score ?? row.note ?? row.valeur);
    if (scoreRaw !== "") {
      const score = Number(scoreRaw);
      if (Number.isFinite(score) && matricule && module_code && class_name) {
        payload.grades.push({
          matricule,
          module_code,
          score: Math.min(20, Math.max(0, score)),
          session: cellToString(row.session ?? row.evaluation ?? row.type_note) || "Évaluation 1",
          coefficient: Number(cellToString(row.grade_coef ?? row.coef_note)) || 1,
          class_name,
          year_label,
          rowIndex,
        });
      }
    }
  });
}

function defaultYearLabel(payload: AcademicImportPayload, fallback?: string): string {
  return (
    payload.year?.label ||
    fallback ||
    payload.classes[0]?.year_label ||
    payload.modules[0]?.year_label ||
    payload.students[0]?.year_label ||
    payload.grades[0]?.year_label ||
    ""
  );
}

function slugCode(text: string, rowIndex: number): string {
  const base = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 8)
    .toUpperCase();
  return base || `M${rowIndex}`;
}

function mapClasses(
  rows: ParsedImportRow[],
  defaultYear: string,
): { records: ClassImportRecord[] } {
  const records: ClassImportRecord[] = [];
  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    if (!rowHasData(row)) return;
    const name = cellToString(row.name ?? row.nom ?? row.class_name ?? row.classe);
    if (!name) return;
    records.push({
      name,
      level: cellToString(row.level ?? row.niveau) || null,
      description: cellToString(row.description ?? row.desc) || null,
      year_label: cellToString(row.year_label ?? row.annee ?? row.year) || defaultYear,
      rowIndex,
    });
  });
  return { records };
}

function mapModules(
  rows: ParsedImportRow[],
  defaultYear: string,
  defaultClass = "",
): { records: ModuleImportRecord[] } {
  const records: ModuleImportRecord[] = [];
  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    if (!rowHasData(row)) return;
    const name = cellToString(row.name ?? row.nom ?? row.module_name);
    let code = cellToString(row.module_code ?? row.code);
    if (!name && !code) return;
    if (!code) code = slugCode(name || `mod${rowIndex}`, rowIndex);
    const coefRaw = cellToString(row.coefficient ?? row.coef ?? "1");
    const coefficient = Number(coefRaw);
    records.push({
      code,
      name: name || code,
      coefficient: Number.isFinite(coefficient) && coefficient > 0 ? coefficient : 1,
      class_name:
        cellToString(row.class_name ?? row.classe ?? row.class) || defaultClass || "Import",
      year_label: cellToString(row.year_label ?? row.annee ?? row.year) || defaultYear,
      rowIndex,
    });
  });
  return { records };
}

function mapStudents(
  rows: ParsedImportRow[],
  defaultYear: string,
  defaultClass = "",
): { records: StudentImportRecord[] } {
  const records: StudentImportRecord[] = [];
  let autoNum = 0;
  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    if (!rowHasData(row)) return;

    const fullName = cellToString(row.full_name);
    let first_name = cellToString(row.first_name ?? row.prenom);
    let last_name = cellToString(row.last_name ?? row.nom);
    if (fullName && !first_name && !last_name) {
      const split = splitFullName(fullName);
      first_name = split.first_name;
      last_name = split.last_name;
    }
    if (!first_name && last_name) first_name = last_name;
    if (!last_name && first_name) last_name = first_name;
    if (!first_name && !last_name) {
      const fallback = Object.values(row)
        .map(cellToString)
        .find((v) => v.length > 1);
      if (!fallback) return;
      const split = splitFullName(fallback);
      first_name = split.first_name;
      last_name = split.last_name;
    }
    if (!first_name) first_name = "—";
    if (!last_name) last_name = "—";

    let matricule = cellToString(row.matricule);
    if (!matricule) {
      autoNum += 1;
      matricule = `AUTO-${String(autoNum).padStart(4, "0")}`;
    }

    records.push({
      matricule,
      first_name,
      last_name,
      gender: parseGender(cellToString(row.gender ?? row.sexe)),
      date_of_birth: parseDate(cellToString(row.date_of_birth ?? row.date_naissance)),
      email: cellToString(row.email) || null,
      phone: cellToString(row.phone ?? row.telephone) || null,
      address: cellToString(row.address ?? row.adresse) || null,
      class_name:
        cellToString(row.class_name ?? row.classe ?? row.class) || defaultClass || "Import",
      year_label: cellToString(row.year_label ?? row.annee ?? row.year) || defaultYear,
      rowIndex,
    });
  });
  return { records };
}

function mapGrades(
  rows: ParsedImportRow[],
  defaultYear: string,
  defaultClass = "",
): { records: GradeImportRecord[] } {
  const records: GradeImportRecord[] = [];
  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    if (!rowHasData(row)) return;
    const scoreRaw = cellToString(row.score ?? row.note);
    const score = Number(scoreRaw);
    if (!Number.isFinite(score)) return;

    const matricule = cellToString(row.matricule) || `AUTO-${String(rowIndex).padStart(4, "0")}`;
    const module_code =
      cellToString(row.module_code ?? row.code ?? row.module) ||
      slugCode(cellToString(row.name ?? row.nom) || "NOTE", rowIndex);

    records.push({
      matricule,
      module_code,
      score: Math.min(20, Math.max(0, score)),
      session: cellToString(row.session ?? row.session_name) || "Évaluation 1",
      coefficient: Number(cellToString(row.grade_coef ?? row.coef_note)) || 1,
      class_name:
        cellToString(row.class_name ?? row.classe ?? row.class) || defaultClass || "Import",
      year_label: cellToString(row.year_label ?? row.annee ?? row.year) || defaultYear,
      rowIndex,
    });
  });
  return { records };
}

function parseJsonPayload(data: unknown): AcademicImportPayload {
  const obj = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  if (!obj || typeof obj !== "object") {
    return { year: null, classes: [], modules: [], students: [], grades: [] };
  }

  const yearObj = obj.year ?? obj.annee ?? obj.academic_year;
  let year: YearImportRecord | null = null;
  if (yearObj && typeof yearObj === "object") {
    const y = normalizeImportRows([yearObj as ParsedImportRow])[0];
    year = mapYearRow(y);
  }

  const defaultYear = year?.label ?? cellToString(obj.year_label ?? obj.annee_label);

  const toRows = (v: unknown): ParsedImportRow[] => {
    if (!Array.isArray(v)) return [];
    return normalizeImportRows(
      v.map((item) => {
        const row: ParsedImportRow = {};
        if (item && typeof item === "object") {
          for (const [k, val] of Object.entries(item)) row[k] = cellToString(val);
        }
        return row;
      }),
    );
  };

  const classes = mapClasses(toRows(obj.classes ?? obj.class), defaultYear);
  const modules = mapModules(toRows(obj.modules ?? obj.module), defaultYear);
  const students = mapStudents(toRows(obj.students ?? obj.eleves ?? obj.etudiants), defaultYear);
  const grades = mapGrades(toRows(obj.grades ?? obj.notes), defaultYear);

  return {
    year,
    classes: classes.records,
    modules: modules.records,
    students: students.records,
    grades: grades.records,
  };
}

export function parseAcademicImportFile(
  file: File,
  fallbackYearLabel = "",
): Promise<AcademicImportPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Fichier vide"));
          return;
        }

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const errors: string[] = [];
        let payload: AcademicImportPayload = {
          year: null,
          classes: [],
          modules: [],
          students: [],
          grades: [],
        };
        let sheetNames: string[] = [];

        if (ext === "json") {
          const text =
            typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
          payload = parseJsonPayload(JSON.parse(text));
          sheetNames = ["JSON"];
        } else {
          const workbook =
            ext === "csv" || ext === "txt" || ext === "tsv"
              ? XLSX.read(data as string, { type: "string", raw: false })
              : XLSX.read(data as ArrayBuffer, { type: "array", raw: false, cellDates: true });

          sheetNames = workbook.SheetNames;

          for (const sheetName of workbook.SheetNames) {
            const key = normalizeSheetName(sheetName);
            const sheet = workbook.Sheets[sheetName];
            const rows = sheetToRows(sheet);
            const sheetClassName = sheetName.trim();
            const provisionalYear = payload.year?.label || fallbackYearLabel;

            if (YEAR_SHEET_ALIASES.has(key)) {
              payload.year = mapYearRow(rows[0] ?? {}, provisionalYear) ?? payload.year;
              continue;
            }

            const knownEntity = SHEET_ALIASES[key];
            if (knownEntity) {
              appendMapped(payload, knownEntity, rows, provisionalYear, sheetClassName);
              continue;
            }

            const inferred = inferEntityFromHeaders(rows);
            appendMapped(payload, inferred, rows, provisionalYear, sheetClassName);
          }

          const classNamesFromSheets = new Set(
            workbook.SheetNames.filter(
              (n) =>
                !YEAR_SHEET_ALIASES.has(normalizeSheetName(n)) &&
                !SHEET_ALIASES[normalizeSheetName(n)],
            ).map((n) => n.trim()),
          );
          const yearForClasses = payload.year?.label || fallbackYearLabel;
          for (const name of classNamesFromSheets) {
            if (!name || payload.classes.some((c) => c.name.toLowerCase() === name.toLowerCase()))
              continue;
            if (payload.students.some((s) => s.class_name.toLowerCase() === name.toLowerCase())) {
              payload.classes.push({
                name,
                level: null,
                description: null,
                year_label: yearForClasses,
                rowIndex: 0,
              });
            }
          }
        }

        if (fallbackYearLabel && !payload.year) {
          payload.year = mapYearRow({}, fallbackYearLabel);
        }

        for (const stu of payload.students) {
          if (!stu.year_label && fallbackYearLabel) stu.year_label = fallbackYearLabel;
        }

        resolve({ ...payload, errors, sheetNames });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Format de fichier non reconnu"));
      }
    };

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "json" || ext === "csv" || ext === "txt" || ext === "tsv") {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

export function downloadFullImportTemplate() {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["label", "start_date", "end_date", "status"],
      ["2025-2026", "2025-09-01", "2026-06-30", "active"],
    ]),
    "Annee",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["name", "level", "description", "year_label"],
      ["L1 Informatique", "L1", "Licence 1", "2025-2026"],
      ["L2 Informatique", "L2", "Licence 2", "2025-2026"],
    ]),
    "Classes",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["code", "name", "coefficient", "class_name", "year_label"],
      ["ALG101", "Algorithmique", 3, "L1 Informatique", "2025-2026"],
      ["BD101", "Bases de données", 2, "L1 Informatique", "2025-2026"],
    ]),
    "Modules",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        "matricule",
        "first_name",
        "last_name",
        "gender",
        "date_of_birth",
        "email",
        "phone",
        "address",
        "class_name",
        "year_label",
      ],
      [
        "ETU001",
        "Jean",
        "Dupont",
        "M",
        "2005-03-15",
        "jean@exemple.fr",
        "0700000000",
        "Abidjan",
        "L1 Informatique",
        "2025-2026",
      ],
      [
        "ETU002",
        "Marie",
        "Koné",
        "F",
        "2006-07-22",
        "marie@exemple.fr",
        "0700000001",
        "Bouaké",
        "L1 Informatique",
        "2025-2026",
      ],
    ]),
    "Eleves",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["matricule", "module_code", "score", "session", "coef_note", "class_name", "year_label"],
      ["ETU001", "ALG101", 14.5, "Devoir 1", 2, "L1 Informatique", "2025-2026"],
      ["ETU001", "BD101", 12, "Interro 1", 1, "L1 Informatique", "2025-2026"],
      ["ETU002", "ALG101", 16, "Devoir 1", 2, "L1 Informatique", "2025-2026"],
    ]),
    "Notes",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["nom", "prenom", "classe", "matiere", "coef_matiere", "evaluation", "coef_note", "note"],
      ["Kouakou", "Marc", "L1 Informatique", "Physique", 3, "Examen", 2, 15],
      ["Kouakou", "Marc", "L1 Informatique", "Physique", 3, "TP", 1, 14],
    ]),
    "Import Intelligent",
  );

  XLSX.writeFile(wb, "modele_import_complet.xlsx");
}

type Supabase = SupabaseClient<Database>;

export async function executeAcademicImport(
  supabase: Supabase,
  payload: AcademicImportPayload,
  options: { targetYearLabel?: string; userId?: string },
): Promise<AcademicImportResult> {
  const errors: string[] = [];
  const created = { years: 0, classes: 0, modules: 0, students: 0, grades: 0 };

  const yearLabel = payload.year?.label || options.targetYearLabel || defaultYearLabel(payload);
  if (!yearLabel) {
    return { yearId: null, created, errors: ["Année académique requise"] };
  }

  let yearId: string | null = null;
  const { data: existingYear } = await supabase
    .from("academic_years")
    .select("id")
    .eq("label", yearLabel)
    .maybeSingle();

  if (existingYear?.id) {
    yearId = existingYear.id;
  } else {
    const yearData = payload.year ?? mapYearRow({}, yearLabel);
    if (!yearData) {
      return { yearId: null, created, errors: ["Année académique requise"] };
    }
    const { data, error } = await supabase
      .from("academic_years")
      .insert({
        label: yearData.label,
        start_date: yearData.start_date,
        end_date: yearData.end_date,
        status: yearData.status,
        owner_id: options.userId,
      })
      .select("id")
      .single();
    if (error) errors.push(`Année : ${error.message}`);
    else {
      yearId = data.id;
      created.years = 1;
    }
  }

  if (!yearId) return { yearId: null, created, errors };

  const classIdByKey = new Map<string, string>();
  const { data: existingClasses } = await supabase
    .from("classes")
    .select("id, name")
    .eq("academic_year_id", yearId);
  existingClasses?.forEach((c) =>
    classIdByKey.set(`${yearLabel}::${c.name.trim().toLowerCase()}`, c.id),
  );

  const matchesYear = (yl: string) => !yl || yl === yearLabel;

  for (const cls of payload.classes) {
    if (!matchesYear(cls.year_label)) continue;
    const key = `${yearLabel}::${cls.name.trim().toLowerCase()}`;
    if (classIdByKey.has(key)) continue;
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: cls.name,
        level: cls.level,
        description: cls.description,
        academic_year_id: yearId,
        owner_id: options.userId,
      })
      .select("id")
      .single();
    if (error) errors.push(`Classe ${cls.name} (l.${cls.rowIndex}) : ${error.message}`);
    else {
      classIdByKey.set(key, data.id);
      created.classes += 1;
    }
  }

  const moduleIdByKey = new Map<string, string>();
  const { data: existingModules } = await supabase
    .from("modules")
    .select("id, code, class_id")
    .eq("academic_year_id", yearId);
  existingModules?.forEach((m) =>
    moduleIdByKey.set(`${m.class_id}::${m.code.toUpperCase()}`, m.id),
  );

  async function ensureClass(className: string): Promise<string | null> {
    const key = `${yearLabel}::${className.trim().toLowerCase()}`;
    const existing = classIdByKey.get(key);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("classes")
      .insert({ name: className, academic_year_id: yearId!, owner_id: options.userId })
      .select("id")
      .single();
    if (error) {
      errors.push(`Classe « ${className} » : ${error.message}`);
      return null;
    }
    classIdByKey.set(key, data.id);
    created.classes += 1;
    return data.id;
  }

  for (const mod of payload.modules) {
    if (!matchesYear(mod.year_label)) continue;
    const classId = await ensureClass(mod.class_name);
    if (!classId) continue;
    const modKey = `${classId}::${mod.code.toUpperCase()}`;
    if (moduleIdByKey.has(modKey)) continue;
    const { data, error } = await supabase
      .from("modules")
      .insert({
        code: mod.code,
        name: mod.name,
        coefficient: mod.coefficient,
        class_id: classId,
        academic_year_id: yearId,
        owner_id: options.userId,
      })
      .select("id")
      .single();
    if (error) errors.push(`Module ${mod.code} (l.${mod.rowIndex}) : ${error.message}`);
    else {
      moduleIdByKey.set(modKey, data.id);
      created.modules += 1;
    }
  }

  const studentIdByMatricule = new Map<string, string>();
  const { data: existingStudents } = await supabase
    .from("students")
    .select("id, matricule")
    .eq("academic_year_id", yearId);
  existingStudents?.forEach((s) => studentIdByMatricule.set(s.matricule, s.id));

  for (const stu of payload.students) {
    if (!matchesYear(stu.year_label)) continue;
    if (studentIdByMatricule.has(stu.matricule)) continue;
    const classId = await ensureClass(stu.class_name);
    if (!classId) continue;
    const { data, error } = await supabase
      .from("students")
      .insert({
        matricule: stu.matricule,
        first_name: stu.first_name,
        last_name: stu.last_name,
        gender: stu.gender,
        date_of_birth: stu.date_of_birth,
        email: stu.email,
        phone: stu.phone,
        address: stu.address,
        class_id: classId,
        academic_year_id: yearId,
        owner_id: options.userId,
      })
      .select("id")
      .single();
    if (error) errors.push(`Élève ${stu.matricule} (l.${stu.rowIndex}) : ${error.message}`);
    else {
      studentIdByMatricule.set(stu.matricule, data.id);
      created.students += 1;
    }
  }

  for (const gr of payload.grades) {
    if (!matchesYear(gr.year_label)) continue;
    const studentId = studentIdByMatricule.get(gr.matricule);
    if (!studentId) continue;
    const classId = await ensureClass(gr.class_name);
    if (!classId) continue;
    const moduleId = moduleIdByKey.get(`${classId}::${gr.module_code.toUpperCase()}`);
    if (!moduleId) {
      errors.push(`Note ${gr.matricule}/${gr.module_code} (l.${gr.rowIndex}) : module introuvable`);
      continue;
    }
    const { error } = await supabase.from("grades").upsert(
      {
        student_id: studentId,
        module_id: moduleId,
        score: gr.score,
        session: gr.session,
        coefficient: gr.coefficient,
        created_by: options.userId ?? null,
        owner_id: options.userId,
      },
      { onConflict: "student_id,module_id,session" },
    );
    if (error)
      errors.push(`Note ${gr.matricule}/${gr.module_code} (l.${gr.rowIndex}) : ${error.message}`);
    else created.grades += 1;
  }

  return { yearId, created, errors };
}
