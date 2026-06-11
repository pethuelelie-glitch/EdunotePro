-- ================================================================
-- CORRECTION : Unicité par propriétaire (owner_id)
-- Au lieu de contraintes globales UNIQUE(matricule) ou UNIQUE(label), 
-- on les remplace par UNIQUE(..., owner_id) pour que chaque utilisateur 
-- puisse avoir ses propres matricules ou années sans conflit.
-- ================================================================

-- 1. Étudiants : Supprimer l'ancienne contrainte globale
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_matricule_key;

-- Ajouter la nouvelle contrainte par utilisateur
ALTER TABLE public.students ADD CONSTRAINT students_matricule_owner_unique UNIQUE (matricule, owner_id);

-- 2. Années Académiques : Supprimer l'ancienne contrainte globale
ALTER TABLE public.academic_years DROP CONSTRAINT IF EXISTS academic_years_label_key;

-- Ajouter la nouvelle contrainte par utilisateur
ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_label_owner_unique UNIQUE (label, owner_id);
