// --- UI HELPERS (Toast, Dropdowns, Tabs, Pull-to-Refresh) ---

function showToast(title, message, type = 'info') {
    const validTypes = ['info', 'success', 'warning', 'error'];
    const toastType = validTypes.includes(type) ? type : 'info';
    const container = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${toastType} toast-${toastType}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    let icon = 'fa-info-circle';
    if (toastType === 'success') icon = 'fa-check-circle';
    if (toastType === 'error') icon = 'fa-exclamation-circle';
    if (toastType === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <div class="toast-inner">
            <i class="fas ${icon} toast-icon-inline"></i>
            <div class="flex-1">
                <div class="font-bold mb-sm">${escapeHtml(title)}</div>
                <div class="text-sm" style="opacity: 0.9;">${escapeHtml(message)}</div>
            </div>
            <button type="button" class="toast-close" aria-label="Close">&times;</button>
        </div>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => toast.remove());
    }

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Tab Switching
function switchTab(tabName) {
    const sections = {
        contributions: document.getElementById('contributionsSection'),
        overdrafts: document.getElementById('overdraftsSection')
    };

    Object.entries(sections).forEach(([name, section]) => {
        if (!section) return;
        section.classList.toggle('hidden', name !== tabName);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `tab-${tabName}`);
    });

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.id === `bottom-nav-${tabName}`);
    });

    const managerAllowed = typeof isManager === 'function' && isManager();
    const recordBtn = document.getElementById('btn-record-contribution');
    const issueBtn = document.getElementById('btn-issue-overdraft');
    const reportContribBtn = document.getElementById('btnReportContributions');
    const reportOverdraftBtn = document.getElementById('btnReportOverdrafts');

    if (recordBtn) recordBtn.style.display = managerAllowed && tabName === 'contributions' ? '' : 'none';
    if (issueBtn) issueBtn.style.display = managerAllowed && tabName === 'overdrafts' ? '' : 'none';
    if (reportContribBtn) reportContribBtn.style.display = tabName === 'contributions' ? '' : 'none';
    if (reportOverdraftBtn) reportOverdraftBtn.style.display = tabName === 'overdrafts' ? '' : 'none';

    const searchInput = document.getElementById('searchInput');
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    if (searchInput) {
        searchInput.placeholder = tabName === 'overdrafts'
            ? 'Search member, reason, or status...'
            : 'Search members or account number...';
    }
    if (yearFilter) yearFilter.style.display = tabName === 'contributions' ? '' : 'none';
    if (monthFilter) monthFilter.style.display = tabName === 'contributions' ? '' : 'none';

    if (tabName === 'overdrafts') {
        renderOverdraftsTable();
    } else {
        renderTable();
    }

    vibrate(25);
}

// Dropdown functionality
function toggleDropdown() {
    const menu = document.getElementById('actionsDropdown');
    if (menu) menu.classList.toggle('show');
}

function toggleProfileDropdown() {
    const menu = document.getElementById('profileDropdown');
    if (menu) menu.classList.toggle('show');
}

function toggleFab() {
    const fab = document.getElementById('fabContainer');
    if (fab) fab.classList.toggle('active');
}

function setupToolbarInteractions() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput && !searchInput.dataset.bound) {
        const debouncedRender = debounce(() => {
            const activeTab = document.querySelector('.tab-btn.active')?.id?.replace('tab-', '') || 'contributions';
            if (activeTab === 'overdrafts') {
                renderOverdraftsTable();
            } else {
                renderTable();
            }
        }, 180);
        searchInput.addEventListener('input', debouncedRender);
        searchInput.dataset.bound = 'true';
    }

    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter && !monthFilter.dataset.bound) {
        monthFilter.addEventListener('change', () => renderTable());
        monthFilter.dataset.bound = 'true';
    }
}

// Pull-to-Refresh
function setupPullToRefresh() {
    if (setupPullToRefresh.initialized) return;

    const ptrElement = document.getElementById('ptr') || document.getElementById('pullToRefresh');
    if (!ptrElement) return;

    const ptrIcon = document.getElementById('ptrIcon') || ptrElement.querySelector('.pull-to-refresh-icon i');
    if (!ptrIcon) return;

    let startY = 0;
    let currentY = 0;
    let isRefreshing = false;

    document.addEventListener('touchstart', function (e) {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
        }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (isRefreshing || window.scrollY > 0) return;

        currentY = e.touches[0].clientY;
        const diff = currentY - startY;

        if (diff > 0 && diff < 150) {
            ptrElement.style.top = (diff - 60) + 'px';
            const rotation = Math.min(diff * 3, 360);
            ptrIcon.style.transform = `rotate(${rotation}deg)`;
        }
    }, { passive: true });

    document.addEventListener('touchend', function () {
        const diff = currentY - startY;

        if (diff > 80 && !isRefreshing && window.scrollY === 0) {
            isRefreshing = true;
            ptrElement.classList.add('refreshing');
            vibrate(50);

            setTimeout(function () {
                refreshTable();
                resetPullToRefresh();
                showToast('Success', 'Data refreshed', 'success');
            }, 900);
        } else {
            resetPullToRefresh();
        }

        startY = 0;
        currentY = 0;
    });

    function resetPullToRefresh() {
        isRefreshing = false;
        ptrElement.style.top = '-60px';
        ptrElement.classList.remove('refreshing');
        ptrIcon.style.transform = 'rotate(0deg)';
    }

    setupPullToRefresh.initialized = true;
}

// Close dropdowns when clicking outside
function setupDropdownClose() {
    if (setupDropdownClose.initialized) return;

    window.addEventListener('click', function (event) {
        const actionsDropdown = document.getElementById('actionsDropdown');
        if (actionsDropdown && !event.target.closest('.dropdown')) {
            actionsDropdown.classList.remove('show');
        }

        const profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown && !event.target.closest('.header-profile')) {
            profileDropdown.classList.remove('show');
        }
    });

    setupDropdownClose.initialized = true;
}

// Inactivity listeners
function setupInactivityListeners() {
    if (setupInactivityListeners.initialized) return;

    ['mousemove', 'touchstart', 'click'].forEach(eventName => {
        document.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
    document.addEventListener('keydown', resetInactivityTimer);

    setupInactivityListeners.initialized = true;
}
