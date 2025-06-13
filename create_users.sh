#!/bin/bash

INPUT_CSV="data.csv"
OUTPUT_DIR="./"
mkdir -p "$OUTPUT_DIR"

# Skip header and process each line
tail -n +2 "$INPUT_CSV" | while IFS=',' read -r user paths ips keys; do
  module_name=$(echo "$user" | sed 's/[^a-zA-Z0-9_]/_/g')
  filename="${OUTPUT_DIR}/sftp_${module_name}.tf"

  {
    echo "module \"sftp_${module_name}\" {"
    echo "  source         = \"./modules/sftp/\""
    echo "  user_name      = \"$user\""
    echo "  s3_bucket_name = var.s3_bucket_name"
    echo "  transfer_server_id = var.transfer_server_id"

    # PATHS as array
    echo "  path = ["
    for path in $paths; do
      echo "    \"$path\","
    done
    echo "  ]"

    # IPs as array
    echo "  client_ip = ["
    for ip in $ips; do
      echo "    \"$ip\","
    done
    echo "  ]"

    # SSH public keys as array
    echo "  ssh_public_key = ["
    IFS='"' read -ra parts <<< "$keys"
    for part in "${parts[@]}"; do
      if [[ "$part" == ssh-* ]]; then
        echo "    \"$part\","
      fi
    done
    echo "  ]"

    echo "}"
  } > "$filename"

  echo "Created: $filename"
done
