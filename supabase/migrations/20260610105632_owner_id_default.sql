-- ================================================================
-- CORRECTION : Ajouter DEFAULT auth.uid() sur toutes les colonnes owner_id
-- Cela permet à PostgreSQL de définir automatiquement owner_id
-- à partir du JWT de l'utilisateur authentifié, sans dépendre du client.
-- ================================================================

ALTER TABLE public.academic_years ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.classes        ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.modules        ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.students       ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.grades         ALTER COLUMN owner_id SET DEFAULT auth.uid();
