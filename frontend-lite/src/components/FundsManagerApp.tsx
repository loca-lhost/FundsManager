"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoginScreen from "@/components/auth/LoginScreen";
import ContributionsTable from "@/components/contributions/ContributionsTable";
import RecentActivity from "@/components/dashboard/RecentActivity";
import StatsCards from "@/components/dashboard/StatsCards";
import AppHeader from "@/components/layout/AppHeader";
import Toolbar from "@/components/layout/Toolbar";
import ContributionModal from "@/components/modals/ContributionModal";
import DividendModal from "@/components/modals/DividendModal";
import IssueOverdraftModal from "@/components/modals/IssueOverdraftModal";
import MemberModal from "@/components/modals/MemberModal";
import RepayOverdraftModal from "@/components/modals/RepayOverdraftModal";
import OverdraftSection from "@/components/overdraft/OverdraftSection";
import { formatRoleLabel, getCurrentSessionUser, isAdminRole, isManagerRole, signIn, signOut } from "@/lib/auth-service";
import {
  createMember,
  deleteContribution,
  fetchAvailableYears,
  fetchMembersWithContributions,
  setMemberArchived,
  updateMember,
  upsertContribution,
} from "@/lib/data-service";
import { currency, formatDateTime } from "@/lib/format";
import { createOverdraft, fetchOverdrafts, isOpenOverdraftStatus, repayOverdraft } from "@/lib/overdraft-service";
import type { SessionUser } from "@/types/auth";
import type { ActivityLog, MemberContribution, MonthName, OverdraftRecord } from "@/types/funds";

type NoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const currentYear = new Date().getFullYear();

function seedOverdraftActivity(records: OverdraftRecord[]): ActivityLog[] {
  return records.slice(0, 6).map((item) => ({
    id: `od-${item.id}`,
    action: item.status === "settled" ? "Repayment" : "Overdraft",
    detail:
      item.status === "settled"
        ? `${item.memberName} settled ${currency(item.totalRepayment)}`
        : `${item.memberName} received ${currency(item.amount)} overdraft`,
    timestamp: formatDateTime(item.dateIssued),
    icon: item.status === "settled" ? "fa-check-circle" : "fa-money-check-dollar",
    tone: item.status === "settled" ? "success" : item.status === "rejected" ? "warning" : "info",
  }));
}

