
-- 1) Ouvrir les écritures à tous les utilisateurs authentifiés (plus seulement admin)
-- Students
DROP POLICY IF EXISTS "Students: admin write" ON public.students;
DROP POLICY IF EXISTS "Students: admin update" ON public.students;
DROP POLICY IF EXISTS "Students: admin delete" ON public.students;
CREATE POLICY "Students: auth insert" ON public.students FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Students: auth update" ON public.students FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Students: auth delete" ON public.students FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Classes
DROP POLICY IF EXISTS "Classes: admin write" ON public.classes;
DROP POLICY IF EXISTS "Classes: admin update" ON public.classes;
DROP POLICY IF EXISTS "Classes: admin delete" ON public.classes;
CREATE POLICY "Classes: auth insert" ON public.classes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Classes: auth update" ON public.classes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Classes: auth delete" ON public.classes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Modules
DROP POLICY IF EXISTS "Modules: admin write" ON public.modules;
DROP POLICY IF EXISTS "Modules: admin update" ON public.modules;
DROP POLICY IF EXISTS "Modules: admin delete" ON public.modules;
CREATE POLICY "Modules: auth insert" ON public.modules FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Modules: auth update" ON public.modules FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Modules: auth delete" ON public.modules FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Academic years
DROP POLICY IF EXISTS "Years: admin write" ON public.academic_years;
DROP POLICY IF EXISTS "Years: admin update" ON public.academic_years;
DROP POLICY IF EXISTS "Years: admin delete" ON public.academic_years;
CREATE POLICY "Years: auth insert" ON public.academic_years FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Years: auth update" ON public.academic_years FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Years: auth delete" ON public.academic_years FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 2) Profiles: admin peut tout voir et modifier n'importe quel profil
DROP POLICY IF EXISTS "Profiles: admin update all" ON public.profiles;
CREATE POLICY "Profiles: admin update all" ON public.profiles FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Permettre à l'admin de supprimer un profil (cascade depuis auth.users gère le reste)
DROP POLICY IF EXISTS "Profiles: admin delete" ON public.profiles;
CREATE POLICY "Profiles: admin delete" ON public.profiles FOR DELETE TO authenticated USING (is_admin());

-- 3) Journal d'activité (audit log) — admin uniquement en lecture, écriture par tout authentifié
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity: admin read all" ON public.activity_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Activity: user read own" ON public.activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Activity: auth insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);

-- 4) Fonction RPC admin pour lister tous les utilisateurs avec leur rôle
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role app_role,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.first_name, p.last_name,
         COALESCE((SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1), 'user'::app_role) AS role,
         p.created_at
  FROM public.profiles p
  WHERE public.is_admin()
  ORDER BY p.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 5) Fonction RPC admin pour changer le rôle d'un utilisateur
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  INSERT INTO public.activity_logs (user_id, user_email, action, entity_type, entity_id, details)
  VALUES (auth.uid(),
          (SELECT email FROM public.profiles WHERE id = auth.uid()),
          'role_change', 'user', _user_id,
          jsonb_build_object('new_role', _role));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;
