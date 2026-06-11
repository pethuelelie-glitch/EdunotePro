-- ================================================================
-- 1. CASCADE DELETE ON OWNER_ID
-- Permet de supprimer toutes les données associées à un utilisateur
-- si celui-ci est supprimé de la base de données (auth.users).
-- ================================================================

ALTER TABLE public.academic_years DROP CONSTRAINT IF EXISTS academic_years_owner_id_fkey;
ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_owner_id_fkey;
ALTER TABLE public.classes ADD CONSTRAINT classes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.modules DROP CONSTRAINT IF EXISTS modules_owner_id_fkey;
ALTER TABLE public.modules ADD CONSTRAINT modules_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_owner_id_fkey;
ALTER TABLE public.students ADD CONSTRAINT students_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_owner_id_fkey;
ALTER TABLE public.grades ADD CONSTRAINT grades_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ================================================================
-- 2. ADMIN DELETE USER FUNCTION
-- Permet à un administrateur de supprimer un utilisateur
-- ================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- ================================================================
-- 3. AJOUT DE COEFFICIENT SUR LES NOTES
-- ================================================================
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS coefficient NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (coefficient > 0);
