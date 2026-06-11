-- ================================================================
-- ISOLATION DES DONNÉES PAR UTILISATEUR
-- Ajoute owner_id sur toutes les tables de données et met à jour
-- les politiques RLS pour que chaque utilisateur ne voie que ses données.
-- L'admin conserve la visibilité sur toutes les données.
-- ================================================================

-- ── 1. ACADEMIC YEARS ────────────────────────────────────────────
ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Assigner les lignes existantes au premier admin trouvé
UPDATE public.academic_years
SET owner_id = (
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1
)
WHERE owner_id IS NULL;

-- Rendre la colonne obligatoire avec fallback sur auth.uid() pour les futurs inserts
ALTER TABLE public.academic_years ALTER COLUMN owner_id SET NOT NULL;

-- Remplacer les policies SELECT
DROP POLICY IF EXISTS "Years: read all" ON public.academic_years;
CREATE POLICY "Years: read own or admin"
  ON public.academic_years FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

-- Remplacer les policies INSERT
DROP POLICY IF EXISTS "Years: auth insert" ON public.academic_years;
CREATE POLICY "Years: auth insert"
  ON public.academic_years FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Remplacer les policies UPDATE
DROP POLICY IF EXISTS "Years: auth update" ON public.academic_years;
CREATE POLICY "Years: auth update"
  ON public.academic_years FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

-- Remplacer les policies DELETE
DROP POLICY IF EXISTS "Years: auth delete" ON public.academic_years;
CREATE POLICY "Years: auth delete"
  ON public.academic_years FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

-- ── 2. CLASSES ───────────────────────────────────────────────────
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.classes
SET owner_id = (
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1
)
WHERE owner_id IS NULL;

ALTER TABLE public.classes ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS "Classes: read all" ON public.classes;
CREATE POLICY "Classes: read own or admin"
  ON public.classes FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Classes: auth insert" ON public.classes;
CREATE POLICY "Classes: auth insert"
  ON public.classes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Classes: auth update" ON public.classes;
CREATE POLICY "Classes: auth update"
  ON public.classes FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Classes: auth delete" ON public.classes;
CREATE POLICY "Classes: auth delete"
  ON public.classes FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

-- ── 3. MODULES ───────────────────────────────────────────────────
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.modules
SET owner_id = (
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1
)
WHERE owner_id IS NULL;

ALTER TABLE public.modules ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS "Modules: read all" ON public.modules;
CREATE POLICY "Modules: read own or admin"
  ON public.modules FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Modules: auth insert" ON public.modules;
CREATE POLICY "Modules: auth insert"
  ON public.modules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Modules: auth update" ON public.modules;
CREATE POLICY "Modules: auth update"
  ON public.modules FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Modules: auth delete" ON public.modules;
CREATE POLICY "Modules: auth delete"
  ON public.modules FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

-- ── 4. STUDENTS ──────────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.students
SET owner_id = (
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1
)
WHERE owner_id IS NULL;

ALTER TABLE public.students ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS "Students: read all" ON public.students;
CREATE POLICY "Students: read own or admin"
  ON public.students FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Students: auth insert" ON public.students;
CREATE POLICY "Students: auth insert"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Students: auth update" ON public.students;
CREATE POLICY "Students: auth update"
  ON public.students FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Students: auth delete" ON public.students;
CREATE POLICY "Students: auth delete"
  ON public.students FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

-- ── 5. GRADES ────────────────────────────────────────────────────
ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.grades
SET owner_id = (
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1
)
WHERE owner_id IS NULL;

ALTER TABLE public.grades ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS "Grades: read all" ON public.grades;
CREATE POLICY "Grades: read own or admin"
  ON public.grades FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Grades: authenticated insert" ON public.grades;
CREATE POLICY "Grades: auth insert"
  ON public.grades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Grades: authenticated update" ON public.grades;
CREATE POLICY "Grades: auth update"
  ON public.grades FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Grades: admin delete" ON public.grades;
CREATE POLICY "Grades: auth delete"
  ON public.grades FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());
