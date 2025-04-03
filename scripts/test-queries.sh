set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENDPOINT="https://development.graphql.union.build/v1/graphql"
FAILURES=0
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Process all query files
for file in "$SCRIPT_DIR"/../src/queries/*.graphql; do
  # Create a unique output file for each test
  output_file="$TEMP_DIR/$(basename "$file").log"
  
  # Run test in background, redirecting all output
  (
    if gq $ENDPOINT -l --queryFile "$file" > "$output_file" 2>&1; then
      echo "✅ $file passed"
    else
      echo "❌ $file failed"
      echo "--- Error output for $file ---"
      cat "$output_file"
      # Signal failure to parent process via file
      touch "$output_file.failed"
    fi
  ) &
done

# Wait for all background processes to complete
wait

# Check for failures
for fail_marker in "$TEMP_DIR"/*.failed; do
  if [ -f "$fail_marker" ]; then
    ((FAILURES++))
  fi
done

# Exit with failure if any tests failed
if [ $FAILURES -gt 0 ]; then
  echo "Failed $FAILURES tests."
  exit 1
else
  echo "All tests passed successfully."
  exit 0
fi