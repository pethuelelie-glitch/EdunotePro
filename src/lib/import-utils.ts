import * as XLSX from "xlsx";

export type ParsedImportRow = Record<string, string | number | null | undefined>;

const HEADER_ALIASES: Record<string, string> = {
  matricule: "matricule",
  id: "matricule",
  code: "code",
  numero: "matricule",
  numéro: "matricule",
  n: "matricule",
  no: "matricule",
  num: "matricule",
  ordre: "matricule",
  first_name: "first_name",
  prenom: "first_name",
  prénom: "first_name",
  prenoms: "first_name",
  firstname: "first_name",
  last_name: "last_name",
  nom: "last_name",
  noms: "last_name",
  name: "last_name",
  eleve: "full_name",
  élève: "full_name",
  eleves: "full_name",
  apprenant: "full_name",
  nom_et_prenom: "full_name",
  nom_prenom: "full_name",
  nom_et_prenoms: "full_name",
  identite: "full_name",
  score: "score",
  note: "score",
  module_code: "module_code",
  gender: "gender",
  sexe: "gender",
  genre: "gender",
  date_of_birth: "date_of_birth",
  date_naissance: "date_of_birth",
  naissance: "date_of_birth",
  dob: "date_of_birth",
  email: "email",
  mail: "email",
  courriel: "email",
  phone: "phone",
  telephone: "phone",
  téléphone: "phone",
  tel: "phone",
  mobile: "phone",
  address: "address",
  adresse: "address",
  class: "class_name",
  classe: "class_name",
  class_name: "class_name",
  nom_classe: "class_name",
};

export function normalizeHeader(raw: string): string {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return HEADER_ALIASES[key] ?? key;
}

export function cellToString(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function normalizeImportRows(rows: ParsedImportRow[]): ParsedImportRow[] {
  return rows.map((row) => {
    const out: ParsedImportRow = {};
    for (const [key, value] of Object.entries(row)) {
      out[normalizeHeader(key)] = value;
    }
    return out;
  });
}

export function parseImportFile(file: File): Promise<ParsedImportRow[]> {
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

        if (ext === "json") {
          const text = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
          const parsed = JSON.parse(text) as unknown;
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          resolve(
            normalizeImportRows(
              arr.map((item) => {
                if (typeof item !== "object" || item === null) return {};
                const row: ParsedImportRow = {};
                for (const [k, v] of Object.entries(item)) {
                  row[k] = cellToString(v);
                }
                return row;
              }),
            ),
          );
          return;
        }

        const workbook =
          ext === "csv" || ext === "txt"
            ? XLSX.read(data as string, { type: "string", raw: false })
            : XLSX.read(data as ArrayBuffer, { type: "array", raw: false, cellDates: true });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error("Aucune feuille trouvée dans le fichier"));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });

        const rows = json.map((row) => {
          const out: ParsedImportRow = {};
          for (const [k, v] of Object.entries(row)) {
            out[k] = cellToString(v);
          }
          return out;
        });

        resolve(normalizeImportRows(rows));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Format de fichier non reconnu"));
      }
    };

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "json" || ext === "csv" || ext === "txt") {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

export function parseGender(raw: string): "M" | "F" | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (["m", "masc", "masculin", "male", "homme", "h"].includes(v)) return "M";
  if (["f", "fem", "féminin", "feminin", "female", "femme"].includes(v)) return "F";
  return null;
}

export function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const fr = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) {
    const [, dd, mm, yyyy] = fr;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
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
  rowIndex: number;
}

function splitFullName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: "—", last_name: "—" };
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function rowHasData(row: ParsedImportRow): boolean {
  return Object.values(row).some((v) => cellToString(v) !== "");
}

export function mapRowsToStudents(
  rows: ParsedImportRow[],
  defaultClassName: string,
): { records: StudentImportRecord[]; errors: string[] } {
  const records: StudentImportRecord[] = [];
  let autoNum = 0;

  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    if (!rowHasData(row)) return;

    const fullName = cellToString(row.full_name);
    let first_name = cellToString(row.first_name);
    let last_name = cellToString(row.last_name);
    if (fullName && !first_name && !last_name) {
      const split = splitFullName(fullName);
      first_name = split.first_name;
      last_name = split.last_name;
    }
    if (!first_name && last_name) first_name = last_name;
    if (!last_name && first_name) last_name = first_name;
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
      gender: parseGender(cellToString(row.gender)),
      date_of_birth: parseDate(cellToString(row.date_of_birth)),
      email: cellToString(row.email) || null,
      phone: cellToString(row.phone) || null,
      address: cellToString(row.address) || null,
      class_name: cellToString(row.class_name) || defaultClassName || "Import",
      rowIndex,
    });
  });

  return { records, errors: [] };
}

export const ACCEPTED_IMPORT_EXTENSIONS = ".csv,.xlsx,.xls,.ods,.json,.txt,.tsv";

export function downloadImportTemplate() {
  const headers = [
    "matricule",
    "first_name",
    "last_name",
    "gender",
    "date_of_birth",
    "email",
    "phone",
    "address",
    "class_name",
  ];
  const sample = [
    ["ETU001", "Jean", "Dupont", "M", "2005-03-15", "jean@exemple.fr", "0700000000", "Abidjan", "L1 Informatique"],
    ["ETU002", "Marie", "Koné", "F", "2006-07-22", "marie@exemple.fr", "0700000001", "Bouaké", "L1 Informatique"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Élèves");
  XLSX.writeFile(wb, "modele_import_eleves.xlsx");
}
