-- Performance fix: advisor auth_rls_initplan
-- Reescribe todas las RLS policies en public schema reemplazando llamadas crudas
-- a auth.uid() / auth.role() / auth.jwt() por la forma envuelta (SELECT ...).
-- Esto convierte la evaluacion de O(n) por fila en initplan O(1) por query.
--
-- El DO block protege las formas ya envueltas con placeholders antes de hacer
-- el replace, asi no se duplica el wrap.

DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  old_qual text;
  old_check text;
  cmd text;
BEGIN
  FOR pol IN
    SELECT
      p.polname,
      n.nspname AS schemaname,
      c.relname AS tablename,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    old_qual := pol.qual;
    old_check := pol.check_;
    new_qual := pol.qual;
    new_check := pol.check_;

    IF new_qual IS NOT NULL THEN
      new_qual := REPLACE(new_qual, '( SELECT auth.uid() AS uid)', '@@U1@@');
      new_qual := REPLACE(new_qual, '(SELECT auth.uid())', '@@U2@@');
      new_qual := REPLACE(new_qual, '( SELECT auth.role() AS role)', '@@R1@@');
      new_qual := REPLACE(new_qual, '(SELECT auth.role())', '@@R2@@');
      new_qual := REPLACE(new_qual, '( SELECT auth.jwt() AS jwt)', '@@J1@@');
      new_qual := REPLACE(new_qual, '(SELECT auth.jwt())', '@@J2@@');
      new_qual := REPLACE(new_qual, 'auth.uid()', '(SELECT auth.uid())');
      new_qual := REPLACE(new_qual, 'auth.role()', '(SELECT auth.role())');
      new_qual := REPLACE(new_qual, 'auth.jwt()', '(SELECT auth.jwt())');
      new_qual := REPLACE(new_qual, '@@U1@@', '( SELECT auth.uid() AS uid)');
      new_qual := REPLACE(new_qual, '@@U2@@', '(SELECT auth.uid())');
      new_qual := REPLACE(new_qual, '@@R1@@', '( SELECT auth.role() AS role)');
      new_qual := REPLACE(new_qual, '@@R2@@', '(SELECT auth.role())');
      new_qual := REPLACE(new_qual, '@@J1@@', '( SELECT auth.jwt() AS jwt)');
      new_qual := REPLACE(new_qual, '@@J2@@', '(SELECT auth.jwt())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := REPLACE(new_check, '( SELECT auth.uid() AS uid)', '@@U1@@');
      new_check := REPLACE(new_check, '(SELECT auth.uid())', '@@U2@@');
      new_check := REPLACE(new_check, '( SELECT auth.role() AS role)', '@@R1@@');
      new_check := REPLACE(new_check, '(SELECT auth.role())', '@@R2@@');
      new_check := REPLACE(new_check, '( SELECT auth.jwt() AS jwt)', '@@J1@@');
      new_check := REPLACE(new_check, '(SELECT auth.jwt())', '@@J2@@');
      new_check := REPLACE(new_check, 'auth.uid()', '(SELECT auth.uid())');
      new_check := REPLACE(new_check, 'auth.role()', '(SELECT auth.role())');
      new_check := REPLACE(new_check, 'auth.jwt()', '(SELECT auth.jwt())');
      new_check := REPLACE(new_check, '@@U1@@', '( SELECT auth.uid() AS uid)');
      new_check := REPLACE(new_check, '@@U2@@', '(SELECT auth.uid())');
      new_check := REPLACE(new_check, '@@R1@@', '( SELECT auth.role() AS role)');
      new_check := REPLACE(new_check, '@@R2@@', '(SELECT auth.role())');
      new_check := REPLACE(new_check, '@@J1@@', '( SELECT auth.jwt() AS jwt)');
      new_check := REPLACE(new_check, '@@J2@@', '(SELECT auth.jwt())');
    END IF;

    IF (new_qual IS DISTINCT FROM old_qual) OR (new_check IS DISTINCT FROM old_check) THEN
      cmd := format('ALTER POLICY %I ON %I.%I', pol.polname, pol.schemaname, pol.tablename);
      IF new_qual IS NOT NULL THEN
        cmd := cmd || format(' USING (%s)', new_qual);
      END IF;
      IF new_check IS NOT NULL THEN
        cmd := cmd || format(' WITH CHECK (%s)', new_check);
      END IF;
      RAISE NOTICE 'Wrapping auth in policy %.%: %', pol.schemaname, pol.polname, pol.tablename;
      EXECUTE cmd;
    END IF;
  END LOOP;
END $$;
