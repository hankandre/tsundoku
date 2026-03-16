#!/bin/bash

# Login script for Tsundoku API
# Usage: ./login.sh [username] [password]
# Default: admin / admin123

BASE_URL="${BASE_URL:-http://localhost:6060}"
USERNAME="${1:-admin}"
PASSWORD="${2:-admin123}"

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ACCESS_TOKEN" ]; then
  echo "Login successful!"
  echo ""
  echo "Access Token:"
  echo "$ACCESS_TOKEN"
  echo ""
  echo "Add to your HTTP files:"
  echo "@token = $ACCESS_TOKEN"
else
  echo "Login failed!"
  echo "$RESPONSE"
  exit 1
fi
