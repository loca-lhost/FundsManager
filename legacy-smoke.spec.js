const { test, expect } = require("playwright/test");

const APP_URL = "http://127.0.0.1:4173/index.html";

test.describe("Legacy FundsManager smoke", () => {
  test("core manager flows and mobile behavior", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      if (window.__smokePatched) return;
      window.__smokePatched = true;

      const store = {
        members: [],
        contributions: [],
        overdrafts: [],
        audit_logs: [],
        profiles: [],
      };
      window.__smokeStore = store;
      let idCounter = 1;

      function parseValues(raw) {
        try {
          return JSON.parse(`[${raw}]`);
        } catch {
          return [raw.replace(/^["']|["']$/g, "")];
        }
      }

      function applyQueries(docs, queries = []) {
        let next = [...docs];
        let limit = null;
        let cursorAfter = null;
        let order = null;

        for (const query of queries) {
          const text = String(query || "");

          const equalMatch = text.match(/^equal\("([^"]+)",\[(.*)\]\)$/);
          if (equalMatch) {
            const field = equalMatch[1];
            const values = parseValues(equalMatch[2]);
            next = next.filter((doc) =>
              values.some((value) => String(doc[field]) === String(value)),
            );
            continue;
          }

          const limitMatch = text.match(/^limit\((\d+)\)$/);
          if (limitMatch) {
            limit = Number.parseInt(limitMatch[1], 10);
            continue;
          }

          const orderDescMatch = text.match(/^orderDesc\("([^"]+)"\)$/);
          if (orderDescMatch) {
            order = { field: orderDescMatch[1], direction: "desc" };
            continue;
          }

          const cursorAfterMatch = text.match(/^cursorAfter\("([^"]+)"\)$/);
          if (cursorAfterMatch) {
            cursorAfter = cursorAfterMatch[1];
            continue;
          }
        }

        if (order) {
          next.sort((a, b) => {
            const aValue = a[order.field] || "";
            const bValue = b[order.field] || "";
            if (order.direction === "desc") return String(bValue).localeCompare(String(aValue));
            return String(aValue).localeCompare(String(bValue));
          });
        }

        if (cursorAfter) {
          const idx = next.findIndex((doc) => doc.$id === cursorAfter);
          if (idx >= 0) next = next.slice(idx + 1);
        }

        if (limit != null) {
          next = next.slice(0, limit);
        }

        return next;
      }

      function clone(value) {
        return JSON.parse(JSON.stringify(value));
      }

      const dbMock = {
        async listDocuments(_dbId, collectionId, queries = []) {
          const docs = applyQueries(store[collectionId] || [], queries);
          return { documents: clone(docs) };
        },
        async createDocument(_dbId, collectionId, _id, payload) {
          const doc = {
            ...clone(payload || {}),
            $id: `${collectionId}_${idCounter++}`,
            $collectionId: collectionId,
            $createdAt: new Date().toISOString(),
          };
          if (!store[collectionId]) store[collectionId] = [];
          store[collectionId].push(doc);
          return clone(doc);
        },
        async updateDocument(_dbId, collectionId, documentId, payload) {
          const docs = store[collectionId] || [];
          const idx = docs.findIndex((doc) => doc.$id === documentId);
          if (idx === -1) throw new Error(`Document not found: ${collectionId}/${documentId}`);
          docs[idx] = { ...docs[idx], ...clone(payload || {}) };
          return clone(docs[idx]);
        },
        async deleteDocument(_dbId, collectionId, documentId) {
          const docs = store[collectionId] || [];
          const idx = docs.findIndex((doc) => doc.$id === documentId);
          if (idx >= 0) docs.splice(idx, 1);
        },
        async getDocument(_dbId, collectionId, documentId) {
          const docs = store[collectionId] || [];
          const found = docs.find((doc) => doc.$id === documentId);
          if (!found) throw new Error(`Document not found: ${collectionId}/${documentId}`);
          return clone(found);
        },
      };

      databases.listDocuments = dbMock.listDocuments;
      databases.createDocument = dbMock.createDocument;
      databases.updateDocument = dbMock.updateDocument;
      databases.deleteDocument = dbMock.deleteDocument;
      databases.getDocument = dbMock.getDocument;

      fetchAllDocuments = async function fetchAllDocumentsMock(collectionId, queries = []) {
        const result = await databases.listDocuments(DB_ID, collectionId, queries);
        return result.documents || [];
      };

      showToast = function showToastMock(title, message, type = "info") {
        window.__toastLog = window.__toastLog || [];
        window.__toastLog.push({ title, message, type, at: Date.now() });
      };

      account.get = async function getMock() {
        return { $id: "u_smoke", name: "Smoke User", email: "smoke@example.com", emailVerification: true };
      };
      account.deleteSession = async function deleteSessionMock() {};
      account.createEmailSession = async function createEmailSessionMock() {};
      account.updatePassword = async function updatePasswordMock() {};
      account.createRecovery = async function createRecoveryMock() {};
      account.updateRecovery = async function updateRecoveryMock() {};
      account.createVerification = async function createVerificationMock() {};
      account.updateVerification = async function updateVerificationMock() {};

      teams.list = async function listTeamsMock() {
        return { teams: [{ $id: "team_admin", name: "Admins" }] };
      };
      teams.listMemberships = async function listMembershipsMock() {
        return { memberships: [] };
      };

      sessionStorage.setItem(
        "welfareUser",
        JSON.stringify({ full_name: "Smoke Admin", role: "admin" }),
      );

      // Stable export hooks so smoke tests can assert output without downloading files.
      window.__xlsxFiles = [];
      window.__pdfFiles = [];

      const xlsxUtils = {
        aoa_to_sheet(data) {
          return { __rows: Array.isArray(data) ? data.length : 0 };
        },
        book_new() {
          return { Sheets: {}, SheetNames: [] };
        },
        book_append_sheet(wb, ws, name) {
          wb.Sheets[name] = ws;
          wb.SheetNames.push(name);
        },
      };
      window.XLSX = {
        utils: xlsxUtils,
        writeFile(_wb, filename) {
          window.__xlsxFiles.push(String(filename || ""));
        },
      };

      window.html2pdf = function html2pdfMock() {
        const state = { options: null, source: null };
        return {
          set(options) {
            state.options = options;
            return this;
          },
          from(source) {
            state.source = source;
            return this;
          },
          save() {
            window.__pdfFiles.push(String(state.options?.filename || ""));
            return Promise.resolve();
          },
        };
      };

      const login = document.getElementById("loginContainer");
      const loader = document.getElementById("initialLoader");
      const app = document.getElementById("appContent");
      if (login) login.style.display = "none";
      if (loader) loader.style.display = "none";
      if (app) app.style.display = "block";

      // Legacy root app currently misses overdraft section/modal markup.
      // Inject a minimal scaffold so overdraft logic can still be exercised.
      if (!document.getElementById("overdraftsTableBody")) {
        const overdraftHost = document.createElement("div");
        overdraftHost.innerHTML = `
          <div class="table-wrapper">
            <table>
              <tbody id="overdraftsTableBody"></tbody>
            </table>
          </div>
          <div class="modal" id="issueOverdraftModal">
            <div class="modal-content">
              <form id="issueOverdraftForm">
                <select id="odMember"></select>
                <input id="odAmount" type="number" />
                <textarea id="odReason"></textarea>
                <button type="submit" id="issueOverdraftSubmit">Issue</button>
              </form>
            </div>
          </div>
          <div class="modal" id="repayOverdraftModal">
            <div class="modal-content">
              <form id="repayOverdraftForm">
                <input id="repayOverdraftId" type="hidden" />
                <span id="repayMemberName"></span>
                <span id="repayPrincipal"></span>
                <span id="repayInterest"></span>
                <span id="repayCollectionMonth"></span>
                <span id="repayTotalDue"></span>
                <span id="repayAmountPaid"></span>
                <span id="repayCollectibleNow"></span>
                <span id="repayRemaining"></span>
                <input id="repayAmount" type="number" />
                <button type="submit" id="repayOverdraftSubmit">Repay</button>
              </form>
            </div>
          </div>
        `;
        (document.getElementById("appContent") || document.body).appendChild(overdraftHost);
        const issueForm = document.getElementById("issueOverdraftForm");
        if (issueForm && !issueForm.dataset.bound) {
          issueForm.addEventListener("submit", (event) => issueOverdraft(event));
          issueForm.dataset.bound = "true";
        }
        const repayForm = document.getElementById("repayOverdraftForm");
        if (repayForm && !repayForm.dataset.bound) {
          repayForm.addEventListener("submit", (event) => repayOverdraft(event));
          repayForm.dataset.bound = "true";
        }
      }

      const year = new Date().getFullYear();
      currentYear = year;
      availableYears = [year];

      const emptyContrib = {};
      months.forEach((month) => {
        emptyContrib[month] = 0;
      });

      membersData = [
        {
          id: "member_1",
          name: "Alice Smoke",
          accountNumber: "1234567890001",
          isArchived: false,
          contributions: { ...emptyContrib, January: 150 },
        },
        {
          id: "member_2",
          name: "Bob Smoke",
          accountNumber: "1234567890002",
          isArchived: false,
          contributions: { ...emptyContrib, February: 80 },
        },
      ];
      overdraftsData = [];

      renderYearSelector();
      renderTable();
      updateStatistics();
      renderRecentActivity();
    });

    await expect(page.locator("#tableBody")).toContainText("Alice Smoke");

    await page.evaluate(() => openAddMemberModal());
    await page.fill("#memberName", "Charlie Smoke");
    await page.fill("#accountNumber", "999888777");
    await page.selectOption("#initialMonth", "March");
    await page.fill("#initialAmount", "200");
    await page.click("#memberForm button[type='submit']");
    await page.waitForTimeout(200);

    await expect(page.locator("#tableBody")).toContainText("Charlie Smoke");

    await page.evaluate(() => {
      const target = membersData.find((member) => member.name === "Charlie Smoke");
      if (!target) throw new Error("Unable to find Charlie Smoke");
      editMember(target.id);
    });
    await page.fill("#memberName", "Charlie Updated");
    await page.click("#memberForm button[type='submit']");
    await page.waitForTimeout(200);

    await expect(page.locator("#tableBody")).toContainText("Charlie Updated");

    const targetMemberId = await page.evaluate(() => {
      const target = membersData.find((member) => member.name === "Charlie Updated");
      if (!target) throw new Error("Unable to find updated member");
      return target.id;
    });

    await page.evaluate(() => openContributionModal());
    await page.selectOption("#contribMember", targetMemberId);
    await page.selectOption("#contribMonth", "April");
    await page.fill("#contribAmount", "350");
    await page.click("#contributionForm button[type='submit']");
    await page.waitForTimeout(200);

    const aprilAmount = await page.evaluate(() => {
      const target = membersData.find((member) => member.name === "Charlie Updated");
      return target ? target.contributions.April : null;
    });
    expect(aprilAmount).toBe(350);

    page.once("dialog", (dialog) => dialog.accept());
    await page.evaluate(() => {
      const target = membersData.find((member) => member.name === "Charlie Updated");
      if (!target) throw new Error("Unable to find member for delete flow");
      editContribution(target.id, "April", target.contributions.April || 0);
    });
    await page.click("#btnDeleteContribution");
    await page.waitForTimeout(200);

    const aprilAfterDelete = await page.evaluate(() => {
      const target = membersData.find((member) => member.name === "Charlie Updated");
      return target ? target.contributions.April : null;
    });
    expect(aprilAfterDelete).toBe(0);

    await page.evaluate(() => openIssueOverdraftModal());
    await page.selectOption("#odMember", targetMemberId);
    await page.fill("#odAmount", "500");
    await page.fill("#odReason", "Smoke test emergency advance");
    await page.click("#issueOverdraftSubmit");
    await page.waitForTimeout(200);

    const overdraftId = await page.evaluate(() => {
      const item = overdraftsData.find((od) => od.memberName === "Charlie Updated");
      if (!item) throw new Error("Unable to find issued overdraft");
      return item.id;
    });

    const issuedOverdraft = await page.evaluate((id) => {
      const item = overdraftsData.find((od) => od.id === id);
      if (!item) return null;
      return {
        amount: item.amount,
        status: item.status,
        interest: item.interest,
      };
    }, overdraftId);
    expect(issuedOverdraft).not.toBeNull();
    expect(issuedOverdraft.amount).toBe(500);
    expect(issuedOverdraft.status).toBe("pending");
    expect(issuedOverdraft.interest).toBe(10);
    await expect(page.locator("#overdraftsTableBody")).toContainText("Charlie Updated");

    await page.evaluate((id) => openRepayOverdraftModal(id), overdraftId);
    await page.fill("#repayAmount", "200");
    await page.click("#repayOverdraftSubmit");
    await page.waitForTimeout(200);

    const repaidOverdraft = await page.evaluate((id) => {
      const item = overdraftsData.find((od) => od.id === id);
      if (!item) return null;
      return {
        amountPaid: item.amountPaid,
        status: item.status,
      };
    }, overdraftId);
    expect(repaidOverdraft).not.toBeNull();
    expect(repaidOverdraft.amountPaid).toBe(200);
    expect(repaidOverdraft.status).toBe("pending");

    await page.evaluate(() => openDividendModal());
    await page.fill("#dividendBroughtForward", "100");
    await page.fill("#dividendMonthlyInterest", "50");
    await page.evaluate(() => updateTotalDividend());

    const totalPoolInput = await page.inputValue("#totalInterestInput");
    expect(totalPoolInput).toContain("160.00");

    await page.evaluate(() => calculateDividends());
    const dividendState = await page.evaluate(() => {
      const panel = document.getElementById("dividendResults");
      const rows = document.querySelectorAll("#dividendTableBody tr").length;
      return {
        display: panel ? getComputedStyle(panel).display : "none",
        rows,
      };
    });
    expect(dividendState.display).toBe("block");
    expect(dividendState.rows).toBeGreaterThan(0);

    await page.evaluate(() => saveDividendToHistory());
    const dividendHistoryInfo = await page.evaluate(() => {
      const history = JSON.parse(localStorage.getItem("dividendHistory") || "[]");
      const latest = history[history.length - 1] || null;
      return {
        count: history.length,
        latest,
      };
    });
    expect(dividendHistoryInfo.count).toBeGreaterThan(0);
    expect(dividendHistoryInfo.latest).not.toBeNull();
    expect(dividendHistoryInfo.latest.totalDividend).toBe(160);

    await page.evaluate(() => exportDividendExcel());
    await page.evaluate(() => exportToXLSX());
    await page.evaluate(() => generatePDF());
    await page.waitForTimeout(200);

    const exportArtifacts = await page.evaluate(() => ({
      xlsxFiles: window.__xlsxFiles || [],
      pdfFiles: window.__pdfFiles || [],
    }));
    expect(exportArtifacts.xlsxFiles).toContain(`Dividends_${new Date().getFullYear()}.xlsx`);
    expect(exportArtifacts.xlsxFiles).toContain(`FundsManager_${new Date().getFullYear()}.xlsx`);
    expect(exportArtifacts.pdfFiles).toContain(`FundsManager_${new Date().getFullYear()}.pdf`);
    await page.evaluate(() => closeDividendModal());

    await page.evaluate(async () => {
      for (let i = 0; i < 27; i += 1) {
        await databases.createDocument(DB_ID, "audit_logs", "unique()", {
          action: "Smoke Test",
          details: `Synthetic audit entry ${i + 1}`,
          user: "Smoke Admin",
          timestamp: new Date().toISOString(),
        });
      }
      auditLogsLoaded = false;
    });

    await page.evaluate(() => openAuditModal());
    await page.waitForSelector("#auditPageInfo");
    await expect(page.locator("#auditPageInfo")).toContainText("Page 1");
    await page.click("#auditNextBtn");
    await expect(page.locator("#auditPageInfo")).toContainText("Page 2");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);

    const mobileDisplays = await page.evaluate(() => {
      const tableRow = document.querySelector("#dataTable tbody tr");
      const auditRow = document.querySelector("#auditTableBody tr");
      return {
        stackedRowDisplay: tableRow ? getComputedStyle(tableRow).display : null,
        auditRowDisplay: auditRow ? getComputedStyle(auditRow).display : null,
      };
    });

    expect(mobileDisplays.stackedRowDisplay).toBe("block");
    expect(mobileDisplays.auditRowDisplay).toBe("table-row");
    expect(pageErrors).toEqual([]);
  });
});
