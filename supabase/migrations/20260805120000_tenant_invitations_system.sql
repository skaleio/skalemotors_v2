-- ============================================================================
-- Tabla y RPC para invitaciones de equipo por tenant
-- Permite que admins inviten miembros a su tenant desde onboarding o settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'vendedor',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant ON public.tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON public.tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON public.tenant_invitations(token);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_invitations_select ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe', 'gerente')
  );

CREATE POLICY tenant_invitations_insert ON public.tenant_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  );

CREATE POLICY tenant_invitations_update ON public.tenant_invitations
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  );

CREATE POLICY tenant_restrict_invitations ON public.tenant_invitations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

-- ============================================================================
-- RPC: invite_team_member
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'vendedor'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_branch_id UUID;
  v_user_role TEXT;
  v_invitation_id UUID;
  v_token UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT tenant_id, branch_id, role INTO v_tenant_id, v_branch_id, v_user_role
  FROM public.users WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User has no tenant';
  END IF;

  IF v_user_role NOT IN ('admin', 'jefe_jefe') THEN
    RAISE EXCEPTION 'Insufficient permissions to invite members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenant_invitations
    WHERE tenant_id = v_tenant_id AND LOWER(email) = LOWER(p_email) AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ya existe una invitacion pendiente para este email';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE LOWER(email) = LOWER(p_email) AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Este usuario ya pertenece a tu equipo';
  END IF;

  INSERT INTO public.tenant_invitations (tenant_id, branch_id, invited_by, email, full_name, role)
  VALUES (v_tenant_id, v_branch_id, v_user_id, LOWER(TRIM(p_email)), TRIM(p_full_name), p_role)
  RETURNING id, token INTO v_invitation_id, v_token;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'token', v_token,
    'email', LOWER(TRIM(p_email)),
    'tenant_id', v_tenant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invite_team_member(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_team_member(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- RPC: accept_invitation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invitation RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invitation
  FROM public.tenant_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, expired, or already used';
  END IF;

  UPDATE public.users
  SET tenant_id = v_invitation.tenant_id,
      branch_id = COALESCE(v_invitation.branch_id, branch_id),
      role = v_invitation.role,
      full_name = COALESCE(NULLIF(v_invitation.full_name, ''), full_name),
      onboarding_completed = true,
      updated_at = NOW()
  WHERE id = v_user_id;

  UPDATE public.tenant_invitations
  SET status = 'accepted', updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_invitation.tenant_id,
    'role', v_invitation.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID) TO authenticated;
