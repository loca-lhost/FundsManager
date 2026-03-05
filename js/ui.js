// --- UI HELPERS (Toast, Dropdowns, Tabs, Pull-to-Refresh) ---

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <div class="toast-inner">
            <i class="fas ${icon} toast-icon-inline"></i>
            <div class="flex-1">
                <div class="font-bold mb-sm">${escapeHtml(title)}</div>
                <div class="text-sm" style="opacity: 0.9;">${escapeHtml(message)}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="toast-close">&times;</button>
        </div>
    `;

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
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) {
        tabContent.style.display = 'block';
        tabContent.classList.add('active');
    }

    // Activate button
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.querySelector(`.bottom-nav-item[onclick*="${tabName}"]`);
    if (activeNav) activeNav.classList.add('active');

    vibrate(25);
}

// Dropdown functionality
function toggleDropdown() {
    document.getElementById("actionsDropdown").classList.toggle("show");
}

function toggleProfileDropdown() {
    document.getElementById("profileDropdown").classList.toggle("show");
}

function toggleFab() {
    document.getElementById("fabContainer").classList.toggle("active");
}

// Pull-to-Refresh
function setupPullToRefresh() {
    const ptrElement = document.getElementById('ptr');
    const ptrIcon = document.getElementById('ptrIcon');
    if (!ptrElement || !ptrIcon) return;

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
                showToast('Success', 'Data refreshed');
            }, 1000);
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
}

// Close dropdowns when clicking outside
function setupDropdownClose() {
    window.addEventListener('click', function (event) {
        if (!event.target.matches('.dropdown-btn') && !event.target.closest('.dropdown-btn')) {
            var dropdowns = document.querySelectorAll("#actionsDropdown");
            for (var i = 0; i < dropdowns.length; i++) {
                var openDropdown = dropdowns[i];
                if (openDropdown.classList.contains('show')) {
                    openDropdown.classList.remove('show');
                }
            }
        }
        if (!event.target.closest('.header-profile')) {
            var profileDropdown = document.getElementById("profileDropdown");
            if (profileDropdown && profileDropdown.classList.contains('show')) {
                profileDropdown.classList.remove('show');
            }
        }
    });
}

// Inactivity listeners
function setupInactivityListeners() {
    ['mousemove', 'keydown', 'touchstart', 'click'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
}
