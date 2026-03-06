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

function getActiveTab() {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn && activeBtn.id.startsWith('tab-')) {
        return activeBtn.id.replace('tab-', '');
    }
    return 'contributions';
}

function renderActiveTabData() {
    const activeTab = getActiveTab();
    if (activeTab === 'overdrafts') {
        if (typeof renderOverdraftsTable === 'function') renderOverdraftsTable();
        return;
    }
    if (typeof renderTable === 'function') renderTable();
}

// Tab Switching
function switchTab(tabName) {
    const sections = {
        contributions: document.getElementById('contributionsSection'),
        overdrafts: document.getElementById('overdraftsSection')
    };
    const allowedTabs = Object.entries(sections)
        .filter(([, section]) => !!section)
        .map(([name]) => name);
    const activeTab = allowedTabs.includes(tabName) ? tabName : 'contributions';

    Object.entries(sections).forEach(([name, section]) => {
        if (!section) return;
        section.classList.toggle('hidden', name !== activeTab);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `tab-${activeTab}`);
    });

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.id === `bottom-nav-${activeTab}`);
    });

    const managerAllowed = typeof isManager === 'function' && isManager();
    const recordBtn = document.getElementById('btn-record-contribution');
    const issueBtn = document.getElementById('btn-issue-overdraft');
    const reportContribBtn = document.getElementById('btnReportContributions');

    if (recordBtn) recordBtn.classList.remove('hidden');
    if (issueBtn) issueBtn.classList.remove('hidden');

    if (recordBtn) {
        recordBtn.style.display = managerAllowed && activeTab === 'contributions' ? '' : 'none';
    }
    if (issueBtn) {
        issueBtn.style.display = managerAllowed && activeTab === 'overdrafts' ? '' : 'none';
    }
    if (reportContribBtn) {
        reportContribBtn.style.display = activeTab === 'contributions' ? '' : 'none';
    }

    const searchInput = document.getElementById('searchInput');
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    if (searchInput) {
        searchInput.placeholder = activeTab === 'overdrafts'
            ? 'Search overdrafts by member, reason or status...'
            : 'Search members or account number...';
    }
    if (yearFilter) yearFilter.style.display = activeTab === 'contributions' ? '' : 'none';
    if (monthFilter) monthFilter.style.display = activeTab === 'contributions' ? '' : 'none';

    renderActiveTabData();

    vibrate(25);
}

// Dropdown functionality
function toggleDropdown() {
    const menu = document.getElementById('actionsDropdown');
    const button = document.getElementById('btnOperations');
    if (!menu) return;
    const isOpen = menu.classList.toggle('show');
    if (button) button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function toggleProfileDropdown() {
    const menu = document.getElementById('profileDropdown');
    const trigger = document.querySelector('.header-profile');
    if (!menu) return;
    const isOpen = menu.classList.toggle('show');
    if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function toggleFab() {
    const fab = document.getElementById('fabContainer');
    if (fab) fab.classList.toggle('active');
}

function setupToolbarInteractions() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput && !searchInput.dataset.bound) {
        const debouncedRender = debounce(() => {
            renderActiveTabData();
        }, 180);
        searchInput.addEventListener('input', debouncedRender);
        searchInput.dataset.bound = 'true';
    }

    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter && !monthFilter.dataset.bound) {
        monthFilter.addEventListener('change', () => renderTable());
        monthFilter.dataset.bound = 'true';
    }

    const clearSearch = document.getElementById('searchClear');
    if (clearSearch && !clearSearch.dataset.bound) {
        clearSearch.addEventListener('click', () => {
            if (!searchInput) return;
            searchInput.value = '';
            searchInput.focus();
            renderActiveTabData();
        });
        clearSearch.dataset.bound = 'true';
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
        const operationsButton = document.getElementById('btnOperations');
        if (actionsDropdown && !event.target.closest('.dropdown')) {
            actionsDropdown.classList.remove('show');
            if (operationsButton) operationsButton.setAttribute('aria-expanded', 'false');
        }

        const profileDropdown = document.getElementById('profileDropdown');
        const profileTrigger = document.querySelector('.header-profile');
        if (profileDropdown && !event.target.closest('.header-profile')) {
            profileDropdown.classList.remove('show');
            if (profileTrigger) profileTrigger.setAttribute('aria-expanded', 'false');
        }
    });

    setupDropdownClose.initialized = true;
}

function setupModalAccessibility() {
    if (setupModalAccessibility.initialized) return;

    const modals = Array.from(document.querySelectorAll('.modal'));
    modals.forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', modal.classList.contains('active') ? 'false' : 'true');
    });

    let lastActiveModal = null;
    let lastFocusedElement = null;

    function syncModalState() {
        const activeModal = document.querySelector('.modal.active');
        document.body.classList.toggle('modal-open', !!activeModal);

        modals.forEach(modal => {
            modal.setAttribute('aria-hidden', modal.classList.contains('active') ? 'false' : 'true');
        });

        if (activeModal !== lastActiveModal) {
            if (activeModal) {
                lastFocusedElement = document.activeElement;
                const firstFocusable = activeModal.querySelector('input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])');
                if (firstFocusable && typeof firstFocusable.focus === 'function') {
                    setTimeout(() => firstFocusable.focus(), 0);
                }
            } else if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                setTimeout(() => lastFocusedElement.focus(), 0);
            }
            lastActiveModal = activeModal;
        }
    }

    function closeModalElement(modal) {
        if (!modal || modal.dataset.static === 'true') return;
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.click();
            return;
        }
        modal.classList.remove('active');
        syncModalState();
    }

    document.addEventListener('mousedown', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const activeModal = target.closest('.modal.active');
        if (activeModal && target === activeModal) {
            closeModalElement(activeModal);
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;

        const activeModal = document.querySelector('.modal.active');
        if (activeModal && activeModal.dataset.static !== 'true') {
            event.preventDefault();
            closeModalElement(activeModal);
            return;
        }

        const actionsDropdown = document.getElementById('actionsDropdown');
        const profileDropdown = document.getElementById('profileDropdown');
        const operationsButton = document.getElementById('btnOperations');
        const profileTrigger = document.querySelector('.header-profile');
        if (actionsDropdown) actionsDropdown.classList.remove('show');
        if (profileDropdown) profileDropdown.classList.remove('show');
        if (operationsButton) operationsButton.setAttribute('aria-expanded', 'false');
        if (profileTrigger) profileTrigger.setAttribute('aria-expanded', 'false');
    });

    const modalObserver = new MutationObserver(syncModalState);
    modals.forEach(modal => {
        modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    syncModalState();
    setupModalAccessibility.initialized = true;
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
