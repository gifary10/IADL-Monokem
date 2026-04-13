// ============================================================
// api.js — Google Apps Script API Communication
// ============================================================

async function gasRequest(action, body = {}) {
  const payload = { action, ...body };
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Cached dept fetch — avoid refetching on reload
let _deptsCache = null;
async function fetchDepts(forceRefresh = false) {
  if (_deptsCache && !forceRefresh) return _deptsCache;
  const res = await gasRequest('getDepts');
  if (res.ok) _deptsCache = res.depts;
  return res;
}

async function fetchRecords(dept) {
  return gasRequest('getRecords', { dept });
}

async function fetchLastNo() {
  return gasRequest('getLastNo');
}

async function saveRecord(data, isUpdate) {
  return gasRequest(isUpdate ? 'updateRecord' : 'addRecord', { data });
}

async function removeRecord(rowNum) {
  return gasRequest('deleteRecord', { id: rowNum });
}

async function doLoginRequest(dept, code) {
  return gasRequest('login', { dept, code });
}

async function submitEvidenceToGAS(data) {
  return gasRequest('addEvidence', { data });
}

async function fetchEvidences(noHazard) {
  return gasRequest('getEvidences', { noHazard });
}
