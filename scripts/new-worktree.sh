#!/usr/bin/env bash
# Crea un nuevo git worktree para Skale Motors v2.
#
# Uso:
#   bash scripts/new-worktree.sh <nombre-corto> <branch-name>
#
# Ejemplo:
#   bash scripts/new-worktree.sh billing feat/billing-ui
#
# Comportamiento:
#   1. Crea worktree en ../<repo>-<nombre-corto>
#   2. Crea branch nuevo (debe NO existir)
#   3. Copia .env desde el repo principal
#   4. Instala dependencias (npm ci)
#   5. Imprime resumen con comandos para entrar.

set -euo pipefail

# --- Validación de args ---
if [ "$#" -ne 2 ]; then
  echo "❌ Uso: $0 <nombre-corto> <branch-name>"
  echo "   Ejemplo: $0 billing feat/billing-ui"
  exit 1
fi

SHORT="$1"
BRANCH="$2"
REPO_ROOT="$(git rev-parse --show-toplevel)"
PARENT_DIR="$(dirname "$REPO_ROOT")"
REPO_NAME="$(basename "$REPO_ROOT")"
WORKTREE_PATH="$PARENT_DIR/${REPO_NAME}-${SHORT}"

echo "→ Repo principal:    $REPO_ROOT"
echo "→ Worktree destino:  $WORKTREE_PATH"
echo "→ Branch a crear:    $BRANCH"
echo ""

# --- Validar que el branch no exista local ni remoto ---
if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "❌ El branch '$BRANCH' ya existe localmente."
  echo "   Usá otro nombre o borralo primero: git branch -d $BRANCH"
  exit 1
fi

if git -C "$REPO_ROOT" ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "❌ El branch '$BRANCH' ya existe en origin."
  echo "   Para trabajar sobre el existente, usá: git worktree add \"$WORKTREE_PATH\" $BRANCH"
  exit 1
fi

# --- Validar que la carpeta destino no exista ---
if [ -e "$WORKTREE_PATH" ]; then
  echo "❌ La carpeta '$WORKTREE_PATH' ya existe."
  exit 1
fi

# --- Crear el worktree ---
echo "→ Creando worktree y branch '$BRANCH'..."
git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" -b "$BRANCH"

# --- Copiar .env ---
if [ -f "$REPO_ROOT/.env" ]; then
  echo "→ Copiando .env..."
  cp "$REPO_ROOT/.env" "$WORKTREE_PATH/.env"
else
  echo "⚠️  No hay .env en el repo principal. Vas a tener que crear uno manualmente."
fi

# --- Instalar dependencias ---
echo "→ Instalando dependencias (npm ci, puede tardar 1-2 min)..."
if (cd "$WORKTREE_PATH" && npm ci --prefer-offline --no-audit --no-fund); then
  echo "→ Dependencias instaladas."
else
  echo "⚠️  npm ci falló. Probá manualmente: cd \"$WORKTREE_PATH\" && npm install"
fi

# --- Resumen ---
echo ""
echo "✅ Worktree listo."
echo ""
echo "   Ruta:    $WORKTREE_PATH"
echo "   Branch:  $BRANCH"
echo ""
echo "   Para entrar:"
echo "     cd \"$WORKTREE_PATH\""
echo ""
echo "   Para abrir VS Code (otra ventana):"
echo "     code \"$WORKTREE_PATH\""
echo ""
echo "   Después del primer commit, abrí draft PR con:"
echo "     gh pr create --draft --title \"<tipo>(<scope>): <resumen>\""
