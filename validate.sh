#!/bin/bash

INPUT_CSV="data.csv"
EXIT_CODE=0

echo "Validating CSV integrity in: $INPUT_CSV"

# Check dependencies
if ! command -v ssh-keygen &>/dev/null; then
  echo "ssh-keygen is required but not installed. Aborting."
  exit 2
fi

TMP_KEY="/tmp/tmp_key.pub"

# Read CSV from file (skipping header) and process line by line
{
  read # skip header
  while IFS=',' read -r user paths ips keys; do
    user_trimmed=$(echo "$user" | sed 's/^ *//;s/ *$//')
    paths_trimmed=$(echo "$paths" | sed 's/^ *//;s/ *$//')
    ips_trimmed=$(echo "$ips" | sed 's/^ *//;s/ *$//')
    keys_trimmed=$(echo "$keys" | sed 's/^ *//;s/ *$//')

    echo ""
    echo "Checking user: $user_trimmed"

    # Check for empty required fields
    if [[ -z "$user_trimmed" ]]; then
      echo "Field [user_name] is empty"
      EXIT_CODE=1
    fi
    if [[ -z "$paths_trimmed" ]]; then
      echo "Field [paths] is empty for user: $user_trimmed"
      EXIT_CODE=1
    fi
    if [[ -z "$ips_trimmed" ]]; then
      echo "Field [ips] is empty for user: $user_trimmed"
      EXIT_CODE=1
    fi

    # Check for leading/trailing spaces
    for field in user paths ips keys; do
      orig=${!field}
      trimmed=$(echo "$orig" | sed 's/^ *//;s/ *$//')
      if [[ "$orig" != "$trimmed" ]]; then
        echo "[$field] has leading/trailing spaces: '$orig'"
        EXIT_CODE=1
      fi
    done

    # Validate spacing (no multiple spaces)
    for field in paths ips; do
      if echo "${!field}" | grep -qE '\s{2,}'; then
        echo "[$field] contains multiple spaces: '${!field}'"
        EXIT_CODE=1
      fi
    done

    # Validate quoted SSH keys
    key_count=$(echo "$keys" | grep -o '"' | wc -l)
    if (( key_count % 2 != 0 )); then
      echo "[keys] has unbalanced quotes: '$keys'"
      EXIT_CODE=1
    fi
    if ! echo "$keys" | grep -qE '^("ssh-[^"]+"( "ssh-[^"]+")*)$'; then
      echo "[keys] format invalid — must be quoted and space-separated"
      EXIT_CODE=1
    fi

    # Validate SSH keys via fingerprint
    IFS='"' read -ra parts <<< "$keys"
    for part in "${parts[@]}"; do
      if [[ "$part" == ssh-* ]]; then
        echo "$part" > "$TMP_KEY"
        if ssh-keygen -lf "$TMP_KEY" >/dev/null 2>&1; then
          fingerprint=$(ssh-keygen -lf "$TMP_KEY" | awk '{print $2}')
          echo "SSH Key valid: fingerprint = $fingerprint"
        else
          echo "Invalid SSH key: $part"
          EXIT_CODE=1
        fi
      fi
    done

  done
} < "$INPUT_CSV"

rm -f "$TMP_KEY"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo ""
  echo "CSV and SSH key fingerprint check passed."
else
  echo ""
  echo "CSV validation failed. See details above."
fi

exit $EXIT_CODE
