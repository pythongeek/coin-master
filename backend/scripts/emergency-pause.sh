#!/bin/bash
# ============================================================================
# CryptoFlip Emergency Pause Runbook
# ============================================================================
# This script performs an emergency platform pause in case of:
#   - Smart contract exploit detected
#   - Major security breach
#   - Suspected fraudulent activity at scale
#   - Regulatory order
#   - Any event requiring immediate halt of all betting
#
# BEFORE RUNNING:
#   1. Confirm you have DEFAULT_ADMIN_ROLE on the smart contract
#   2. Have the operator private key available (for on-chain pause)
#   3. Notify the incident response team
#   4. Document the reason for the pause
#
# USAGE: ./emergency-pause.sh <REASON> [--apply]
#   Without --apply: Dry run (shows what would happen)
#   With --apply:    Actually executes the pause
# ============================================================================

set -euo pipefail

REASON="${1:-}"
APPLY=false
[[ "${2:-}" == "--apply" ]] && APPLY=true

if [[ -z "$REASON" ]]; then
  echo "❌ ERROR: Reason required"
  echo "Usage: ./emergency-pause.sh 'Brief description of incident' [--apply]"
  exit 1
fi

LOG_FILE="/var/log/cryptoflip/emergency-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "========================================" | tee -a "$LOG_FILE"
echo "CRYPTOFLIP EMERGENCY PAUSE RUNBOOK" | tee -a "$LOG_FILE"
echo "Timestamp: $(date -Iseconds)" | tee -a "$LOG_FILE"
echo "Reason: $REASON" | tee -a "$LOG_FILE"
echo "Operator: $(whoami)@$(hostname)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

if [[ "$APPLY" == false ]]; then
  echo "⚠️  DRY RUN MODE — No changes will be made" | tee -a "$LOG_FILE"
  echo "   Add --apply to execute the pause" | tee -a "$LOG_FILE"
fi

# ─── Step 1: Set Global Pause Flag in Redis ───────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[Step 1] Setting global pause flag in Redis..." | tee -a "$LOG_FILE"
if [[ "$APPLY" == true ]]; then
  redis-cli SET global:betting:paused "1" EX 86400 2>/dev/null || echo "   ⚠️ Redis unavailable — manual check needed" | tee -a "$LOG_FILE"
else
  echo "   (dry run) redis-cli SET global:betting:paused 1 EX 86400" | tee -a "$LOG_FILE"
fi

# ─── Step 2: Settle All Pending Bets ─────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[Step 2] Settling all pending bets..." | tee -a "$LOG_FILE"
if [[ "$APPLY" == true ]]; then
  npx ts-node scripts/settle-pending-bets.ts 2>/dev/null || echo "   ⚠️ Settlement script failed — manual review needed" | tee -a "$LOG_FILE"
else
  echo "   (dry run) npx ts-node scripts/settle-pending-bets.ts" | tee -a "$LOG_FILE"
fi

# ─── Step 3: Pause Smart Contract ─────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[Step 3] Pausing smart contract on-chain..." | tee -a "$LOG_FILE"
if [[ "$APPLY" == true ]]; then
  npx hardhat run scripts/pause-contract.ts --network mainnet 2>/dev/null || echo "   ⚠️ On-chain pause failed — manual review needed" | tee -a "$LOG_FILE"
else
  echo "   (dry run) npx hardhat run scripts/pause-contract.ts --network mainnet" | tee -a "$LOG_FILE"
fi

# ─── Step 4: Notify Connected Clients ────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[Step 4] Broadcasting pause to all connected clients..." | tee -a "$LOG_FILE"
if [[ "$APPLY" == true ]]; then
  node -e "
    const io = require('socket.io-client')('ws://localhost:4001');
    io.emit('admin:pause', { reason: '$REASON', duration: 86400, timestamp: new Date().toISOString() });
    setTimeout(() => process.exit(0), 2000);
  " 2>/dev/null || echo "   ⚠️ WebSocket broadcast failed" | tee -a "$LOG_FILE"
else
  echo "   (dry run) WebSocket broadcast: admin:pause" | tee -a "$LOG_FILE"
fi

# ─── Step 5: Slack Alert ─────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[Step 5] Sending incident alert..." | tee -a "$LOG_FILE"
if [[ "$APPLY" == true && -n "${SLACK_WEBHOOK:-}" ]]; then
  curl -s -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🚨 EMERGENCY PAUSE ACTIVATED\\nReason: $REASON\\nTime: $(date -Iseconds)\\nOperator: $(whoami)@$(hostname)\"}" \
    2>/dev/null || echo "   ⚠️ Slack notification failed" | tee -a "$LOG_FILE"
else
  echo "   (dry run) Slack notification" | tee -a "$LOG_FILE"
fi

# ─── Step 6: Audit Log ───────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[Step 6] Writing audit log..." | tee -a "$LOG_FILE"
if [[ "$APPLY" == true ]]; then
  psql "$DATABASE_URL" -c "
    INSERT INTO audit_logs (action, resource, old_value, new_value, ip_address)
    VALUES ('emergency_pause', 'platform', '{\"status\":\"active\"}'::jsonb, '{\"status\":\"paused\",\"reason\":\"$REASON\"}'::jsonb, '$(whoami)@$(hostname)');
  " 2>/dev/null || echo "   ⚠️ Audit log failed — manual entry needed" | tee -a "$LOG_FILE"
else
  echo "   (dry run) INSERT INTO audit_logs ..." | tee -a "$LOG_FILE"
fi

# ─── Summary ────────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
if [[ "$APPLY" == true ]]; then
  echo "✅ EMERGENCY PAUSE COMPLETE" | tee -a "$LOG_FILE"
else
  echo "✅ DRY RUN COMPLETE — No changes made" | tee -a "$LOG_FILE"
fi
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Next steps:" | tee -a "$LOG_FILE"
echo "  1. Review the incident" | tee -a "$LOG_FILE"
echo "  2. Contact legal counsel if needed" | tee -a "$LOG_FILE"
echo "  3. Investigate root cause" | tee -a "$LOG_FILE"
echo "  4. Run ./emergency-resume.sh when safe to resume" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
