
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.year_status AS ENUM ('active', 'archived', 'upcoming');
CREATE TYPE public.gender AS ENUM ('M', 'F');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles: read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Admin policy on user_roles
CREATE POLICY "Roles: admin all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ AUTO-CREATE PROFILE + ADMIN ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );

  -- Admin auto-promotion
  IF NEW.email = 'admin@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ACADEMIC YEARS ============
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.year_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Years: read all" ON public.academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Years: admin write" ON public.academic_years FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Years: admin update" ON public.academic_years FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Years: admin delete" ON public.academic_years FOR DELETE TO authenticated USING (public.is_admin());

-- ============ CLASSES ============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT,
  description TEXT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classes: read all" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Classes: admin write" ON public.classes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Classes: admin update" ON public.classes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Classes: admin delete" ON public.classes FOR DELETE TO authenticated USING (public.is_admin());

-- ============ MODULES ============
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  coefficient NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (coefficient > 0),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code, class_id, academic_year_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modules: read all" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modules: admin write" ON public.modules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Modules: admin update" ON public.modules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Modules: admin delete" ON public.modules FOR DELETE TO authenticated USING (public.is_admin());

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender public.gender,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  address TEXT,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students: read all" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students: admin write" ON public.students FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Students: admin update" ON public.students FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Students: admin delete" ON public.students FOR DELETE TO authenticated USING (public.is_admin());

-- ============ GRADES ============
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 20),
  session TEXT NOT NULL DEFAULT 'Session 1',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, module_id, session)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Grades: read all" ON public.grades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Grades: authenticated insert" ON public.grades FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Grades: authenticated update" ON public.grades FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Grades: admin delete" ON public.grades FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER grades_touch BEFORE UPDATE ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ INDEXES ============
CREATE INDEX idx_students_class ON public.students(class_id);
CREATE INDEX idx_students_year ON public.students(academic_year_id);
CREATE INDEX idx_modules_class ON public.modules(class_id);
CREATE INDEX idx_grades_student ON public.grades(student_id);
CREATE INDEX idx_grades_module ON public.grades(module_id);
