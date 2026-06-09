DROP POLICY IF EXISTS "Profiles: read all authenticated" ON public.profiles;
CREATE POLICY "Profiles: read own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: admin read all" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());