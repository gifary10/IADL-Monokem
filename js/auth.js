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
    } else {
      console.warn('Failed to fetch departments:', res.msg);
    }
  } catch (e) {
    console.warn('Offline mode or GAS URL not set:', e.message);
    // Show offline indicator
    const errEl = document.getElementById('loginError');
    if (errEl) {
      errEl.textContent = 'Mode offline — data departemen tidak dapat dimuat.';
      errEl.style.display = 'block';
      errEl.style.color = 'var(--clr-amber)';
    }
  }

  if (deptSpinner) deptSpinner.style.display = 'none';
  if (loginDept)   loginDept.disabled = false;

  // Auto-restore session
  const saved = localStorage.getItem('iadl_dept');
  if (saved) { 
    STATE.dept = saved; 
    setTimeout(() => enterApp(), 300);
  }

  // Enter on keyboard
  document.getElementById('loginCode')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

async function doLogin() {
  const dept  = document.getElementById('loginDept').value;
  const code  = document.getElementById('loginCode').value.trim();
  const errEl = document.getElementById('loginError');

  if (!dept) { 
    errEl.textContent = 'Silakan pilih departemen.'; 
    errEl.style.display = 'block'; 
    errEl.style.color = 'var(--clr-red)';
    return; 
  }
  if (!code) { 
    errEl.textContent = 'Masukkan kode akses.'; 
    errEl.style.display = 'block'; 
    errEl.style.color = 'var(--clr-red)';
    return; 
  }
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
      errEl.textContent = res.msg || 'Login gagal. Periksa departemen dan kode akses.';
      errEl.style.display = 'block';
      errEl.style.color = 'var(--clr-red)';
    }
  } catch (e) {
    const errorMsg = handleApiError(e, 'Tidak dapat terhubung ke server.');
    errEl.textContent = errorMsg;
    errEl.style.display = 'block';
    errEl.style.color = 'var(--clr-red)';
    console.error('Login error:', e);
  }

  btnLogin.disabled = false;
  btnContent.style.display = '';
  btnSpinner.style.display = 'none';
}

function enterApp() {
  const overlay = document.getElementById('loginOverlay');
  overlay.classList.add('fade-out');
  setTimeout(() => { 
    overlay.style.display = 'none'; 
    document.getElementById('appNav').style.display  = 'flex';
    document.getElementById('appMain').style.display = 'block';
    document.getElementById('navDeptName').textContent = STATE.dept;
    loadRecords();
  }, 400);
}

function doLogout() {
  localStorage.removeItem('iadl_dept');
  sessionStorage.removeItem(AUTOSAVE_KEY);
  STATE.dept = null;
  STATE.records = [];
  location.reload();
}