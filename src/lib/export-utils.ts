import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(rows: Record<string, unknown>[], filename: string, sheetName = "Données") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export interface BulletinData {
  student: { matricule: string; first_name: string; last_name: string };
  className: string;
  yearLabel: string;
  rows: { code: string; name: string; coefficient: number; score: number | null }[];
  average: number;
  totalCoef: number;
  totalPoints: number;
  mention: string;
  rank?: number;
  totalStudents?: number;
}

export function exportBulletinPDF(b: BulletinData) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text("EduNote Pro", 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Bulletin de notes officiel", 14, 25);
  doc.setDrawColor(37, 99, 235);
  doc.line(14, 28, 196, 28);

  doc.setFontSize(10);
  doc.text(`Étudiant : ${b.student.first_name} ${b.student.last_name}`, 14, 38);
  doc.text(`Matricule : ${b.student.matricule}`, 14, 44);
  doc.text(`Classe : ${b.className}`, 120, 38);
  doc.text(`Année : ${b.yearLabel}`, 120, 44);

  autoTable(doc, {
    startY: 52,
    head: [["Code", "Module", "Coefficient", "Note /20", "Points"]],
    body: b.rows.map((r) => [
      r.code,
      r.name,
      r.coefficient.toString(),
      r.score === null ? "—" : r.score.toFixed(2),
      r.score === null ? "—" : (r.score * r.coefficient).toFixed(2),
    ]),
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.text(`Total coefficients : ${b.totalCoef}`, 14, finalY);
  doc.text(`Total points : ${b.totalPoints.toFixed(2)}`, 14, finalY + 6);
  doc.setFontSize(13);
  doc.setTextColor(37, 99, 235);
  doc.text(`Moyenne générale : ${b.average.toFixed(2)} / 20`, 14, finalY + 16);
  doc.text(`Mention : ${b.mention}`, 14, finalY + 24);
  if (b.rank && b.totalStudents) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text(`Rang : ${b.rank} / ${b.totalStudents}`, 120, finalY + 16);
  }

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Signature Responsable pédagogique", 14, 270);
  doc.text("Signature Direction", 140, 270);
  doc.line(14, 268, 80, 268);
  doc.line(140, 268, 196, 268);

  doc.save(`bulletin_${b.student.matricule}.pdf`);
}