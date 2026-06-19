# CryptoFlip Security & Compliance Runbook

> **Version:** 1.0  
> **Classification:** INTERNAL — Operations Team Only  
> **Last Updated:** $(date -Iseconds)

---

## 1. Emergency Contacts

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| CTO / Security Lead | security@cryptoflip.io | Immediate |
| Legal Counsel | legal@cryptoflip.io | 1 hour |
| On-call Engineer | oncall@cryptoflip.io | 15 minutes |
| Compliance Officer | compliance@cryptoflip.io | 30 minutes |
| Incident Response | incident@cryptoflip.io | Immediate |

---

## 2. Incident Response Procedures

### 2.1 Detection → Classification → Response

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ DETECT   │ →  │ CLASSIFY     │ →  │ RESPOND      │ →  │ RECOVER      │
│          │    │              │    │              │    │              │
│ - Alert  │    │ - Severity   │    │ - Contain    │    │ - Fix        │
│ - Report │    │ - Impact     │    │ - Eradicate  │    │ - Verify     │
│ - Anomaly│    │ - Scope      │    │ - Document   │    │ - Post-mortem│
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### 2.2 Severity Levels

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|----------|
| **P0 — Critical** | Platform at risk, user funds threatened | 15 min | Contract exploit, hot wallet breach, key compromise |
| **P1 — High** | Major feature broken, data at risk | 1 hour | DDoS overwhelming, API breach, large-scale fraud |
| **P2 — Medium** | Degraded service, localized impact | 4 hours | Rate limit bypass, single user abuse, partial outage |
| **P3 — Low** | Minor issue, no immediate risk | 24 hours | Log anomaly, false positive, non-urgent bug |

---

## 3. Emergency Pause Procedures

### 3.1 When to Pause

Pause the platform immediately if ANY of the following are detected:

- Smart contract vulnerability or exploit
- Unauthorized withdrawal exceeding 10 ETH
- Key compromise (operator, house keeper, admin)
- Regulatory cease-and-desist order
- Suspected Sybil attack affecting >100 users
- Any event where continuing operations could cause irreversible loss

### 3.2 How to Pause

```bash
# DRY RUN — See what will happen
./scripts/emergency-pause.sh "Contract exploit detected, tx 0xabc..."

# EXECUTE — Actually pause
./scripts/emergency-pause.sh "Contract exploit detected, tx 0xabc..." --apply
```

What the script does:
1. Sets `global:betting:paused` in Redis (prevents new bets)
2. Runs settlement script for all pending bets
3. Calls `pause()` on the smart contract (on-chain)
4. Broadcasts `admin:pause` to all WebSocket clients
5. Sends Slack alert to #incidents channel
6. Writes audit log entry

### 3.3 How to Resume

```bash
# DRY RUN
./scripts/emergency-resume.sh "Root cause fixed, contract patched" --dry-run

# EXECUTE
./scripts/emergency-resume.sh "Root cause fixed, contract patched" --apply
```

Requires: 2-of-3 admin signatures (for production)

---

## 4. Fraud Response Playbook

### 4.1 Automated Response

The fraud engine automatically triggers actions based on risk score:

| Risk Score | Action | Description |
|------------|--------|-------------|
| 5–19 | `flag` | Logged, user flagged for review |
| 20–49 | `block` | New bets blocked, existing bets settle normally |
| 50–99 | `suspend` | Account suspended, funds locked for review |
| 100+ | `review` | Manual review required, compliance team notified |

### 4.2 Manual Review Process

1. Receive alert (Slack / PagerDuty / email)
2. Open risk event in admin dashboard (`/admin/risk-events`)
3. Review evidence (bet history, IP logs, wallet connections)
4. Decision:
   - **False Positive** → Mark as `false_positive`, close
   - **Confirmed Fraud** → Mark as `resolved`, ban user, freeze funds
   - **Investigating** → Mark as `investigating`, gather more data
5. Document decision in audit log
6. Update fraud rules if pattern is new

### 4.3 User Appeal Process

1. User submits appeal via support ticket
2. Compliance officer reviews case
3. If overturned: restore account, credit any frozen funds
4. If upheld: maintain ban, document in audit log
5. All appeals logged for regulatory review

---

## 5. KYC / AML Procedures

### 5.1 Tier Requirements

| Tier | Requirements | Limits | Processing Time |
|------|-------------|--------|-----------------|
| **Tier 0** | None | Deposit ≤$100, no withdrawal | Instant |
| **Tier 1** | Email + phone verification | Deposit ≤$10K, withdrawal ≤$5K/day | 5 minutes |
| **Tier 2** | Government ID + selfie | Deposit ≤$100K, withdrawal ≤$50K/day | 24 hours |
| **Tier 3** | Proof of address + source of funds | Unlimited | 3–5 business days |

### 5.2 Suspicious Activity Monitoring

Daily automated checks:
- Large deposits followed by immediate withdrawal (structuring)
- Rapid on/off pattern (>10 deposit/withdrawal cycles/day)
- Deposits from mixing services (Chainalysis API)
- Geographic anomalies (login from 3+ countries in 24h)

---

## 6. Data Retention & GDPR

| Data Type | Retention | Deletion Procedure |
|-----------|-----------|-------------------|
| User profile | Account lifetime + 7 years | Anonymize after closure |
| Bet history | 7 years | Anonymize, keep aggregated stats |
| Chat messages | 30 days | Hard delete after 30 days |
| Transaction logs | 10 years | Archive only |
| Audit logs | 10 years | Immutable, cannot delete |
| IP addresses | 90 days | Anonymize (hash) after 90 days |
| KYC documents | 7 years | Secure shred after period |

### GDPR Right to Erasure

1. User requests deletion via support
2. Verify identity (same as KYC Tier 2)
3. Within 30 days:
   - Delete chat messages (hard delete)
   - Anonymize user profile (replace PII with hashes)
   - Anonymize bet history (keep aggregated stats)
   - Cannot delete: audit logs, transaction records (legal requirement)
4. Send confirmation email
5. Log deletion in audit trail

---

## 7. Regulatory Compliance

### 7.1 Required Licenses (by jurisdiction)

| Jurisdiction | License | Status | Application Date |
|--------------|---------|--------|-----------------|
| Curaçao | Curaçao eGaming | Pending | 2024-07-01 |
| Malta | MGA | Planned | 2024-10-01 |
| Isle of Man | Gambling Supervision | Planned | 2025-01-01 |

### 7.2 Geo-blocking

Automatically blocked regions:
- United States (except licensed states)
- China (Mainland)
- North Korea
- Iran
- Syria
- Myanmar (sanctions)
- Bangladesh (pending local license)

Blocking method: IP geolocation + wallet address verification

---

## 8. Security Checklist (Quarterly)

- [ ] Rotate all admin keys (operator, house keeper)
- [ ] Review access logs for anomalies
- [ ] Test emergency pause/resume procedures
- [ ] Review and update fraud rules
- [ ] Run penetration test on API endpoints
- [ ] Run Foundry test suite on smart contract
- [ ] Verify backup integrity (restore drill)
- [ ] Review and update compliance policies
- [ ] Train staff on incident response
- [ ] Update runbook based on lessons learned

---

> **END OF RUNBOOK**
>
> This document is confidential. Distribution outside the operations team is prohibited without written approval from the CTO.
