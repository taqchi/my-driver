#!/bin/bash

INPUT_CSV="data.csv"
OUTPUT_TXT="unique_ips.tf"
TEMP_FILE="all_ips.tmp"

> "$TEMP_FILE"

tail -n +2 "$INPUT_CSV" | while IFS=',' read -r user paths ips keys; do
  for ip in $ips; do
    echo "$ip" >> "$TEMP_FILE"
  done
done

{
echo "module \"share_sg\" {"
echo "  source            = \"./modules/sftp-sg/\""
echo "  security_group_id = var.security_group_id"
echo "  ip = ["
  sort -u "$TEMP_FILE" | while read ip; do
    echo "  \"$ip\","
  done
echo "   ]"
echo "}"  
} > "$OUTPUT_TXT"

rm -f "$TEMP_FILE"

echo "Created: $OUTPUT_TXT"
