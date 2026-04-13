// ============================================================
// auth.js — Login / Logout
// ============================================================

async function initLogin() {
  const deptSpinner = document.getElementById('deptSpinner');
  const loginDept   = document.getElementById('loginDept');
  if (deptSpinner) deptSpinner.style.display = 'block';
  if (loginDept)   loginDept.disabled = true;

  try {
    const res = await fetchDepts();
    if (res.ok) {
      const sel = document.getElementById('loginDept');
      res.depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = d.name;
        sel.appendChild(opt);
      });
    }
  } catch (e) { console.warn('Offline mode or GAS URL not set.'); }

  if (deptSpinner) deptSpinner.style.display = 'none';
  if (loginDept)   loginDept.disabled = false;

  // Auto-restore session
  const saved = localStorage.getItem('iadl_dept');
  if (saved) { STATE.dept = saved; enterApp(); }

  // Enter on keyboard
  document.getElementById('loginCode')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

async function doLogin() {
  const dept  = document.getElementById('loginDept').value;
  const code  = document.getElementById('loginCode').value.trim();
  const errEl = document.getElementById('loginError');

  if (!dept) { errEl.textContent = 'Silakan pilih departemen.'; errEl.style.display = 'block'; return; }
  if (!code) { errEl.textContent = 'Masukkan kode akses.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btnLogin   = document.getElementById('btnLogin');
  const btnContent = document.getElementById('btnLoginContent');
  const btnSpinner = document.getElementById('btnLoginSpinner');
  btnLogin.disabled = true;
  btnContent.style.display = 'none';
  btnSpinner.style.display = 'flex';

  try {
    const res = await doLoginRequest(dept, code);
    if (res.ok) {
      STATE.dept = dept;
      localStorage.setItem('iadl_dept', dept);
      enterApp();
    } else {
      errEl.textContent = res.msg || 'Login gagal.';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent = 'Tidak dapat terhubung ke server.';
    errEl.style.display = 'block';
  }

  btnLogin.disabled = false;
  btnContent.style.display = '';
  btnSpinner.style.display = 'none';
}

function enterApp() {
  const overlay = document.getElementById('loginOverlay');
  overlay.classList.add('fade-out');
  setTimeout(() => { overlay.style.display = 'none'; }, 400);
  document.getElementById('appNav').style.display  = 'flex';
  document.getElementById('appMain').style.display = 'block';
  document.getElementById('navDeptName').textContent = STATE.dept;
  loadRecords();
}

function doLogout() {
  localStorage.removeItem('iadl_dept');
  STATE.dept = null;
  STATE.records = [];
  location.reload();
}
