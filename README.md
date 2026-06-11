# EduNote Pro

Application de gestion académique (étudiants, classes, modules, notes, bulletins, classements).  
Stack : React, TanStack, Tailwind, Supabase.

## Installation

**Prérequis** : [Node.js](https://nodejs.org/) LTS (v20+), projet [Supabase](https://supabase.com/).

```bash
cd edunote-pro
npm install
copy .env.example .env   # Linux/macOS : cp .env.example .env
```

Remplissez `.env` avec les clés Supabase (**Project Settings → API**) :

```env
VITE_SUPABASE_URL=https://VOTRE_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_publique
VITE_SUPABASE_PROJECT_ID=VOTRE_ID
```

Ne commitez jamais `.env`. N'y mettez pas la clé `service_role`.

## Base de données

Appliquez les migrations dans `supabase/migrations/` (ordre chronologique des fichiers) :

```bash
npx supabase login
npx supabase link --project-ref VOTRE_ID
npx supabase db push
```

Ou exécutez chaque `.sql` dans le **SQL Editor** Supabase.

## Lancer l'app (VS Code)

1. Ouvrir le dossier `edunote-pro`
2. Terminal intégré (`` Ctrl+` ``) : `npm run dev`
3. Ouvrir l'URL affichée → `/auth`

Après modification de `.env`, redémarrer le serveur (`Ctrl+C` puis `npm run dev`).

| Commande          | Description            |
| ----------------- | ---------------------- |
| `npm run dev`     | Développement          |
| `npm run build`   | Build production       |
| `npm run preview` | Prévisualiser le build |

## Import de données

Accessible à tout utilisateur connecté.

### Import complet

**Années académiques → Import complet** — année, classes, modules, élèves et notes en une fois.

Formats : Excel multi-feuilles (`.xlsx`, `.xls`, `.ods`), JSON, CSV/TXT.

| Feuille Excel | Champs principaux                                                               |
| ------------- | ------------------------------------------------------------------------------- |
| Annee         | `label`, `start_date`, `end_date`, `status`                                     |
| Classes       | `name`, `level`, `description`, `year_label`                                    |
| Modules       | `code`, `name`, `coefficient`, `class_name`, `year_label`                       |
| Eleves        | `matricule`, `first_name`, `last_name`, `gender`, `class_name`, `year_label`, … |
| Notes         | `matricule`, `module_code`, `score`, `session`, `class_name`, `year_label`      |

Téléchargez le modèle depuis le dialogue. Colonnes en français ou anglais.  
Ordre automatique : année → classes → modules → élèves → notes.

### Import élèves seuls

**Étudiants → Importer** — fichier Excel, CSV ou JSON avec au minimum `matricule`, `prénom`, `nom` et `classe` (ou classe par défaut dans le dialogue).

## Compte administrateur

L'email `admin@gmail.com` reçoit le rôle **admin** à l'inscription. Promotion manuelle : **Utilisateurs** (admin).

## Dépannage

| Problème                      | Solution                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Variables Supabase manquantes | Vérifier `.env`, redémarrer `npm run dev`                                                 |
| `ERESOLVE` / `nitro`          | `nitro` en `3.0.260603-beta` dans `package.json`, supprimer `node_modules`, `npm install` |
| Import refusé                 | Être connecté ; migrations appliquées ; classe existante pour l'import élèves             |
| `npm install` réseau          | Réessayer ; `npm install --legacy-peer-deps` en dernier recours                           |
