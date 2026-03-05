// --- APPLICATION STATE ---
let membersData = [];
let overdraftsData = [];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let currentYear = new Date().getFullYear();
let availableYears = [currentYear];
let memberToDeleteId = null;
let editingMemberId = null;
let viewingMemberId = null;
let userToArchiveId = null;
let memberToRestoreId = null;
let statFilter = null;
let showArchived = false;
let auditLogCursors = [];
let currentAuditPage = 0;
let hasUnsavedChanges = false;
let inactivityTimer;
let realtimeUnsubscribe;
let nextYearToCreate = null;
