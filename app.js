/* ==========================================================================
   CHICKCHECK — POULTRY & SMART FARM MANAGEMENT APP LOGIC
   Features: Ongoing Batches Dashboard Cards, Auto RFQ Generation,
   40-Day Flock Ledger (Mortality, Feed Intake Std/Actual, FCR Std/Actual, Bags Stock)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Datasets (No Dummy Data, LocalStorage Persistence)
  let batchData = JSON.parse(localStorage.getItem('chickcheck_batches')) || [];
  let visitsData = JSON.parse(localStorage.getItem('chickcheck_visits')) || [];
  let medicineData = JSON.parse(localStorage.getItem('chickcheck_medicine')) || [];
  let medicineDetailsData = JSON.parse(localStorage.getItem('chickcheck_medicine_details')) || [];
  let expenditureData = JSON.parse(localStorage.getItem('chickcheck_expenditure')) || [];
  let historyData = JSON.parse(localStorage.getItem('chickcheck_history')) || [];

  let selectedBatchIndex = 0;
  let editingDayIndex = 1;
  let tempParticularsList = [];

  // DOM Elements
  const sidebar = document.getElementById('sidebar');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const menuItems = document.querySelectorAll('.menu-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  const globalSearchInput = document.getElementById('global-search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const searchResultsDropdown = document.getElementById('search-results-dropdown');
  const searchResultsList = document.getElementById('search-results-list');
  const searchCountLabel = document.getElementById('search-count-label');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');

  const modalOverlay = document.getElementById('modal-overlay');
  const autoBatchRfqInput = document.getElementById('auto-batch-rfq');

  // Standard Industry Broiler Benchmarks for 40 Days (Feed Intake g/chick & FCR)
  function getStandardBenchmark(day) {
    // Standard Feed Intake per Chick per Day (grams)
    const stdFeed = Math.round(10 + day * 4.8); 
    // Standard Feed Conversion Ratio
    const stdFcr = (0.85 + (day * 0.02)).toFixed(2);
    return { stdFeed, stdFcr };
  }

  // Initialize App
  initApp();

  function initApp() {
    renderAll();
    setupEventListeners();
  }

  function renderAll() {
    renderDashboard();
    renderBatches();
    renderVisits();
    renderMedicine();
    renderMedicineDetails();
    renderExpenditure();
    renderHistory();
  }

  /* -------------------------------------------------------------------------- */
  /* TAB NAVIGATION                                                             */
  /* -------------------------------------------------------------------------- */

  function switchTab(tabId) {
    menuItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });

    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* -------------------------------------------------------------------------- */
  /* RFQ GENERATOR & 40-DAY MULTI-COLUMN LEDGER                                */
  /* -------------------------------------------------------------------------- */

  function generateAutoRfq() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `RFQ-CHK-2026-${randomNum}`;
  }

  function render40DayTracker(batch) {
    const tbody = document.getElementById('day-40-tracking-tbody');
    if (!tbody) return;

    if (!batch) {
      tbody.innerHTML = `
        <tr>
          <td colspan="15">
            <div class="empty-state">
              <div class="empty-icon"><i class="fa-solid fa-calendar-days"></i></div>
              <h3>No Ongoing Batch Selected</h3>
              <p>Click "Start a New Batch" to generate your 40-day flock performance ledger.</p>
              <button class="btn btn-primary open-modal-btn" data-modal="modal-batch">
                <i class="fa-solid fa-plus"></i> Start a New Batch
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const startDate = new Date(batch.startDate || Date.now());
    const initialCount = Number(batch.count) || 1000;
    const initialBags = Number(batch.initialBags) || 50;

    let cumulativeMortality = 0;
    let totalBagsConsumed = 0;
    let totalBagsDelivered = initialBags;

    // Ensure dailyRecords array exists for the batch
    if (!batch.dailyRecords) {
      batch.dailyRecords = {};
    }

    let rowsHtml = '';

    // Generate 40 Rows for the 40-Day Duration
    for (let day = 1; day <= 40; day++) {
      const currentDayDate = new Date(startDate);
      currentDayDate.setDate(startDate.getDate() + (day - 1));
      const formattedDate = currentDayDate.toISOString().split('T')[0];

      // Get logged daily data or defaults
      const dayRecord = batch.dailyRecords[day] || {
        mortality: 0,
        feedActual: '',
        fcrActual: '',
        bagsDelivered: 0,
        bagsConsumed: 0
      };

      const dailyMortality = Number(dayRecord.mortality) || 0;
      cumulativeMortality += dailyMortality;
      const cumMortalityPct = ((cumulativeMortality / initialCount) * 100).toFixed(2);

      const benchmark = getStandardBenchmark(day);

      const bagsDeliveredToday = Number(dayRecord.bagsDelivered) || 0;
      totalBagsDelivered += bagsDeliveredToday;

      const bagsConsumedToday = Number(dayRecord.bagsConsumed) || 0;
      totalBagsConsumed += bagsConsumedToday;

      const remainingBags = Math.max(0, totalBagsDelivered - totalBagsConsumed);

      rowsHtml += `
        <tr>
          <td><strong>${formattedDate}</strong></td>
          <td><span class="day-badge">Day ${day}</span></td>
          
          <!-- Mortality Group -->
          <td style="color:${dailyMortality > 0 ? '#EF4444' : 'inherit'}; font-weight:${dailyMortality > 0 ? '700' : '400'}">${dailyMortality}</td>
          <td><strong>${cumulativeMortality}</strong></td>
          <td><span class="status-pill ${cumMortalityPct > 5 ? 'custard' : 'success'}">${cumMortalityPct}%</span></td>
          
          <!-- Feed Intake Group -->
          <td style="color:var(--text-muted);">${benchmark.stdFeed}g</td>
          <td><strong style="color:var(--flamingo-primary);">${dayRecord.feedActual ? dayRecord.feedActual + 'g' : '—'}</strong></td>
          
          <!-- FCR Group -->
          <td style="color:var(--text-muted);">${benchmark.stdFcr}</td>
          <td><strong style="color:var(--flamingo-primary);">${dayRecord.fcrActual || '—'}</strong></td>
          
          <!-- Feed In Bags Group -->
          <td>${bagsDeliveredToday > 0 ? `+${bagsDeliveredToday}` : '0'}</td>
          <td>${bagsConsumedToday}</td>
          <td><strong>${totalBagsConsumed}</strong></td>
          <td><strong style="color:${remainingBags < 10 ? '#EF4444' : 'var(--text-main)'}">${remainingBags}</strong></td>

          <!-- Actions -->
          <td>
            <button class="btn btn-outline-sm open-log-day-btn" data-day="${day}">
              <i class="fa-solid fa-pen"></i> Log Day ${day}
            </button>
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;
  }

  /* -------------------------------------------------------------------------- */
  /* REAL-TIME SEARCH                                                           */
  /* -------------------------------------------------------------------------- */

  function handleGlobalSearch() {
    const query = globalSearchInput.value.toLowerCase().trim();

    if (!query) {
      searchResultsDropdown.classList.add('hidden');
      searchClearBtn.classList.add('hidden');
      return;
    }

    searchClearBtn.classList.remove('hidden');

    let matches = [];

    batchData.forEach((b, idx) => {
      if (b.name.toLowerCase().includes(query) || b.rfq.toLowerCase().includes(query)) {
        matches.push({ type: 'Ongoing Batch', title: `${b.name} (${b.rfq})`, sub: `Count: ${b.count}`, tab: 'tab-batches', batchIdx: idx });
      }
    });

    visitsData.forEach(v => {
      if (v.officer.toLowerCase().includes(query) || v.purpose.toLowerCase().includes(query)) {
        matches.push({ type: '3. Visits', title: v.purpose, sub: `Visitor: ${v.officer}`, tab: 'tab-visits' });
      }
    });

    medicineData.forEach(m => {
      if (m.name.toLowerCase().includes(query) || m.target.toLowerCase().includes(query)) {
        matches.push({ type: '4. Medicine', title: m.name, sub: `Stock: ${m.stock} ${m.unit}`, tab: 'tab-medicine' });
      }
    });

    expenditureData.forEach(e => {
      if (e.desc.toLowerCase().includes(query) || e.category.toLowerCase().includes(query)) {
        matches.push({ type: '5. Farmer Expenditure', title: e.desc, sub: `₹ ${Number(e.amount).toLocaleString()}`, tab: 'tab-expenditure' });
      }
    });

    historyData.forEach(h => {
      if (h.desc.toLowerCase().includes(query) || h.code.toLowerCase().includes(query)) {
        matches.push({ type: '6. History', title: h.desc, sub: `Code: ${h.code}`, tab: 'tab-history' });
      }
    });

    searchCountLabel.textContent = `${matches.length} matches`;

    if (matches.length === 0) {
      searchResultsList.innerHTML = `<div style="padding:1.2rem; text-align:center; color:var(--text-muted);">No matching ChickCheck records found</div>`;
    } else {
      searchResultsList.innerHTML = matches.slice(0, 6).map(m => `
        <div class="search-result-item" data-tab="${m.tab}" data-batch-idx="${m.batchIdx !== undefined ? m.batchIdx : ''}">
          <div style="display:flex; flex-direction:column;">
            <span style="font-weight:700; font-size:0.9rem;">${escapeHtml(m.title)}</span>
            <span style="font-size:0.75rem; color:var(--text-muted);"><strong style="color:var(--flamingo-primary)">[${m.type}]</strong> ${escapeHtml(m.sub)}</span>
          </div>
        </div>
      `).join('');
    }

    searchResultsDropdown.classList.remove('hidden');
  }

  /* -------------------------------------------------------------------------- */
  /* RENDERING FUNCTIONS                                                        */
  /* -------------------------------------------------------------------------- */

  function renderDashboard() {
    const badgeBatchesCount = document.getElementById('badge-batches-count');
    if (badgeBatchesCount) badgeBatchesCount.textContent = batchData.length;

    const badgeVisitsCount = document.getElementById('badge-visits-count');
    if (badgeVisitsCount) badgeVisitsCount.textContent = visitsData.length;

    const badgeMedicineCount = document.getElementById('badge-medicine-count');
    if (badgeMedicineCount) badgeMedicineCount.textContent = medicineData.length;

    const badgeHistoryCount = document.getElementById('badge-history-count');
    if (badgeHistoryCount) badgeHistoryCount.textContent = historyData.length;

    document.getElementById('metric-total-batches').textContent = `${batchData.length} Ongoing`;

    const totalExp = expenditureData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    document.getElementById('metric-total-expenditure').textContent = `₹ ${totalExp.toLocaleString()}`;

    const lowMedCount = medicineData.filter(m => m.stock < 15).length;
    document.getElementById('metric-low-medicine').textContent = `${lowMedCount} Alerts`;

    const upcomingVisits = visitsData.filter(v => v.status === 'Scheduled').length;
    document.getElementById('metric-upcoming-visits').textContent = `${upcomingVisits} Scheduled`;

    // Render Ongoing Batches Dashboard Cards Section
    const dashOngoingContainer = document.getElementById('dash-ongoing-batches-container');
    if (batchData.length === 0) {
      dashOngoingContainer.innerHTML = `
        <div class="empty-state full-width" style="grid-column: 1 / -1;">
          <div class="empty-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
          <h3>No Active Ongoing Batches</h3>
          <p>Click below to start a new batch with auto RFQ generation and 40-day flock performance tracking.</p>
          <button class="btn btn-primary open-modal-btn" data-modal="modal-batch">
            <i class="fa-solid fa-plus"></i> Start a New Batch
          </button>
        </div>
      `;
    } else {
      dashOngoingContainer.innerHTML = batchData.map((b, idx) => {
        // Calculate batch summary stats
        let totalMort = 0;
        let totalBags = Number(b.initialBags) || 50;
        let consumedBags = 0;

        if (b.dailyRecords) {
          Object.values(b.dailyRecords).forEach(r => {
            totalMort += Number(r.mortality) || 0;
            totalBags += Number(r.bagsDelivered) || 0;
            consumedBags += Number(r.bagsConsumed) || 0;
          });
        }

        const remainingBags = Math.max(0, totalBags - consumedBags);
        const mortPct = (((totalMort) / Number(b.count)) * 100).toFixed(1);

        return `
          <div class="ongoing-batch-card">
            <div class="ongoing-card-header">
              <div>
                <h4 class="ongoing-card-title">${escapeHtml(b.name)}</h4>
                <span style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(b.location)}</span>
              </div>
              <span class="ongoing-card-rfq">#${b.rfq}</span>
            </div>

            <div class="ongoing-meta-grid">
              <div class="meta-box">
                <span class="meta-lbl">Initial Count</span>
                <span class="meta-num">${b.count} chicks</span>
              </div>
              <div class="meta-box">
                <span class="meta-lbl">Mortality Rate</span>
                <span class="meta-num" style="color:#EF4444">${totalMort} (${mortPct}%)</span>
              </div>
              <div class="meta-box">
                <span class="meta-lbl">Feed Consumed</span>
                <span class="meta-num">${consumedBags} bags</span>
              </div>
              <div class="meta-box">
                <span class="meta-lbl">Remaining Stock</span>
                <span class="meta-num" style="color:var(--flamingo-primary)">${remainingBags} bags</span>
              </div>
            </div>

            <button class="btn btn-primary-sm open-batch-ledger-btn" data-batch-idx="${idx}" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-table"></i> Open 40-Day Performance Ledger
            </button>
          </div>
        `;
      }).join('');
    }

    // Render Dashboard Recent Activity
    const tbody = document.getElementById('dash-activity-tbody');
    if (historyData.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="4"><div style="padding:1rem; text-align:center; color:var(--text-muted);">No activity logs recorded yet.</div></td></tr>
      `;
    } else {
      tbody.innerHTML = historyData.slice(0, 5).map(h => `
        <tr>
          <td style="white-space:nowrap; color:var(--text-muted);">${h.time}</td>
          <td><span class="status-pill primary">${h.module}</span></td>
          <td>${escapeHtml(h.desc)}</td>
          <td><strong>ChickCheck Admin</strong></td>
        </tr>
      `).join('');
    }
  }

  function populateVisitBatchDropdown() {
    const select = document.getElementById('visit-batch-select');
    if (!select) return;

    if (batchData.length === 0) {
      select.innerHTML = `<option value="" disabled selected>-- No batches found (Please start a New Batch first) --</option>`;
      return;
    }

    select.innerHTML = `
      <option value="">-- Select Assigned Batch --</option>
      ${batchData.map(b => {
        const isCompleted = b.status === 'Completed';
        const statusText = isCompleted ? ' [Completed Batch - Cannot Select]' : ' [Active Ongoing]';
        return `
          <option value="${escapeHtml(b.name)} (${b.rfq})" ${isCompleted ? 'disabled style="color:#A09096; background:#F4ECE1; font-style:italic;"' : ''}>
            ${escapeHtml(b.name)} (${b.rfq})${statusText}
          </option>
        `;
      }).join('')}
    `;
  }

  function renderBatches() {
    const batchSelectorBar = document.getElementById('batch-selector-bar');
    const activeBatchSelect = document.getElementById('active-batch-select');
    const activeBatchRfqBadge = document.getElementById('active-batch-rfq-badge');
    const trackerBatchTitle = document.getElementById('tracker-batch-title');
    const completeBatchToggleBtn = document.getElementById('complete-batch-toggle-btn');

    if (batchData.length === 0) {
      batchSelectorBar.classList.add('hidden');
      render40DayTracker(null);
    } else {
      batchSelectorBar.classList.remove('hidden');
      
      activeBatchSelect.innerHTML = batchData.map((b, idx) => `
        <option value="${idx}" ${idx === selectedBatchIndex ? 'selected' : ''}>${escapeHtml(b.name)} (${b.rfq}) ${b.status === 'Completed' ? '[Completed]' : ''}</option>
      `).join('');

      const currentBatch = batchData[selectedBatchIndex] || batchData[0];
      const isCompleted = currentBatch.status === 'Completed';

      activeBatchRfqBadge.innerHTML = `RFQ: #${currentBatch.rfq} ${isCompleted ? '<span class="status-pill dull" style="margin-left:0.4rem;">Completed</span>' : '<span class="status-pill success" style="margin-left:0.4rem;">Ongoing</span>'}`;
      trackerBatchTitle.innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${escapeHtml(currentBatch.name)} — 40-Day Performance Ledger`;

      if (completeBatchToggleBtn) {
        completeBatchToggleBtn.innerHTML = isCompleted ? `<i class="fa-solid fa-rotate-left"></i> Reopen Batch` : `<i class="fa-solid fa-circle-check"></i> Complete Batch`;
      }

      render40DayTracker(currentBatch);
    }
  }

  function renderVisits() {
    populateVisitBatchDropdown();
    const tbody = document.getElementById('visits-table-tbody');
    if (!tbody) return;

    if (visitsData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon"><i class="fa-solid fa-user-doctor"></i></div>
              <h3>No Visit Records Found</h3>
              <p>Click "Add Visit" to log supervisor, feed supplier, or vet inspection details.</p>
              <button class="btn btn-primary open-modal-btn" data-modal="modal-visit">
                <i class="fa-solid fa-plus"></i> Add Visit
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = visitsData.map(v => {
        const visitorName = v.visitorName || v.officer || 'Visitor';
        const designation = v.designation || v.purpose || 'Inspector';
        const assignedBatch = v.batch || 'N/A';
        const feedback = v.feedbacks || v.notes || 'No feedback recorded';
        const status = v.status || 'Satisfied';

        const isSatisfied = status === 'Satisfied';
        const statusClass = isSatisfied ? 'satisfied' : 'unsatisfied';
        const statusIcon = isSatisfied ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';

        // Check if assigned batch is completed
        const foundBatch = batchData.find(b => `${b.name} (${b.rfq})` === assignedBatch);
        const isCompletedBatch = foundBatch && foundBatch.status === 'Completed';
        const batchBadgeClass = isCompletedBatch ? 'status-pill dull' : 'status-pill primary';

        return `
          <tr>
            <td><strong>${v.date}</strong></td>
            <td><strong>${escapeHtml(visitorName)}</strong></td>
            <td><span class="status-pill custard">${escapeHtml(designation)}</span></td>
            <td><span class="${batchBadgeClass}">${escapeHtml(assignedBatch)} ${isCompletedBatch ? '(Completed)' : ''}</span></td>
            <td>${escapeHtml(feedback)}</td>
            <td><span class="status-pill ${statusClass}">${statusIcon} ${escapeHtml(status)}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  function renderMedicine() {
    const tbody = document.getElementById('medicine-table-tbody');
    if (medicineData.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7"><div class="empty-state"><h3>No Medicine Records Found</h3><p>Add poultry medications and vaccination schedules.</p></div></td></tr>
      `;
    } else {
      tbody.innerHTML = medicineData.map((m, idx) => `
        <tr>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td>${escapeHtml(m.target)}</td>
          <td><strong style="font-size:1.1rem;">${m.stock}</strong></td>
          <td>${escapeHtml(m.unit)}</td>
          <td>${m.expiry}</td>
          <td><span class="status-pill ${m.stock < 15 ? 'custard' : 'success'}">${m.stock < 15 ? 'Low Stock' : 'Adequate'}</span></td>
          <td>
            <button class="btn btn-ghost-sm" onclick="deleteMedicine(${idx})"><i class="fa-solid fa-trash" style="color:#FF5E7E"></i></button>
          </td>
        </tr>
      `).join('');
    }
  }

  function renderMedicineDetails() {
    const tbody = document.getElementById('medicine-details-table-tbody');
    if (!tbody) return;

    if (medicineDetailsData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <div class="empty-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
              <h3>No Medicine Bill Details Logged</h3>
              <p>Click "Add Medicine Details" to record bill dates, bill numbers, liquid particulars, and quantity in Liters.</p>
              <button class="btn btn-primary open-modal-btn" data-modal="modal-medicine-details">
                <i class="fa-solid fa-plus"></i> Add Medicine Details
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = medicineDetailsData.map((d, idx) => {
        const particularsChips = (d.particularsList || []).map(p => `
          <span class="particular-chip"><i class="fa-solid fa-flask"></i> ${escapeHtml(p.name)} (${p.qtyLiters} L)</span>
        `).join(' ');

        const totalLiters = (d.particularsList || []).reduce((sum, p) => sum + Number(p.qtyLiters || 0), 0);

        return `
          <tr>
            <td><strong>${d.date}</strong></td>
            <td><span class="status-pill custard">#${escapeHtml(d.billNo)}</span></td>
            <td><div style="display:flex; flex-wrap:wrap; gap:0.4rem;">${particularsChips || '—'}</div></td>
            <td><strong style="color:var(--flamingo-primary); font-size:1.05rem;">${totalLiters.toFixed(1)} Liters</strong></td>
            <td>
              <button class="btn btn-ghost-sm" onclick="deleteMedicineDetails(${idx})"><i class="fa-solid fa-trash" style="color:#FF5E7E"></i></button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  function renderExpenditure() {
    const tbody = document.getElementById('expenditure-table-tbody');
    if (expenditureData.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6"><div class="empty-state"><h3>No Expenditure Records Found</h3><p>Track feed, labor, equipment, and medical costs.</p></div></td></tr>
      `;
    } else {
      tbody.innerHTML = expenditureData.map(e => `
        <tr>
          <td>${e.date}</td>
          <td><span class="status-pill custard">${escapeHtml(e.category)}</span></td>
          <td><strong>${escapeHtml(e.desc)}</strong></td>
          <td>${escapeHtml(e.vendor)}</td>
          <td><strong style="color:var(--flamingo-primary); font-size:1.05rem;">₹ ${Number(e.amount).toLocaleString()}</strong></td>
          <td><span class="status-pill success">${e.status}</span></td>
        </tr>
      `).join('');
    }
  }

  function renderHistory() {
    const tbody = document.getElementById('history-table-tbody');
    if (historyData.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5"><div class="empty-state"><h3>No Activity History Found</h3></div></td></tr>
      `;
    } else {
      tbody.innerHTML = historyData.map(h => `
        <tr>
          <td style="white-space:nowrap;">${h.time}</td>
          <td><span class="status-pill primary">${h.module}</span></td>
          <td>${escapeHtml(h.desc)}</td>
          <td><strong style="color:var(--flamingo-primary)">${h.code}</strong></td>
          <td><span class="status-pill success">${h.status}</span></td>
        </tr>
      `).join('');
    }
  }

  /* -------------------------------------------------------------------------- */
  /* EVENT LISTENERS                                                            */
  /* -------------------------------------------------------------------------- */

  function setupEventListeners() {
    menuItems.forEach(item => {
      item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    document.body.addEventListener('click', (e) => {
      // Open ledger from dashboard card
      const openLedgerBtn = e.target.closest('.open-batch-ledger-btn');
      if (openLedgerBtn) {
        selectedBatchIndex = Number(openLedgerBtn.dataset.batchIdx);
        switchTab('tab-batches');
        renderBatches();
        return;
      }

      // Open Day Log Modal
      const logDayBtn = e.target.closest('.open-log-day-btn');
      if (logDayBtn) {
        editingDayIndex = Number(logDayBtn.dataset.day);
        document.getElementById('modal-day-label').textContent = `Day ${editingDayIndex}`;
        document.getElementById('log-day-index').value = editingDayIndex;
        
        // Pre-fill existing record if available
        const currentBatch = batchData[selectedBatchIndex];
        if (currentBatch && currentBatch.dailyRecords && currentBatch.dailyRecords[editingDayIndex]) {
          const rec = currentBatch.dailyRecords[editingDayIndex];
          document.getElementById('input-day-mortality').value = rec.mortality || 0;
          document.getElementById('input-day-feed-actual').value = rec.feedActual || '';
          document.getElementById('input-day-fcr-actual').value = rec.fcrActual || '';
          document.getElementById('input-day-bags-consumed').value = rec.bagsConsumed || 0;
          document.getElementById('input-day-bags-delivered').value = rec.bagsDelivered || 0;
        }

        openModal('modal-log-day');
        return;
      }

      const btn = e.target.closest('.switch-tab-btn, .metric-card');
      if (btn && btn.dataset.target) {
        switchTab(btn.dataset.target);
      }
    });

    sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    globalSearchInput.addEventListener('input', handleGlobalSearch);
    searchClearBtn.addEventListener('click', () => {
      globalSearchInput.value = '';
      handleGlobalSearch();
    });

    searchResultsList.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item && item.dataset.tab) {
        if (item.dataset.batchIdx !== '') {
          selectedBatchIndex = Number(item.dataset.batchIdx);
        }
        switchTab(item.dataset.tab);
        renderBatches();
        searchResultsDropdown.classList.add('hidden');
        globalSearchInput.value = '';
      }
    });

    document.getElementById('active-batch-select')?.addEventListener('change', (e) => {
      selectedBatchIndex = Number(e.target.value);
      renderBatches();
    });

    // Modals Handling
    document.body.addEventListener('click', (e) => {
      const openBtn = e.target.closest('.open-modal-btn, #quick-add-btn');
      if (openBtn) {
        const modalId = openBtn.dataset.modal || 'modal-batch';
        if (modalId === 'modal-batch' && autoBatchRfqInput) {
          autoBatchRfqInput.value = generateAutoRfq();
        }
        openModal(modalId);
      }

      if (e.target.closest('.modal-close-btn, .close-modal-btn')) {
        closeModal();
      }
    });

    // Form: Start a New Batch
    document.getElementById('form-add-batch').addEventListener('submit', (e) => {
      e.preventDefault();
      const rfqCode = autoBatchRfqInput.value || generateAutoRfq();
      const batchName = document.getElementById('batch-name-input').value.trim();

      const newBatch = {
        rfq: rfqCode,
        name: batchName,
        count: Number(document.getElementById('batch-count').value),
        initialBags: Number(document.getElementById('batch-initial-bags').value) || 50,
        startDate: new Date().toISOString().split('T')[0],
        location: document.getElementById('batch-location').value.trim() || 'Shed 1',
        dailyRecords: {}
      };

      batchData.unshift(newBatch);
      selectedBatchIndex = 0;
      localStorage.setItem('chickcheck_batches', JSON.stringify(batchData));

      historyData.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        time: 'Just Now',
        module: '2. New Batch',
        desc: `Started Batch '${newBatch.name}' (${newBatch.rfq}, ${newBatch.count} count)`,
        code: newBatch.rfq,
        status: 'Active'
      });
      localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

      renderAll();
      closeModal();
      switchTab('tab-batches');
      showToast(`Batch '${newBatch.name}' (${newBatch.rfq}) displayed on Dashboard!`, 'success');
    });

    // Form: Save Daily Record Entry
    document.getElementById('form-log-day').addEventListener('submit', (e) => {
      e.preventDefault();
      const dayNum = Number(document.getElementById('log-day-index').value);
      const currentBatch = batchData[selectedBatchIndex];

      if (currentBatch) {
        if (!currentBatch.dailyRecords) currentBatch.dailyRecords = {};

        currentBatch.dailyRecords[dayNum] = {
          mortality: Number(document.getElementById('input-day-mortality').value) || 0,
          feedActual: document.getElementById('input-day-feed-actual').value,
          fcrActual: document.getElementById('input-day-fcr-actual').value,
          bagsConsumed: Number(document.getElementById('input-day-bags-consumed').value) || 0,
          bagsDelivered: Number(document.getElementById('input-day-bags-delivered').value) || 0
        };

        localStorage.setItem('chickcheck_batches', JSON.stringify(batchData));

        historyData.unshift({
          id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
          time: 'Just Now',
          module: '2. New Batch',
          desc: `Updated Day ${dayNum} record for Batch '${currentBatch.name}' (${currentBatch.rfq})`,
          code: currentBatch.rfq,
          status: 'Updated'
        });
        localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

        renderAll();
        closeModal();
        showToast(`Day ${dayNum} performance log updated!`, 'success');
      }
    });

    // Form Add Medicine
    document.getElementById('form-add-medicine').addEventListener('submit', (e) => {
      e.preventDefault();
      const newMed = {
        name: document.getElementById('med-name').value.trim(),
        target: document.getElementById('med-target').value.trim() || 'Flock Herd',
        stock: Number(document.getElementById('med-stock').value),
        unit: document.getElementById('med-unit').value.trim(),
        expiry: document.getElementById('med-expiry').value,
        status: 'Adequate'
      };

      medicineData.unshift(newMed);
      localStorage.setItem('chickcheck_medicine', JSON.stringify(medicineData));

      historyData.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        time: 'Just Now',
        module: '4. Medicine',
        desc: `Added stock for ${newMed.name} (${newMed.stock} ${newMed.unit})`,
        code: 'MED-' + Math.floor(100 + Math.random() * 900),
        status: 'Completed'
      });
      localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

      renderAll();
      closeModal();
      showToast('Medicine stock saved!', 'success');
    });

    // Form Add Expenditure
    document.getElementById('form-add-expenditure').addEventListener('submit', (e) => {
      e.preventDefault();
      const newExp = {
        date: new Date().toISOString().split('T')[0],
        category: document.getElementById('exp-category').value,
        desc: document.getElementById('exp-desc').value.trim(),
        vendor: document.getElementById('exp-vendor').value.trim() || 'Poultry Supplier',
        amount: Number(document.getElementById('exp-amount').value),
        status: 'Paid'
      };

      expenditureData.unshift(newExp);
      localStorage.setItem('chickcheck_expenditure', JSON.stringify(expenditureData));

      historyData.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        time: 'Just Now',
        module: '5. Farmer Expenditure',
        desc: `Logged ${newExp.category} expense (₹ ${newExp.amount})`,
        code: 'EXP-' + Math.floor(100 + Math.random() * 900),
        status: 'Paid'
      });
      localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

      renderAll();
      closeModal();
      showToast('Expense logged successfully!', 'success');
    });

    // Visitor Name Input Validation (Disallow numbers and special characters)
    const visitorNameInput = document.getElementById('visit-visitor-name');
    const errVisitorName = document.getElementById('err-visitor-name');

    if (visitorNameInput) {
      visitorNameInput.addEventListener('input', function() {
        const sanitized = this.value.replace(/[^a-zA-Z\s]/g, '');
        if (sanitized !== this.value) {
          if (errVisitorName) errVisitorName.classList.remove('hidden');
          this.value = sanitized;
          setTimeout(() => {
            if (errVisitorName) errVisitorName.classList.add('hidden');
          }, 2500);
        } else {
          if (errVisitorName) errVisitorName.classList.add('hidden');
        }
      });
    }

    // Complete / Reopen Batch Toggle Handler
    const completeBatchToggleBtn = document.getElementById('complete-batch-toggle-btn');
    if (completeBatchToggleBtn) {
      completeBatchToggleBtn.addEventListener('click', () => {
        const currentBatch = batchData[selectedBatchIndex];
        if (currentBatch) {
          currentBatch.status = currentBatch.status === 'Completed' ? 'Active' : 'Completed';
          localStorage.setItem('chickcheck_batches', JSON.stringify(batchData));
          
          historyData.unshift({
            id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
            time: 'Just Now',
            module: '2. New Batch',
            desc: `Changed Batch '${currentBatch.name}' (${currentBatch.rfq}) status to '${currentBatch.status}'`,
            code: currentBatch.rfq,
            status: currentBatch.status
          });
          localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

          renderAll();
          showToast(`Batch '${currentBatch.name}' set to ${currentBatch.status}`, 'info');
        }
      });
    }

    // Form Add Visit
    document.getElementById('form-add-visit').addEventListener('submit', (e) => {
      e.preventDefault();

      const rawVisitorName = document.getElementById('visit-visitor-name').value.trim();
      const sanitizedName = rawVisitorName.replace(/[^a-zA-Z\s]/g, '');

      if (!sanitizedName) {
        showToast('Visitor Name can only contain letters and spaces.', 'info');
        return;
      }

      const newVisit = {
        date: document.getElementById('visit-date').value,
        visitorName: sanitizedName,
        designation: document.getElementById('visit-designation-select').value,
        batch: document.getElementById('visit-batch-select').value,
        feedbacks: document.getElementById('visit-feedback-text').value.trim(),
        status: document.getElementById('visit-satisfaction-status').value
      };

      visitsData.unshift(newVisit);
      localStorage.setItem('chickcheck_visits', JSON.stringify(visitsData));

      historyData.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        time: 'Just Now',
        module: '3. Visits',
        desc: `Logged Visit for ${newVisit.visitorName} (${newVisit.designation}) — Batch: ${newVisit.batch} [${newVisit.status}]`,
        code: 'VST-' + Math.floor(100 + Math.random() * 900),
        status: newVisit.status
      });
      renderAll();
      closeModal();
      showToast(`Visit record for ${newVisit.visitorName} saved!`, 'success');
    });

    // Particulars & Custom Option Toggle Listener
    const medParticularSelect = document.getElementById('med-particular-select');
    const customParticularGroup = document.getElementById('custom-particular-group');
    const btnAddParticularItem = document.getElementById('btn-add-particular-item');
    const particularsAddedList = document.getElementById('particulars-added-list');

    if (medParticularSelect) {
      medParticularSelect.addEventListener('change', function() {
        if (this.value === 'CUSTOM_OPTION') {
          customParticularGroup.classList.remove('hidden');
          document.getElementById('med-custom-particular-input').focus();
        } else {
          customParticularGroup.classList.add('hidden');
        }
      });
    }

    if (btnAddParticularItem) {
      btnAddParticularItem.addEventListener('click', () => {
        let particularName = '';
        const selectVal = medParticularSelect.value;

        if (selectVal === 'CUSTOM_OPTION') {
          particularName = document.getElementById('med-custom-particular-input').value.trim();
        } else {
          particularName = selectVal;
        }

        const qtyLiters = parseFloat(document.getElementById('med-particular-qty').value);

        if (!particularName) {
          showToast('Please select or type a medicine particular.', 'info');
          return;
        }

        if (isNaN(qtyLiters) || qtyLiters <= 0) {
          showToast('Please enter a valid quantity in liters (e.g. 2.5).', 'info');
          return;
        }

        tempParticularsList.push({ name: particularName, qtyLiters });
        renderParticularChips();

        // Reset item fields
        medParticularSelect.value = '';
        customParticularGroup.classList.add('hidden');
        document.getElementById('med-custom-particular-input').value = '';
        document.getElementById('med-particular-qty').value = '';
      });
    }

    function renderParticularChips() {
      if (!particularsAddedList) return;
      if (tempParticularsList.length === 0) {
        particularsAddedList.innerHTML = `<span style="color: var(--text-muted); font-size: 0.82rem; font-style: italic;">No particulars added yet. Select or type a particular above and click "+ Add Particular to Bill List".</span>`;
        return;
      }

      particularsAddedList.innerHTML = tempParticularsList.map((p, idx) => `
        <span class="particular-chip">
          <i class="fa-solid fa-flask"></i> ${escapeHtml(p.name)} (${p.qtyLiters} L)
          <span class="particular-chip-remove" onclick="removeTempParticularItem(${idx})">&times;</span>
        </span>
      `).join('');
    }

    window.removeTempParticularItem = function(idx) {
      tempParticularsList.splice(idx, 1);
      renderParticularChips();
    };

    // Form Submit: Add Medicine Details
    const formAddMedDetails = document.getElementById('form-add-medicine-details');
    if (formAddMedDetails) {
      formAddMedDetails.addEventListener('submit', (e) => {
        e.preventDefault();

        // Auto-add input fields if user typed a particular without clicking "+ Add Particular to Bill List"
        let selectVal = medParticularSelect.value;
        let particularName = selectVal === 'CUSTOM_OPTION' ? document.getElementById('med-custom-particular-input').value.trim() : selectVal;
        let qtyLiters = parseFloat(document.getElementById('med-particular-qty').value);

        if (particularName && !isNaN(qtyLiters) && qtyLiters > 0) {
          tempParticularsList.push({ name: particularName, qtyLiters });
          renderParticularChips();
          medParticularSelect.value = '';
          customParticularGroup.classList.add('hidden');
          document.getElementById('med-custom-particular-input').value = '';
          document.getElementById('med-particular-qty').value = '';
        }

        if (tempParticularsList.length === 0) {
          showToast('Please add at least one particular item with quantity in Liters.', 'info');
          return;
        }

        const newMedDetail = {
          date: document.getElementById('med-detail-date').value || new Date().toISOString().split('T')[0],
          billNo: document.getElementById('med-detail-bill-no').value.trim(),
          particularsList: [...tempParticularsList]
        };

        medicineDetailsData.unshift(newMedDetail);
        localStorage.setItem('chickcheck_medicine_details', JSON.stringify(medicineDetailsData));

        const totalLiters = tempParticularsList.reduce((sum, p) => sum + p.qtyLiters, 0);

        historyData.unshift({
          id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
          time: 'Just Now',
          module: '4. Medicine Details',
          desc: `Logged Medicine Bill #${newMedDetail.billNo} with ${tempParticularsList.length} particulars (${totalLiters} Liters total)`,
          code: '#' + newMedDetail.billNo,
          status: 'Recorded'
        });
        localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

        tempParticularsList = [];
        renderParticularChips();

        renderAll();
        closeModal();
        showToast(`Medicine bill #${newMedDetail.billNo} details saved!`, 'success');
      });
    }

    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      themeToggleBtn.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
  }

  function openModal(modalId) {
    modalOverlay.classList.remove('hidden');
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
    document.getElementById(modalId)?.classList.remove('hidden');
    
    if (modalId === 'modal-visit') {
      populateVisitBatchDropdown();
    }

    if (modalId === 'modal-medicine-details') {
      document.getElementById('med-detail-date').value = new Date().toISOString().split('T')[0];
      tempParticularsList = [];
      const container = document.getElementById('particulars-added-list');
      if (container) {
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.82rem; font-style: italic;">No particulars added yet. Select or type a particular above and click "+ Add Particular to Bill List".</span>`;
      }
    }
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
    document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
  }

  window.deleteMedicine = function(idx) {
    medicineData.splice(idx, 1);
    localStorage.setItem('chickcheck_medicine', JSON.stringify(medicineData));
    renderAll();
    showToast('Medicine record deleted', 'info');
  };

  window.deleteMedicineDetails = function(idx) {
    medicineDetailsData.splice(idx, 1);
    localStorage.setItem('chickcheck_medicine_details', JSON.stringify(medicineDetailsData));
    renderAll();
    showToast('Medicine details bill deleted', 'info');
  };

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

});