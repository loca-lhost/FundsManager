// --- UTILITY FUNCTIONS ---

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function trackFormChanges(formId) {
    hasUnsavedChanges = false;
    const form = document.getElementById(formId);
    if (!form) return;
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => { hasUnsavedChanges = true; });
        input.addEventListener('change', () => { hasUnsavedChanges = true; });
    });
}

function checkUnsavedChanges() {
    if (hasUnsavedChanges) {
        return confirm('You have unsaved changes. Are you sure you want to close?');
    }
    return true;
}

// Helper for pagination (Fetch all documents recursively)
async function fetchAllDocuments(collectionId, queries = []) {
    let allDocuments = [];
    let lastId = null;
    const limit = 5000; // Appwrite max limit per request

    while (true) {
        const currentQueries = [...queries, Appwrite.Query.limit(limit)];
        if (lastId) {
            currentQueries.push(Appwrite.Query.cursorAfter(lastId));
        }

        const response = await databases.listDocuments(DB_ID, collectionId, currentQueries);
        allDocuments = [...allDocuments, ...response.documents];

        if (response.documents.length < limit) break;
        lastId = response.documents[response.documents.length - 1].$id;
    }
    return allDocuments;
}

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function generateRecoveryCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const values = new Uint8Array(8);
    window.crypto.getRandomValues(values);
    return Array.from(values).map(x => chars[x % chars.length]).join('');
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Format currency
function formatCurrency(amount, showSymbol = true) {
    const value = Number.parseFloat(amount || 0);
    const safeValue = Number.isFinite(value) ? value : 0;
    const formatted = safeValue.toLocaleString('en-GH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return showSymbol ? `GH₵ ${formatted}` : formatted;
}

// Format account number
function formatAccountNumber(number) {
    let numStr = number.toString();
    if (numStr.startsWith('260') && numStr.length > 13) {
        return numStr.substring(3);
    }
    return numStr;
}

// Overdraft status helpers
const OVERDRAFT_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SETTLED: 'settled'
};

function normalizeOverdraftStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();

    if (normalized === 'active') return OVERDRAFT_STATUS.APPROVED;
    if (normalized === 'paid') return OVERDRAFT_STATUS.SETTLED;

    if (Object.values(OVERDRAFT_STATUS).includes(normalized)) {
        return normalized;
    }

    return OVERDRAFT_STATUS.PENDING;
}

function isOpenOverdraftStatus(status) {
    const normalized = normalizeOverdraftStatus(status);
    return normalized === OVERDRAFT_STATUS.PENDING || normalized === OVERDRAFT_STATUS.APPROVED;
}

function formatOverdraftStatus(status) {
    const normalized = normalizeOverdraftStatus(status);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// Calculate member total
function calculateMemberTotal(member) {
    return months.reduce((sum, month) => sum + (member.contributions[month] || 0), 0);
}

function setFavicon() {
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'icon';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#004E96;stop-opacity:1" /><stop offset="100%" style="stop-color:#002C63;stop-opacity:1" /></linearGradient></defs><rect width="100" height="100" rx="20" fill="url(#grad)"/><text x="50" y="50" font-family="Arial, sans-serif" font-size="65" fill="white" text-anchor="middle" dy=".35em" font-weight="800">₵</text></svg>`;
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    document.getElementsByTagName('head')[0].appendChild(link);
}

// Haptic Feedback
function vibrate(ms = 50) {
    if (navigator.vibrate) {
        navigator.vibrate(ms);
    }
}

// Role Helpers
let runtimeUserRole = 'viewer';

function normalizeUserRole(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'admin') return 'admin';
    if (normalized === 'fund_manager') return 'fund_manager';
    if (normalized === 'manager') return 'manager';
    return 'viewer';
}

function setRuntimeUserRole(role) {
    runtimeUserRole = normalizeUserRole(role);
}

function clearRuntimeUserRole() {
    runtimeUserRole = 'viewer';
}

function isAdmin() {
    return runtimeUserRole === 'admin';
}

function isManager() {
    const role = runtimeUserRole;
    return role === 'admin' || role === 'fund_manager' || role === 'manager';
}

function getInactivityLimit() {
    const minutes = parseInt(localStorage.getItem('inactivityLimit') || DEFAULT_INACTIVITY_MINUTES);
    return minutes * 60 * 1000;
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (sessionStorage.getItem(SESSION_KEY)) {
        inactivityTimer = setTimeout(() => {
            logout();
            showToast('Session Expired', 'You have been logged out due to inactivity', 'warning');
        }, getInactivityLimit());
    }
}

// Save data to local storage (No-op for Appwrite)
function saveData() {
    // No-op for Appwrite (saves are atomic)
}

