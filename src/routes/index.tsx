import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, BookOpen, Trophy, BarChart3, FileDown } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduNote Pro — Plateforme de gestion académique" },
      { name: "description", content: "Gérez étudiants, classes, modules, notes, moyennes et classements en un seul endroit. Moderne, rapide, sécurisé." },
      { property: "og:title", content: "EduNote Pro" },
      { property: "og:description", content: "La plateforme moderne de gestion académique pour établissements scolaires et universitaires." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-semibold text-lg">EduNote Pro</span>
          </div>
          <Link to="/auth">
            <Button>Se connecter</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center rounded-full border bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
              Plateforme éducative nouvelle génération
            </span>
            <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              Gérez votre établissement <span className="text-primary">en toute simplicité</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Étudiants, classes, modules, notes, moyennes, classements et bulletins.
              Tout EduNote Pro réunis dans une interface moderne et sécurisée.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8">Commencer maintenant</Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="h-12 px-8">Tableau de bord</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Users, title: "Gestion des étudiants", desc: "Fichier complet : matricule, classe, contacts." },
              { icon: BookOpen, title: "Modules & coefficients", desc: "Organisez vos matières par classe et par année." },
              { icon: Trophy, title: "Classements automatiques", desc: "Moyennes, rangs et mentions calculés en temps réel." },
              { icon: BarChart3, title: "Tableau de bord", desc: "Statistiques claires sur toute votre activité." },
              { icon: FileDown, title: "Exports & bulletins PDF", desc: "Excel, CSV, PDF. Bulletins officiels en un clic." },
              { icon: GraduationCap, title: "Multi-année", desc: "Archivez et basculez entre années académiques." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6 transition hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 EduNote Pro — Plateforme de gestion académique
      </footer>
    </div>
  );
}