export default function FundsManagerApp() {
  const [activeView, setActiveView] = useState<"contributions" | "overdrafts">("contributions");
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [yearOptions, setYearOptions] = useState<number[]>([currentYear]);
  const [showArchived, setShowArchived] = useState(false);

  const [showDividendModal, setShowDividendModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberModalMode, setMemberModalMode] = useState<"create" | "edit">("create");
  const [editingMember, setEditingMember] = useState<MemberContribution | null>(null);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [showIssueOverdraftModal, setShowIssueOverdraftModal] = useState(false);
  const [showRepayOverdraftModal, setShowRepayOverdraftModal] = useState(false);
  const [repayingOverdraft, setRepayingOverdraft] = useState<OverdraftRecord | null>(null);

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState("");

  const [members, setMembers] = useState<MemberContribution[]>([]);
  const [overdrafts, setOverdrafts] = useState<OverdraftRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingOverdrafts, setLoadingOverdrafts] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [manualActivityLogs, setManualActivityLogs] = useState<ActivityLog[]>([]);

  const canManage = sessionUser ? isManagerRole(sessionUser.role) : false;
  const canAdmin = sessionUser ? isAdminRole(sessionUser.role) : false;

  const yearOverdrafts = useMemo(
    () => overdrafts.filter((item) => item.year === selectedYear),
    [overdrafts, selectedYear],
  );
  const seededLogs = useMemo(() => seedOverdraftActivity(yearOverdrafts), [yearOverdrafts]);
  const activityLogs = useMemo(() => [...manualActivityLogs, ...seededLogs].slice(0, 8), [manualActivityLogs, seededLogs]);

  const visibleMembers = useMemo(() => {
    const source = showArchived ? members.filter((member) => member.isArchived) : members.filter((member) => !member.isArchived);

    return source.filter((member) => {
      const term = search.trim().toLowerCase();
      const matchesSearch = !term || member.name.toLowerCase().includes(term) || member.accountNumber.toLowerCase().includes(term);
      const matchesMonth = !selectedMonth || (member.contributions[selectedMonth as MonthName] || 0) > 0;
      return matchesSearch && matchesMonth;
    });
  }, [members, search, selectedMonth, showArchived]);

  const visibleOverdrafts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const yearFiltered = yearOverdrafts;
    if (!term) return yearFiltered;
    return yearFiltered.filter((item) => {
      const status = item.status.toLowerCase();
      const reason = item.reason.toLowerCase();
      return item.memberName.toLowerCase().includes(term) || reason.includes(term) || status.includes(term);
    });
  }, [yearOverdrafts, search]);

  const openOverdraftCount = useMemo(
    () => yearOverdrafts.filter((item) => isOpenOverdraftStatus(item.status)).length,
    [yearOverdrafts],
  );

  const appendActivity = useCallback((payload: Omit<ActivityLog, "id" | "timestamp">) => {
    const event: ActivityLog = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: formatDateTime(new Date().toISOString()),
      ...payload,
    };
    setManualActivityLogs((current) => [event, ...current].slice(0, 8));
  }, []);

  const loadYearData = useCallback(async () => {
    if (!sessionUser) return;

    setLoadingMembers(true);
    setLoadingOverdrafts(true);

    try {
      const [liveMembers, overdraftRecords] = await Promise.all([
        fetchMembersWithContributions(selectedYear),
        fetchOverdrafts(),
      ]);

      const memberNameById = new Map(liveMembers.map((member) => [member.id, member.name]));
      const enrichedOverdrafts = overdraftRecords.map((record) => ({
        ...record,
        memberName:
          record.memberName && record.memberName !== "Unknown Member"
            ? record.memberName
            : memberNameById.get(record.memberId) || "Unknown Member",
      }));

      setMembers(liveMembers);
      setOverdrafts(enrichedOverdrafts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load application data";
      setMembers([]);
      setOverdrafts([]);
      setNotice({ type: "error", message });
    } finally {
      setLoadingMembers(false);
      setLoadingOverdrafts(false);
    }
  }, [selectedYear, sessionUser]);

  const loadYears = useCallback(async () => {
    if (!sessionUser) return;

    try {
      const years = await fetchAvailableYears();
      setYearOptions(years.length > 0 ? years : [currentYear]);
      if (years.length > 0 && !years.includes(selectedYear)) {
        setSelectedYear(years[0]);
      }
    } catch {
      setYearOptions([currentYear]);
    }
  }, [selectedYear, sessionUser]);

  useEffect(() => {
    const remembered = localStorage.getItem("rememberedEmail") || "";
    setRememberedEmail(remembered);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      setAuthLoading(true);
      const user = await getCurrentSessionUser();
      if (!active) return;

      setSessionUser(user);
      if (!user) {
        setMembers([]);
        setOverdrafts([]);
      }
      setAuthLoading(false);
    }

    bootstrapAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    loadYears();
  }, [loadYears, sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    loadYearData();
  }, [loadYearData, sessionUser]);

  async function handleLogin(payload: { email: string; password: string; remember: boolean }) {
    setLoginLoading(true);
    setNotice(null);

    try {
      const user = await signIn(payload.email, payload.password);
      setSessionUser(user);
      if (payload.remember) {
        localStorage.setItem("rememberedEmail", payload.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      setNotice({ type: "success", message: "Logged in successfully." });
      appendActivity({
        action: "Session",
        detail: `${user.fullName} signed in`,
        icon: "fa-right-to-bracket",
        tone: "info",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setNotice({ type: "error", message });
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await signOut();
    setSessionUser(null);
    setMembers([]);
    setOverdrafts([]);
    setNotice({ type: "info", message: "Logged out." });
  }

  function openCreateMemberModal() {
    setEditingMember(null);
    setMemberModalMode("create");
    setShowMemberModal(true);
  }

  function openEditMemberModal(member: MemberContribution) {
    setEditingMember(member);
    setMemberModalMode("edit");
    setShowMemberModal(true);
  }

  async function handleSaveMember(payload: {
    name: string;
    accountNumber: string;
    initialMonth: MonthName | null;
    initialAmount: number;
  }) {
    if (!canManage) return;

    const duplicateAccount = members.find(
      (member) => member.accountNumber === payload.accountNumber && member.id !== editingMember?.id,
    );

    if (duplicateAccount) {
      setNotice({ type: "error", message: "Account number already exists." });
      return;
    }

    setSavingAction(true);

    try {
      let targetMemberId = editingMember?.id || "";

      if (memberModalMode === "create") {
        const created = await createMember({ name: payload.name, accountNumber: payload.accountNumber });
        targetMemberId = created.id;
        appendActivity({
          action: "Member",
          detail: `Created member ${created.name}`,
          icon: "fa-user-plus",
          tone: "success",
        });
      } else if (editingMember) {
        await updateMember(editingMember.id, { name: payload.name, accountNumber: payload.accountNumber });
        appendActivity({
          action: "Member",
          detail: `Updated member ${payload.name}`,
          icon: "fa-user-edit",
          tone: "info",
        });
      }

      if (payload.initialMonth && payload.initialAmount > 0 && targetMemberId) {
        await upsertContribution({
          memberId: targetMemberId,
          year: selectedYear,
          month: payload.initialMonth,
          amount: payload.initialAmount,
        });
      }

      setShowMemberModal(false);
      setNotice({ type: "success", message: `Member ${memberModalMode === "create" ? "added" : "updated"} successfully.` });
      await loadYearData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save member";
      setNotice({ type: "error", message });
    } finally {
      setSavingAction(false);
    }
  }

  async function handleArchiveMember(memberId: string) {
    if (!canAdmin) return;

    const hasActiveOverdraft = overdrafts.some((item) => item.memberId === memberId && isOpenOverdraftStatus(item.status));
    if (hasActiveOverdraft) {
      setNotice({
        type: "error",
        message: "Cannot archive member with active overdrafts. Record repayments first.",
      });
      return;
    }

    if (!window.confirm("Archive this member?")) return;

    setSavingAction(true);
    try {
      await setMemberArchived(memberId, true);
      setNotice({ type: "success", message: "Member archived." });
      appendActivity({
        action: "Member",
        detail: "Archived a member account",
        icon: "fa-box-archive",
        tone: "warning",
      });
      await loadYearData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to archive member";
      setNotice({ type: "error", message });
    } finally {
      setSavingAction(false);
    }
  }

  async function handleRestoreMember(memberId: string) {
    if (!canAdmin) return;

    setSavingAction(true);
    try {
      await setMemberArchived(memberId, false);
      setNotice({ type: "success", message: "Member restored." });
      appendActivity({
        action: "Member",
        detail: "Restored a member account",
        icon: "fa-rotate-left",
        tone: "success",
      });
      await loadYearData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to restore member";
      setNotice({ type: "error", message });
    } finally {
      setSavingAction(false);
    }
  }

  async function handleSaveContribution(payload: { memberId: string; month: MonthName; amount: number }) {
    if (!canManage) return;

    setSavingAction(true);
    try {
      await upsertContribution({ ...payload, year: selectedYear });
      setShowContributionModal(false);
      setNotice({ type: "success", message: "Contribution saved." });
      appendActivity({
        action: "Contribution",
        detail: `Updated ${payload.month} contribution`,
        icon: "fa-hand-holding-usd",
        tone: "success",
      });
      await loadYearData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save contribution";
      setNotice({ type: "error", message });
    } finally {
      setSavingAction(false);
    }
  }

  async function handleDeleteContribution(payload: { memberId: string; month: MonthName }) {
    if (!canManage) return;

    setSavingAction(true);
    try {
      await deleteContribution({ ...payload, year: selectedYear });
      setShowContributionModal(false);
      setNotice({ type: "success", message: "Contribution deleted." });
      appendActivity({
        action: "Contribution",
        detail: `Deleted ${payload.month} contribution`,
        icon: "fa-trash",
        tone: "warning",
      });
      await loadYearData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete contribution";
      setNotice({ type: "error", message });
    } finally {
      setSavingAction(false);
    }
  }

  async function handleIssueOverdraft(payload: { memberId: string; amount: number; reason: string }) {
    if (!canManage) return;
    const targetMember = members.find((member) => member.id === payload.memberId);
    if (!targetMember) {
      setNotice({ type: "error", message: "Selected member could not be found." });
      return;
    }

    setSavingAction(true);
    try {
      await createOverdraft({
        year: selectedYear,
        memberId: payload.memberId,
        memberName: targetMember.name,
        amount: payload.amount,
        reason: payload.reason,
      });
      setShowIssueOverdraftModal(false);
      setNotice({ type: "success", message: "Overdraft issued successfully." });
      appendActivity({
        action: "Overdraft",
        detail: `${targetMember.name} issued ${currency(payload.amount)}`,
        icon: "fa-money-check-dollar",
        tone: "info",
      });
      await loadYearData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to issue overdraft";
      setNotice({ type: "error", message });
    } finally {
      setSavingAction(false);
    }
  }

  async function handleRepayOverdraft(amount: number) {
    if (!canManage || !repayingOverdraft) return;

    setSavingAction(true);
    try {
      await repayOverdraft({ overdraftId: repayingOverdraft.id, amount });
      setShowRepayOverdraftModal(false);
      setRepayingOverdraft(null);
      setNotice({ type: "success", message: "Overdraft payment recorded." });
      appendActivity({
        action: "Repayment",
        detail: `${repayingOverdraft.memberName} paid ${currency(amount)}`,
        icon: "fa-money-bill-wave",
        tone: "success",
      });
      await loadYearData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to repay overdraft";
      setNotice({ type: "error", message });
    } finally {
      setSavingAction(false);
    }
  }

  if (authLoading) {
    return (
      <div className="fullscreen-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <LoginScreen
        defaultEmail={rememberedEmail}
        errorMessage={notice?.type === "error" ? notice.message : null}
        loading={loginLoading}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div id="appContent" className="app-shell">
      <AppHeader onLogout={handleLogout} role={formatRoleLabel(sessionUser.role)} userName={sessionUser.fullName.split(" ")[0]} />

      <main className="container">
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeView === "contributions" ? "active" : ""}`}
            onClick={() => setActiveView("contributions")}
            type="button"
          >
            Contributions
          </button>
          <button
            className={`tab-btn ${activeView === "overdrafts" ? "active" : ""}`}
            onClick={() => setActiveView("overdrafts")}
            type="button"
          >
            Overdrafts ({openOverdraftCount})
          </button>
        </div>

        <Toolbar
          canAdmin={canAdmin}
          canManage={canManage}
          onMonthChange={setSelectedMonth}
          onOpenAddMemberModal={openCreateMemberModal}
          onOpenContributionModal={() => setShowContributionModal(true)}
          onOpenDividendModal={() => setShowDividendModal(true)}
          onOpenIssueOverdraftModal={() => setShowIssueOverdraftModal(true)}
          onSearch={setSearch}
          onToggleArchived={() => setShowArchived((current) => !current)}
          onYearChange={setSelectedYear}
          search={search}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          showArchived={showArchived}
          yearOptions={yearOptions}
        />

        {notice && (
          <div className={`notice ${notice.type === "error" ? "error" : notice.type === "success" ? "success" : "info"}`}>
            {notice.message}
          </div>
        )}

        {activeView === "contributions" ? (
          <ContributionsTable
            canAdmin={canAdmin}
            canManage={canManage}
            loading={loadingMembers}
            members={visibleMembers}
            onArchiveMember={handleArchiveMember}
            onEditMember={openEditMemberModal}
            onRestoreMember={handleRestoreMember}
          />
        ) : (
          <OverdraftSection
            canManage={canManage}
            loading={loadingOverdrafts}
            onOpenIssueModal={() => setShowIssueOverdraftModal(true)}
            onOpenRepayModal={(record) => {
              setRepayingOverdraft(record);
              setShowRepayOverdraftModal(true);
            }}
            overdrafts={visibleOverdrafts}
          />
        )}

        <div className="dashboard-grid">
          <StatsCards members={members} overdrafts={yearOverdrafts} />
          <RecentActivity logs={activityLogs} />
        </div>
      </main>

      <DividendModal members={members} onClose={() => setShowDividendModal(false)} open={showDividendModal} overdrafts={yearOverdrafts} />

      {showMemberModal && (
        <MemberModal
          initialMember={editingMember}
          key={`${memberModalMode}-${editingMember?.id || "new"}-${selectedYear}`}
          mode={memberModalMode}
          onClose={() => setShowMemberModal(false)}
          onSave={handleSaveMember}
          open={showMemberModal}
          saving={savingAction}
        />
      )}

      {showContributionModal && (
        <ContributionModal
          key={`contrib-${selectedYear}-${members.length}`}
          members={members}
          onClose={() => setShowContributionModal(false)}
          onDelete={handleDeleteContribution}
          onSave={handleSaveContribution}
          open={showContributionModal}
          saving={savingAction}
          year={selectedYear}
        />
      )}

      <IssueOverdraftModal
        key={`issue-overdraft-${showIssueOverdraftModal ? "open" : "closed"}-${members.length}`}
        members={members}
        onClose={() => setShowIssueOverdraftModal(false)}
        onSave={handleIssueOverdraft}
        open={showIssueOverdraftModal}
        saving={savingAction}
      />

      <RepayOverdraftModal
        key={`repay-overdraft-${showRepayOverdraftModal ? "open" : "closed"}-${repayingOverdraft?.id || "none"}`}
        onClose={() => {
          setShowRepayOverdraftModal(false);
          setRepayingOverdraft(null);
        }}
        onSave={handleRepayOverdraft}
        open={showRepayOverdraftModal}
        overdraft={repayingOverdraft}
        saving={savingAction}
      />
    </div>
  );
}
