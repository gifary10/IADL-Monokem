// ============================================================
// app.js — App Entry Point & Tab Hooks
// ============================================================

// Override switchTab to populate evidence select when needed
const _origSwitchTab = switchTab;
// Monkey-patch evidence tab population
const _switchTabWithHooks = function(tabId) {
  _origSwitchTab(tabId);
  if (tabId === 'evidence') populateEvidenceHazardSelect();
};
// Replace global reference
window.switchTab = _switchTabWithHooks;

// Re-bind tab buttons to use hooked version
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => window.switchTab(btn.dataset.tab);
  });
});

// ── Boot ──────────────────────────────────────────────────────
initLogin();
