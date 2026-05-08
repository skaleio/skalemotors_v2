#!/usr/bin/env bash
# Elimina un worktree y su branch local, con verificaciones de seguridad.
#
# Uso:
#   bash scripts/cleanup-worktree.sh <nombre-corto>
#
# Ejemplo:
#   bash scripts/cleanup-worktree.sh billing
#
# Verifica:
#   - El worktree existe y NO está en main/master.
#   - Working tree limpio (sin cambios sin commitear).
#   - El branch está mergeado a main (o vía gh: PR en estado MERGED).
#   - Pide confirmación interactiva antes de borrar.

set -euo pipefail

# --- Validación de args ---
if [ "$#" -ne 1 ]; then
  echo "❌ Uso: $0 <nombre-corto>"
  echo "   Ejemplo: $0 billing"
  exit 1
fi

SHORT="$1"
REPO_ROOT="$(git rev-parse --show-toplevel)"
PARENT_DIR="$(dirname "$REPO_ROOT")"
REPO_NAME="$(basename "$REPO_ROOT")"
WORKTREE_PATH="$PARENT_DIR/${REPO_NAME}-${SHORT}"

# --- Validar que el worktree exista ---
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "❌ No existe el worktree en: $WORKTREE_PATH"
  echo ""
  echo "   Worktrees actuales:"
  git -C "$REPO_ROOT" worktree list
  exit 1
fi

# --- Detectar branch del worktree ---
BRANCH="$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD)"

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "❌ El worktree '$SHORT' está en '$BRANCH'. No se borra worktrees del branch principal."
  exit 1
fi

echo "→ Worktree:  $WORKTREE_PATH"
echo "→ Branch:    $BRANCH"
echo ""

# --- Verificar working tree limpio ---
if [ -n "$(git -C "$WORKTREE_PATH" status --porcelain)" ]; then
  echo "❌ El worktree tiene cambios sin commitear. Resolvé primero:"
  git -C "$WORKTREE_PATH" status --short
  exit 1
fi

# --- Verificar que el branch esté mergeado ---
git -C "$REPO_ROOT" fetch origin main --quiet 2>/dev/null || true

# Estrategia: si el branch ya no contiene commits que main no tenga, está mergeado.
UNMERGED_COMMITS="$(git -C "$REPO_ROOT" log "origin/main..$BRANCH" --oneline 2>/dev/null | wc -l | tr -d ' ')"

MERGED_OK=false

if [ "$UNMERGED_COMMITS" = "0" ]; then
  echo "→ Branch ya está incluido en origin/main: OK"
  MERGED_OK=true
elif command -v gh >/dev/null 2>&1; then
  # Squash-merge: el branch tip difiere pero el PR está MERGED
  PR_STATE="$(gh pr view "$BRANCH" --json state -q .state 2>/dev/null || echo "")"
  if [ "$PR_STATE" = "MERGED" ]; then
    echo "→ PR mergeado (squash) según gh: OK"
    MERGED_OK=true
  fi
fi

if [ "$MERGED_OK" != "true" ]; then
  echo "⚠️  El branch '$BRANCH' tiene $UNMERGED_COMMITS commit(s) que NO están en origin/main."
  echo "   Verificá con:"
  echo "     git log origin/main..$BRANCH --oneline"
  echo "     gh pr view $BRANCH"
  echo ""
  read -p "¿Borrar igual? Vas a perder esos commits si no están en otro lado [y/N]: " FORCE
  if [ "$FORCE" != "y" ] && [ "$FORCE" != "Y" ]; then
    echo "Abortado."
    exit 1
  fi
fi

# --- Confirmación final ---
echo ""
read -p "Confirmar borrado del worktree '$SHORT' y branch '$BRANCH' [y/N]: " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Abortado."
  exit 0
fi

# --- Ejecutar borrado ---
echo ""
echo "→ Eliminando worktree..."
git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH" --force

echo "→ Eliminando branch local..."
if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git -C "$REPO_ROOT" branch -D "$BRANCH"
else
  echo "   (branch ya no existía localmente)"
fi

echo ""
echo "✅ Cleanup completo."
echo ""
echo "   Worktrees restantes:"
git -C "$REPO_ROOT" worktree list
