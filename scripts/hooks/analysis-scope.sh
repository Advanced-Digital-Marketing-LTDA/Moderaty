# Shared by pre-commit and pre-push (sourced, not executed): which changed files a
# Codacy analysis covers. Code by extension, Dockerfiles (Hadolint), and the hook
# bodies in scripts/hooks/*.sh (ShellCheck). One definition, so the hooks cannot drift apart.

CODE_RE='\.(ts|tsx|js|mjs|cjs|jsx|astro|css|py|rb|go|java|php|sh|vue|svelte)$'
DOCKERFILE_RE='(^|/)([^/]*\.)?Dockerfile$'
HOOKS_RE='^scripts/hooks/'
SKIP_RE='^(node_modules/|dist/|dist-server/|\.svelte-kit/|\.codacy/)'

# is_analysis_file <path>: succeeds when a Codacy analysis covers the path.
is_analysis_file() {
  local f="$1"
  [[ "$f" =~ $SKIP_RE ]] && return 1
  [[ "$f" =~ $CODE_RE || "$f" =~ $DOCKERFILE_RE || "$f" =~ $HOOKS_RE ]]
}
