// ============================================================
// config.js — App Configuration & Global State
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxKFYiEQx74z1O-NvxjXlFoC-AMRAw6qmHpJdq8Jya7rpe2hPCyltmYUpxNu_7GhS_2/exec'; // ← GANTI INI

const STATE = {
  dept: null,
  records: [],
  deleteRowNum: null,
  deleteHazardNo: null,
  editMode: false,
  activeTab: 'form'
};

// Risk level thresholds
// PxD range: Prob(1–6) × Dampak(1–5) → max = 30
// Low: 1–3 | Medium: 4–6 | High: 8–12 | Extreme: 15–30
const RISK_THRESHOLDS = { EXTREME: 15, HIGH: 8, MEDIUM: 4 };

function riskLevel(pxd) {
  const n = Number(pxd);
  if (n >= RISK_THRESHOLDS.EXTREME) return 'Extreme';
  if (n >= RISK_THRESHOLDS.HIGH)    return 'High';
  if (n >= RISK_THRESHOLDS.MEDIUM)  return 'Medium';
  if (n >= 1)                        return 'Low';
  return '—';
}

function riskBadge(level) {
  const map = { 'Extreme': 'risk-extreme', 'High': 'risk-high', 'Medium': 'risk-medium', 'Low': 'risk-low' };
  const icon = { 'Extreme': 'bi-exclamation-octagon-fill', 'High': 'bi-exclamation-triangle-fill', 'Medium': 'bi-dash-circle-fill', 'Low': 'bi-check-circle-fill' };
  const cls  = map[level]  || 'risk-low';
  const ico  = icon[level] || 'bi-check-circle-fill';
  return `<span class="risk-badge ${cls}"><i class="bi ${ico}"></i>${level || '—'}</span>`;
}
