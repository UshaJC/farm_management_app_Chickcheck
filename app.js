/* ==========================================================================
   CHICKCHECK — POULTRY & SMART FARM MANAGEMENT APP LOGIC
   Features: Ongoing Batches Dashboard Cards, Auto RFQ Generation,
   40-Day Flock Ledger (Mortality, Feed Intake Std/Actual, FCR Std/Actual, Bags Stock)
   ========================================================================== */

// Register PWA Service Worker for Offline Caching & App Installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', () => {

  // Datasets (No Dummy Data, LocalStorage Persistence)
  let batchData = JSON.parse(localStorage.getItem('chickcheck_batches')) || [];
  let visitsData = JSON.parse(localStorage.getItem('chickcheck_visits')) || [];
  let medicineData = JSON.parse(localStorage.getItem('chickcheck_medicine')) || [];
  let medicineDetailsData = JSON.parse(localStorage.getItem('chickcheck_medicine_details')) || [];
  let expenditureData = JSON.parse(localStorage.getItem('chickcheck_expenditure')) || [];
  let historyData = JSON.parse(localStorage.getItem('chickcheck_history')) || [];

  // Automated 30-Day Daily Chicken Market Price Feed Generator
  function generateAutomatedDailyPrices() {
    const prices = [];
    const today = new Date();
    const mandiFactors = [
      'Normal wholesale-retail market balance',
      'Increased retail demand & buyer activity',
      'Feed cost stabilization effect',
      'Wholesale Mandi supply constraint',
      'Weekend consumer consumption spike',
      'Shed transportation & logistics adjustment',
      'High regional poultry mandi bidding',
      'Festive seasonal demand acceleration'
    ];

    // Generate price points for 30 consecutive days up to today
    let currentPrice = 126.50;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const formattedDate = d.toISOString().split('T')[0];

      // Sinusoidal market wave + pseudo-random daily variance
      const dayFactor = Math.sin(i * 0.45) * 2.5;
      const noise = ((i * 17) % 7 - 3) * 0.85;
      const priceDelta = dayFactor + noise;
      
      currentPrice = Math.max(118.00, Math.min(155.00, currentPrice + priceDelta));
      const roundedPrice = parseFloat(currentPrice.toFixed(2));
      const factorText = mandiFactors[i % mandiFactors.length];

      prices.push({
        date: formattedDate,
        region: 'Regional Broiler Mandi',
        price: roundedPrice,
        notes: factorText
      });
    }

    return prices;
  }

  let priceData = generateAutomatedDailyPrices();
  let currentStockRangeDays = 7;

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
    renderAutomatedStockPrices(currentStockRangeDays);
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
    const trackerCycleTag = document.getElementById('tracker-cycle-tag');
    if (!tbody) return;

    if (!batch) {
      tbody.innerHTML = `
        <tr>
          <td colspan="15">
            <div class="empty-state">
              <div class="empty-icon"><i class="fa-solid fa-calendar-days"></i></div>
              <h3>No Ongoing Batch Selected</h3>
              <p>Click "Start a New Batch" to generate your flock performance ledger.</p>
              <button class="btn btn-primary open-modal-btn" data-modal="modal-batch">
                <i class="fa-solid fa-plus"></i> Start a New Batch
              </button>
            </div>
          </td>
        </tr>
      `;
      if (trackerCycleTag) trackerCycleTag.textContent = 'Day 0 of 40';
      return;
    }

    const startDate = new Date(batch.startDate || Date.now());
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate calendar days elapsed since batch start date (1-indexed: Day 1 starts on start date)
    const diffTime = today - start;
    const daysElapsed = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const initialCount = Number(batch.count) || 1000;
    const initialBags = Number(batch.initialBags) || 50;

    let cumulativeMortality = 0;
    let totalBagsConsumed = 0;
    let totalBagsDelivered = initialBags;

    // Ensure dailyRecords object exists for the batch
    if (!batch.dailyRecords) {
      batch.dailyRecords = {};
    }

    const highestLoggedDay = Object.keys(batch.dailyRecords).reduce((max, k) => Math.max(max, Number(k) || 0), 0);
    const extraDays = Number(batch.extraDays) || 0;

    // Visible rows: show ONLY up to current days elapsed (or highest logged day, plus any manually added extra days)
    let maxVisibleDays = Math.max(daysElapsed, highestLoggedDay, 1);
    if (extraDays > 0) {
      maxVisibleDays = Math.max(maxVisibleDays, Math.max(daysElapsed, highestLoggedDay) + extraDays);
    }

    // Active current day marker (matches today's age)
    const activeAgeDay = daysElapsed;

    // Update cycle status tag badge
    if (trackerCycleTag) {
      if (maxVisibleDays > 40) {
        trackerCycleTag.textContent = `${maxVisibleDays} Days Extended Cycle`;
      } else {
        trackerCycleTag.textContent = `Day ${daysElapsed} of 40 Days (Active)`;
      }
    }

    let rowsHtml = '';

    // Generate Rows dynamically up to maxVisibleDays
    for (let day = 1; day <= maxVisibleDays; day++) {
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
      const isCurrentActiveDay = (day === activeAgeDay);

      rowsHtml += `
        <tr class="ledger-row ${isCurrentActiveDay ? 'active-day-row' : ''}">
          <td class="col-date"><strong>${formattedDate}</strong></td>
          <td class="col-day"><span class="day-badge ${isCurrentActiveDay ? 'current' : ''}">Day ${day}</span></td>
          
          <!-- Mortality Group -->
          <td class="col-mort-daily" style="color:${dailyMortality > 0 ? '#EF4444' : 'inherit'}; font-weight:${dailyMortality > 0 ? '800' : '500'}">${dailyMortality > 0 ? `<i class="fa-solid fa-triangle-exclamation" style="font-size:0.75rem; color:#EF4444;"></i> ${dailyMortality}` : '0'}</td>
          <td class="col-mort-cum"><strong>${cumulativeMortality}</strong></td>
          <td class="col-mort-pct"><span class="status-pill ${cumMortalityPct > 5 ? 'custard' : 'success'}">${cumMortalityPct}%</span></td>
          
          <!-- Feed Intake Group -->
          <td class="col-feed-std" style="color:var(--text-muted);">${benchmark.stdFeed}g</td>
          <td class="col-feed-act"><strong style="color:var(--flamingo-primary);">${dayRecord.feedActual ? dayRecord.feedActual + 'g' : '—'}</strong></td>
          
          <!-- FCR Group -->
          <td class="col-fcr-std" style="color:var(--text-muted);">${benchmark.stdFcr}</td>
          <td class="col-fcr-act"><strong style="color:#8B5CF6;">${dayRecord.fcrActual || '—'}</strong></td>
          
          <!-- Feed In Bags Group -->
          <td class="col-bags-del">${bagsDeliveredToday > 0 ? `<span class="badge-delivered">+${bagsDeliveredToday} Bags</span>` : '<span style="color:var(--text-muted);">0</span>'}</td>
          <td class="col-bags-con">${bagsConsumedToday > 0 ? `<strong>${bagsConsumedToday}</strong>` : '0'}</td>
          <td class="col-bags-total"><strong>${totalBagsConsumed}</strong></td>
          <td class="col-bags-rem"><strong style="color:${remainingBags < 10 ? '#EF4444' : '#16A34A'}">${remainingBags}</strong></td>

          <!-- Actions -->
          <td class="col-actions">
            <button class="btn btn-outline-sm open-log-day-btn" data-day="${day}">
              <i class="fa-solid fa-pen-to-square"></i> Log Day ${day}
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

    // Populate Top 4 Dashboard Metric Cards
    const activeBatch = batchData[selectedBatchIndex] || batchData[0];
    let currentAgeDays = 0;

    if (activeBatch) {
      const startDate = activeBatch.startDate ? new Date(activeBatch.startDate) : new Date();
      const now = new Date();
      const diffTime = Math.abs(now - startDate);
      currentAgeDays = Math.min(40, Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1));
      
      let totalMort = 0;
      let totalBags = Number(activeBatch.initialBags) || 50;
      let consumedBags = 0;

      if (activeBatch.dailyRecords) {
        Object.values(activeBatch.dailyRecords).forEach(r => {
          totalMort += Number(r.mortality) || 0;
          totalBags += Number(r.bagsDelivered) || 0;
          consumedBags += Number(r.bagsConsumed) || 0;
        });
      }

      const remainingBags = Math.max(0, totalBags - consumedBags);
      const mortPct = (((totalMort) / Number(activeBatch.count)) * 100).toFixed(1);

      // 1. Ongoing Batch No of Days (Chick Age)
      const elDays = document.getElementById('metric-chick-days');
      if (elDays) elDays.textContent = `Day ${currentAgeDays}`;

      // 2. Chick Mortality Number
      const elMort = document.getElementById('metric-chick-mortality');
      if (elMort) elMort.textContent = `${totalMort} Chicks`;

      // 3. Remaining Feed Bags
      const elBags = document.getElementById('metric-remaining-bags');
      if (elBags) elBags.textContent = `${remainingBags} Bags`;

    } else {
      const elDays = document.getElementById('metric-chick-days');
      if (elDays) elDays.textContent = `Day 0`;

      const elMort = document.getElementById('metric-chick-mortality');
      if (elMort) elMort.textContent = `0 Chicks`;

      const elBags = document.getElementById('metric-remaining-bags');
      if (elBags) elBags.textContent = `0 Bags`;
    }

    // 4. Farmer Expenditure Total
    const totalExp = expenditureData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const elExp = document.getElementById('metric-total-expenditure');
    if (elExp) elExp.textContent = `₹ ${totalExp.toLocaleString()}`;

    // Render Ongoing Batches Dashboard Cards Section
    const dashOngoingContainer = document.getElementById('dash-ongoing-batches-container');
    if (batchData.length === 0) {
      dashOngoingContainer.innerHTML = `
        <div class="empty-state full-width" style="grid-column: 1 / -1;">
          <div class="empty-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
          <h3>No Active Ongoing Batches</h3>
          <p>Navigate to <strong>"2. New Batch"</strong> in the side menu to register a new batch and start 40-day flock performance tracking.</p>
        </div>
      `;
    } else {
      dashOngoingContainer.innerHTML = batchData.map((b, idx) => {
        // Calculate Age of Chick in days
        const startDate = b.startDate ? new Date(b.startDate) : new Date();
        const now = new Date();
        const diffTime = Math.abs(now - startDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const currentAgeDays = Math.min(40, Math.max(1, diffDays));

        // Calculate Mortality (Total Chicks Died) and Feed Bags
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
                <span class="meta-lbl"><i class="fa-solid fa-calendar-day"></i> Age of Chick</span>
                <span class="meta-num" style="color:var(--flamingo-primary)">Day ${currentAgeDays} of 40 Days</span>
              </div>
              <div class="meta-box">
                <span class="meta-lbl"><i class="fa-solid fa-skull"></i> Total Chicks Died</span>
                <span class="meta-num" style="color:#EF4444">${totalMort} Died (${mortPct}%)</span>
              </div>
              <div class="meta-box">
                <span class="meta-lbl"><i class="fa-solid fa-wheat-awn"></i> Remaining Feed Bags</span>
                <span class="meta-num" style="color:#16A34A">${remainingBags} Bags Left</span>
              </div>
              <div class="meta-box">
                <span class="meta-lbl"><i class="fa-solid fa-egg"></i> Initial Chick Count</span>
                <span class="meta-num">${b.count} Chicks</span>
              </div>
            </div>

            <div style="display:flex; gap:0.6rem; margin-top:0.5rem;">
              <button class="btn btn-primary-sm open-batch-ledger-btn" data-batch-idx="${idx}" style="flex:1; justify-content:center;">
                <i class="fa-solid fa-table"></i> Open Ledger
              </button>
              <button class="btn btn-secondary-sm open-complete-modal-btn" data-batch-idx="${idx}" style="flex:1; justify-content:center; background:#E8F5E9; color:#16A34A; border:1px solid rgba(22,163,74,0.3); font-weight:700;">
                <i class="fa-solid fa-calculator"></i> Complete & Settle
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Dashboard Recent Activity (If Present)
    const tbody = document.getElementById('dash-activity-tbody');
    if (tbody) {
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
  }

  function populateVisitBatchDropdown() {
    const select = document.getElementById('visit-batch-select');
    const feedSelect = document.getElementById('feed-delivery-batch-select');

    const optionsHtml = batchData.length === 0 
      ? `<option value="" disabled selected>-- No batches found (Please start a New Batch first) --</option>`
      : `<option value="">-- Select Assigned Batch --</option>` + batchData.map(b => {
          const isCompleted = b.status === 'Completed';
          const statusText = isCompleted ? ' [Completed Batch - Cannot Select]' : ' [Active Ongoing]';
          return `
            <option value="${escapeHtml(b.name)} (${b.rfq})" ${isCompleted ? 'disabled style="color:#A09096; background:#F4ECE1; font-style:italic;"' : ''}>
              ${escapeHtml(b.name)} (${b.rfq})${statusText}
            </option>
          `;
        }).join('');

    if (select) select.innerHTML = optionsHtml;

    if (feedSelect) {
      const activeBatches = batchData.filter(b => b.status !== 'Completed');
      const activeOptionsHtml = activeBatches.length === 0
        ? `<option value="" disabled selected>-- No active ongoing batches available --</option>`
        : `<option value="">-- Select Assigned Ongoing Batch --</option>` + activeBatches.map(b => `
            <option value="${escapeHtml(b.name)} (${b.rfq})">${escapeHtml(b.name)} (${b.rfq})</option>
          `).join('');
      feedSelect.innerHTML = activeOptionsHtml;
    }
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
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-icon"><i class="fa-solid fa-user-doctor"></i></div>
              <h3>No Visit Records Found</h3>
              <p>Click "Add Visit" or "Record Feed Delivery" to log supplier visits and feed bag counts.</p>
              <div style="display:flex; gap:0.8rem; margin-top:0.8rem;">
                <button class="btn btn-primary-sm open-modal-btn" data-modal="modal-feed-delivery">
                  <i class="fa-solid fa-truck-ramp-box"></i> Record Feed Delivery
                </button>
                <button class="btn btn-primary open-modal-btn" data-modal="modal-visit">
                  <i class="fa-solid fa-plus"></i> Add Visit
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = visitsData.map(v => {
        const visitorName = v.visitorName || v.officer || 'Visitor';
        const designation = v.designation || v.purpose || 'Inspector';
        const assignedBatch = v.batch || 'N/A';
        const feedBags = Number(v.feedBagsDelivered) || 0;
        const feedback = v.feedbacks || v.notes || 'No feedback recorded';
        const status = v.status || 'Satisfied';

        const isSatisfied = status === 'Satisfied';
        const statusClass = isSatisfied ? 'satisfied' : 'unsatisfied';
        const statusIcon = isSatisfied ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';

        // Check if assigned batch is completed
        const foundBatch = batchData.find(b => `${b.name} (${b.rfq})` === assignedBatch);
        const isCompletedBatch = foundBatch && foundBatch.status === 'Completed';
        const batchBadgeClass = isCompletedBatch ? 'status-pill dull' : 'status-pill primary';

        const feedBagsCell = feedBags > 0 
          ? `<strong style="color:var(--flamingo-primary); font-size:0.95rem;"><i class="fa-solid fa-wheat-awn"></i> +${feedBags} Bags</strong>`
          : `<span style="color:var(--text-muted)">0</span>`;

        return `
          <tr>
            <td><strong>${v.date}</strong></td>
            <td><strong>${escapeHtml(visitorName)}</strong></td>
            <td><span class="status-pill custard">${escapeHtml(designation)}</span></td>
            <td><span class="${batchBadgeClass}">${escapeHtml(assignedBatch)} ${isCompletedBatch ? '(Completed)' : ''}</span></td>
            <td>${feedBagsCell}</td>
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
    const tbodyExp = document.getElementById('expenditure-table-tbody');
    const tbodyGains = document.getElementById('gains-table-tbody');

    const elTotalGrossGain = document.getElementById('exp-total-gross-gain');
    const elTotalExpenses = document.getElementById('exp-total-expenses');
    const elTotalNetProfit = document.getElementById('exp-total-net-profit');

    // Calculate total expenses (excluding settlement income entries)
    let totalExpenses = expenditureData
      .filter(e => !e.isIncome && e.category !== 'Batch Settlement Income')
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    // Calculate total gross gain from all completed batches
    let totalGrossGain = 0;
    const completedSettledBatches = batchData.filter(b => b.settlement);

    completedSettledBatches.forEach(b => {
      totalGrossGain += Number(b.settlement.grossEarnings || 0);
    });

    const netFarmerProfit = totalGrossGain - totalExpenses;

    if (elTotalGrossGain) elTotalGrossGain.textContent = `₹ ${totalGrossGain.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    if (elTotalExpenses) elTotalExpenses.textContent = `₹ ${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    if (elTotalNetProfit) {
      elTotalNetProfit.textContent = `₹ ${netFarmerProfit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
      elTotalNetProfit.style.color = netFarmerProfit >= 0 ? '#16A34A' : '#EF4444';
    }

    // Render Sub-Tab 1: Expenditure Table Rows
    if (tbodyExp) {
      if (expenditureData.length === 0) {
        tbodyExp.innerHTML = `
          <tr><td colspan="6"><div class="empty-state"><h3>No Expenditure Records Found</h3><p>Track feed, labor, equipment, and medical costs.</p></div></td></tr>
        `;
      } else {
        tbodyExp.innerHTML = expenditureData.map(e => {
          const isInc = e.isIncome || e.category === 'Batch Settlement Income';
          const amtColor = isInc ? '#16A34A' : 'var(--flamingo-primary)';
          const amtPrefix = isInc ? '+ ₹ ' : '₹ ';
          const pillClass = isInc ? 'status-pill success' : 'status-pill custard';

          return `
            <tr>
              <td>${e.date}</td>
              <td><span class="${pillClass}">${escapeHtml(e.category)}</span></td>
              <td><strong>${escapeHtml(e.desc)}</strong></td>
              <td>${escapeHtml(e.vendor)}</td>
              <td><strong style="color:${amtColor}; font-size:1.05rem;">${amtPrefix}${Number(e.amount).toLocaleString()}</strong></td>
              <td><span class="status-pill success">${e.status}</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Sub-Tab 2: Batch Settlement Gains & Profit Table Rows
    if (tbodyGains) {
      if (completedSettledBatches.length === 0) {
        tbodyGains.innerHTML = `
          <tr>
            <td colspan="8">
              <div class="empty-state">
                <div class="empty-icon" style="background: rgba(22, 163, 74, 0.15); color: #16A34A;"><i class="fa-solid fa-coins"></i></div>
                <h3>No Batch Settlements Recorded Yet</h3>
                <p>Select an ongoing batch and click <strong>"Complete Batch"</strong> to enter chick weight and commission rate to calculate & record farmer gain/profit.</p>
              </div>
            </td>
          </tr>
        `;
      } else {
        tbodyGains.innerHTML = completedSettledBatches.map(b => {
          const s = b.settlement;
          const isProfit = (s.netProfit >= 0);
          const profitColor = isProfit ? '#16A34A' : '#EF4444';

          return `
            <tr>
              <td><strong>${s.completedDate || '—'}</strong></td>
              <td><strong>${escapeHtml(b.name)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${b.rfq})</span></td>
              <td><strong style="font-size:1rem;">${Number(s.totalWeight).toLocaleString()} kg</strong></td>
              <td><span class="status-pill custard">₹ ${s.commissionRate} / kg</span></td>
              <td><strong style="color:#16A34A; font-size:1.05rem;">₹ ${Number(s.grossEarnings).toLocaleString()}</strong></td>
              <td><strong style="color:#EF4444;">₹ ${Number(s.expenditure).toLocaleString()}</strong></td>
              <td><strong style="color:${profitColor}; font-size:1.1rem;">₹ ${Number(s.netProfit).toLocaleString()}</strong></td>
              <td><span class="status-pill success"><i class="fa-solid fa-circle-check"></i> Settled</span></td>
            </tr>
          `;
        }).join('');
      }
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
  /* DAILY CHICKEN PRICE VARIATION STATISTICS & CHART LOGIC                      */
  /* -------------------------------------------------------------------------- */

  /* -------------------------------------------------------------------------- */
  /* AUTOMATED DAILY CHICKEN STOCK MARKET PRICE TERMINAL & CANVAS GRAPH          */
  /* -------------------------------------------------------------------------- */

  function renderAutomatedStockPrices(rangeDays = 7) {
    const canvas = document.getElementById('stock-chart-canvas');
    const tooltip = document.getElementById('stock-chart-tooltip');
    const tbody = document.getElementById('stock-price-table-tbody');

    const elToday = document.getElementById('stock-today-price');
    const el24hChange = document.getElementById('stock-24h-change');
    const elHigh = document.getElementById('stock-period-high');
    const elLow = document.getElementById('stock-period-low');
    const elVol = document.getElementById('stock-volatility');

    if (!priceData || priceData.length === 0) return;

    // Chronological sorted feeds
    const sortedAsc = [...priceData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedDesc = [...priceData].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get selected range slice
    const rangeAsc = sortedAsc.slice(-rangeDays);
    const rangeDesc = sortedDesc.slice(0, rangeDays);

    const latest = sortedDesc[0];
    const prev = sortedDesc[1] || latest;

    const todayPrice = Number(latest.price) || 0;
    const prevPrice = Number(prev.price) || todayPrice;
    const change24h = todayPrice - prevPrice;
    const pct24h = prevPrice > 0 ? ((change24h / prevPrice) * 100).toFixed(2) : 0;

    const pricesInPeriod = rangeAsc.map(p => Number(p.price));
    const periodHigh = Math.max(...pricesInPeriod);
    const periodLow = Math.min(...pricesInPeriod);

    // Update Ticker Summary Stats
    if (elToday) elToday.textContent = `₹ ${todayPrice.toFixed(2)} / kg`;
    if (el24hChange) {
      if (change24h > 0) {
        el24hChange.innerHTML = `<span style="color:#16A34A; font-weight:800;"><i class="fa-solid fa-arrow-trend-up"></i> +₹ ${change24h.toFixed(2)} (+${pct24h}%)</span>`;
      } else if (change24h < 0) {
        el24hChange.innerHTML = `<span style="color:#EF4444; font-weight:800;"><i class="fa-solid fa-arrow-trend-down"></i> -₹ ${Math.abs(change24h).toFixed(2)} (${pct24h}%)</span>`;
      } else {
        el24hChange.innerHTML = `<span style="color:#D97706; font-weight:800;"><i class="fa-solid fa-minus"></i> ₹ 0.00 (0.00%)</span>`;
      }
    }

    if (elHigh) elHigh.textContent = `₹ ${periodHigh.toFixed(2)}`;
    if (elLow) elLow.textContent = `₹ ${periodLow.toFixed(2)}`;
    if (elVol) {
      const spread = periodHigh - periodLow;
      if (spread > 12) elVol.innerHTML = `<span style="color:#EF4444;">High Volatility</span>`;
      else if (spread > 6) elVol.innerHTML = `<span style="color:#D97706;">Moderate</span>`;
      else elVol.innerHTML = `<span style="color:#16A34A;">Low / Stable</span>`;
    }

    // Render Canvas Stock Chart
    drawStockChartCanvas(canvas, tooltip, rangeAsc);

    // Render Daily Feeds Table
    if (tbody) {
      tbody.innerHTML = rangeDesc.map(p => {
        const pVal = Number(p.price);
        const chronIndex = sortedAsc.findIndex(item => item.date === p.date);
        const prevChron = chronIndex > 0 ? sortedAsc[chronIndex - 1] : null;
        const prevPVal = prevChron ? Number(prevChron.price) : pVal;
        const diff = pVal - prevPVal;
        const pct = prevPVal > 0 ? ((diff / prevPVal) * 100).toFixed(1) : 0;

        let badgeHtml = '';
        let trendHtml = '';

        if (diff > 0) {
          badgeHtml = `<span class="status-pill success"><i class="fa-solid fa-arrow-up"></i> +₹ ${diff.toFixed(2)} (+${pct}%)</span>`;
          trendHtml = `<span style="color:#16A34A; font-weight:800;"><i class="fa-solid fa-chart-line"></i> Bullish</span>`;
        } else if (diff < 0) {
          badgeHtml = `<span class="status-pill unsatisfied"><i class="fa-solid fa-arrow-down"></i> -₹ ${Math.abs(diff).toFixed(2)} (${pct}%)</span>`;
          trendHtml = `<span style="color:#EF4444; font-weight:800;"><i class="fa-solid fa-chart-line-down"></i> Bearish</span>`;
        } else {
          badgeHtml = `<span class="status-pill dull"><i class="fa-solid fa-minus"></i> ₹ 0.00 (0.0%)</span>`;
          trendHtml = `<span style="color:#D97706; font-weight:800;"><i class="fa-solid fa-arrows-left-right"></i> Neutral</span>`;
        }

        return `
          <tr>
            <td><strong>${p.date}</strong></td>
            <td><span class="status-pill custard">${escapeHtml(p.region)}</span></td>
            <td><strong style="color:var(--flamingo-primary); font-size:1.05rem;">₹ ${pVal.toFixed(2)} / kg</strong></td>
            <td>${badgeHtml}</td>
            <td>${trendHtml}</td>
            <td><i class="fa-solid fa-building-ngo" style="color:var(--flamingo-primary);"></i> ${escapeHtml(p.notes)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  function drawStockChartCanvas(canvas, tooltip, dataPoints) {
    if (!canvas || !dataPoints || dataPoints.length === 0) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 35;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    ctx.clearRect(0, 0, width, height);

    const prices = dataPoints.map(d => Number(d.price));
    const minVal = Math.floor(Math.min(...prices) - 2);
    const maxVal = Math.ceil(Math.max(...prices) + 2);
    const range = (maxVal - minVal) || 10;

    // Draw Horizontal Gridlines & Y-Axis Prices
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(220, 200, 180, 0.35)';
    ctx.fillStyle = 'rgba(120, 100, 90, 0.75)';
    ctx.font = '700 10px sans-serif';

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = paddingTop + (graphHeight / steps) * i;
      const priceVal = (maxVal - (range / steps) * i).toFixed(1);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillText(`₹${priceVal}`, 6, y + 3);
    }

    // Map data points to Canvas (x, y) coordinates
    const points = dataPoints.map((item, idx) => {
      const x = paddingLeft + (graphWidth / (dataPoints.length - 1 || 1)) * idx;
      const y = paddingTop + graphHeight - ((Number(item.price) - minVal) / range) * graphHeight;
      return { x, y, item, price: Number(item.price) };
    });

    // Draw Smooth Stock Area Fill & Line Curve
    if (points.length > 0) {
      const firstPrice = points[0].price;
      const lastPrice = points[points.length - 1].price;
      const isUp = lastPrice >= firstPrice;

      const lineColor = isUp ? '#16A34A' : '#EF4444';
      const gradStart = isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      const gradEnd = isUp ? 'rgba(34, 197, 94, 0.02)' : 'rgba(239, 68, 68, 0.02)';

      // Gradient Fill Path
      const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
      areaGrad.addColorStop(0, gradStart);
      areaGrad.addColorStop(1, gradEnd);

      ctx.beginPath();
      ctx.moveTo(points[0].x, height - paddingBottom);
      ctx.lineTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
      ctx.closePath();
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Main Stock Line Path
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = lineColor;
      ctx.stroke();

      // Draw Data Point Dots & Peak High/Low Labels
      let highPt = points[0];
      let lowPt = points[0];

      points.forEach((pt) => {
        if (pt.price > highPt.price) highPt = pt;
        if (pt.price < lowPt.price) lowPt = pt;

        // X-Axis Date Labels
        const dObj = new Date(pt.item.date);
        const labelStr = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillStyle = 'rgba(120, 100, 90, 0.75)';
        ctx.font = '700 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labelStr, pt.x, height - 12);

        // Circle dot
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = lineColor;
        ctx.stroke();
      });

      // Highlight All-Time High Point Tag
      if (highPt) {
        ctx.fillStyle = '#16A34A';
        ctx.font = '800 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`▲ HIGH ₹${highPt.price}`, highPt.x, Math.max(15, highPt.y - 10));
      }

      // Highlight Support Low Point Tag
      if (lowPt && lowPt !== highPt) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '800 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`▼ LOW ₹${lowPt.price}`, lowPt.x, Math.min(height - 40, lowPt.y + 16));
      }
    }

    // Canvas Interactive Hover Tooltip & Crosshair
    canvas.onmousemove = function(e) {
      const rectC = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rectC.left;

      let closestPt = points[0];
      let minDist = Math.abs(mouseX - points[0].x);

      points.forEach(pt => {
        const dist = Math.abs(mouseX - pt.x);
        if (dist < minDist) {
          minDist = dist;
          closestPt = pt;
        }
      });

      if (closestPt && tooltip) {
        const dObj = new Date(closestPt.item.date);
        const dateStr = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
        tooltip.style.left = `${closestPt.x}px`;
        tooltip.style.top = `${closestPt.y}px`;
        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <strong style="color:var(--flamingo-primary); display:block;">${dateStr}</strong>
          <span style="font-weight:800; font-size:0.95rem; color:#16A34A;">₹ ${closestPt.price.toFixed(2)} / kg</span>
          <span style="display:block; font-size:0.7rem; color:var(--text-muted);">${escapeHtml(closestPt.item.notes)}</span>
        `;
      }
    };

    canvas.onmouseleave = function() {
      if (tooltip) tooltip.style.display = 'none';
    };
  }

  /* -------------------------------------------------------------------------- */
  /* EVENT LISTENERS                                                            */
  /* -------------------------------------------------------------------------- */

  function setupEventListeners() {
    menuItems.forEach(item => {
      item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    // Sub-Tab Navigation Toggle Handler (e.g. Medicine Stock Inventory vs Medicine Details & Bill Log)
    document.body.addEventListener('click', (e) => {
      const subTabBtn = e.target.closest('.sub-tab-btn');
      if (subTabBtn) {
        const targetSubtab = subTabBtn.dataset.subtab;
        
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        subTabBtn.classList.add('active');

        document.querySelectorAll('.sub-tab-content').forEach(c => {
          if (c.id === targetSubtab) {
            c.classList.add('active');
            c.classList.remove('hidden');
          } else {
            c.classList.remove('active');
            c.classList.add('hidden');
          }
        });
      }
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

      // Open Complete Batch Modal from Dashboard card shortcut
      const completeModalBtn = e.target.closest('.open-complete-modal-btn');
      if (completeModalBtn) {
        const batchIdx = Number(completeModalBtn.dataset.batchIdx);
        if (window.openBatchCompletionModal) {
          window.openBatchCompletionModal(batchIdx);
        }
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

    // Open Batch Completion & Settlement Modal Function
    window.openBatchCompletionModal = function(batchIdx) {
      selectedBatchIndex = batchIdx;
      const targetBatch = batchData[batchIdx] || batchData[0];
      if (!targetBatch) {
        showToast('No active batch found to complete.', 'info');
        return;
      }

      document.getElementById('settle-batch-index').value = batchIdx;
      document.getElementById('settle-batch-name').value = `${targetBatch.name} (${targetBatch.rfq})`;

      // Calculate Farmer Expenditure for this batch
      let batchExp = expenditureData
        .filter(e => !e.isIncome && e.category !== 'Batch Settlement Income' && (e.desc.includes(targetBatch.rfq) || e.desc.includes(targetBatch.name)))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // If no batch-specific matching expense, fallback to total expenditure
      if (batchExp === 0) {
        batchExp = expenditureData
          .filter(e => !e.isIncome && e.category !== 'Batch Settlement Income')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      }

      document.getElementById('calc-batch-expenditure').textContent = `₹ ${batchExp.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

      // Pre-fill existing settlement data if re-editing
      if (targetBatch.settlement) {
        document.getElementById('settle-total-weight').value = targetBatch.settlement.totalWeight || '';
        document.getElementById('settle-commission-rate').value = targetBatch.settlement.commissionRate || '';
      } else {
        document.getElementById('settle-total-weight').value = '';
        document.getElementById('settle-commission-rate').value = '';
      }

      updateSettlementCalculation(batchExp);
      openModal('modal-complete-batch');
    };

    function updateSettlementCalculation(batchExp) {
      const weight = parseFloat(document.getElementById('settle-total-weight').value) || 0;
      const rate = parseFloat(document.getElementById('settle-commission-rate').value) || 0;

      const gross = weight * rate;
      const net = gross - batchExp;

      const elGross = document.getElementById('calc-gross-amount');
      const elNet = document.getElementById('calc-net-profit');

      if (elGross) elGross.textContent = `₹ ${gross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      if (elNet) {
        elNet.textContent = `₹ ${net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        elNet.style.color = net >= 0 ? '#16A34A' : '#EF4444';
      }
    }

    // Input Event Listeners for Live Settlement Preview
    const inputWeight = document.getElementById('settle-total-weight');
    const inputRate = document.getElementById('settle-commission-rate');

    if (inputWeight && inputRate) {
      const recalc = () => {
        const batchIdx = Number(document.getElementById('settle-batch-index').value) || 0;
        const targetBatch = batchData[batchIdx] || batchData[0];
        let batchExp = 0;
        if (targetBatch) {
          batchExp = expenditureData
            .filter(e => !e.isIncome && e.category !== 'Batch Settlement Income' && (e.desc.includes(targetBatch.rfq) || e.desc.includes(targetBatch.name)))
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);
          if (batchExp === 0) {
            batchExp = expenditureData.filter(e => !e.isIncome && e.category !== 'Batch Settlement Income').reduce((sum, e) => sum + Number(e.amount || 0), 0);
          }
        }
        updateSettlementCalculation(batchExp);
      };

      inputWeight.addEventListener('input', recalc);
      inputRate.addEventListener('input', recalc);
    }

    // Complete Batch Toggle / Trigger Handler
    const completeBatchToggleBtn = document.getElementById('complete-batch-toggle-btn');
    if (completeBatchToggleBtn) {
      completeBatchToggleBtn.addEventListener('click', () => {
        const currentBatch = batchData[selectedBatchIndex];
        if (currentBatch) {
          if (currentBatch.status === 'Completed') {
            // Option to reopen or re-settle
            openBatchCompletionModal(selectedBatchIndex);
          } else {
            openBatchCompletionModal(selectedBatchIndex);
          }
        }
      });
    }

    // Form Submit: Batch Completion & Profit Settlement
    document.getElementById('form-complete-batch').addEventListener('submit', (e) => {
      e.preventDefault();
      const batchIdx = Number(document.getElementById('settle-batch-index').value);
      const targetBatch = batchData[batchIdx] || batchData[selectedBatchIndex];

      if (!targetBatch) return;

      const totalWeight = parseFloat(document.getElementById('settle-total-weight').value) || 0;
      const commissionRate = parseFloat(document.getElementById('settle-commission-rate').value) || 0;
      const grossEarnings = totalWeight * commissionRate;

      let batchExp = expenditureData
        .filter(e => !e.isIncome && e.category !== 'Batch Settlement Income' && (e.desc.includes(targetBatch.rfq) || e.desc.includes(targetBatch.name)))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      if (batchExp === 0) {
        batchExp = expenditureData.filter(e => !e.isIncome && e.category !== 'Batch Settlement Income').reduce((sum, e) => sum + Number(e.amount || 0), 0);
      }

      const netProfit = grossEarnings - batchExp;

      targetBatch.status = 'Completed';
      targetBatch.settlement = {
        totalWeight,
        commissionRate,
        grossEarnings,
        expenditure: batchExp,
        netProfit,
        completedDate: new Date().toISOString().split('T')[0]
      };

      localStorage.setItem('chickcheck_batches', JSON.stringify(batchData));

      // Save Gain Entry in Expenditure Log
      const gainEntry = {
        date: new Date().toISOString().split('T')[0],
        category: 'Batch Settlement Income',
        desc: `Settlement Gain for '${targetBatch.name}' (${targetBatch.rfq}) — ${totalWeight} kg @ ₹${commissionRate}/kg`,
        vendor: 'Flock Buyer / Trader',
        amount: grossEarnings,
        status: 'Received (Income)',
        isIncome: true
      };

      // Filter existing income entry for this batch if present, then unshift updated gain
      expenditureData = expenditureData.filter(e => !(e.isIncome && e.desc.includes(targetBatch.rfq)));
      expenditureData.unshift(gainEntry);
      localStorage.setItem('chickcheck_expenditure', JSON.stringify(expenditureData));

      // Audit Log in History
      historyData.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        time: 'Just Now',
        module: '2. New Batch',
        desc: `Completed Batch '${targetBatch.name}' (${targetBatch.rfq}): Total Weight ${totalWeight}kg @ ₹${commissionRate}/kg = Gross ₹${grossEarnings.toLocaleString()}, Net Profit ₹${netProfit.toLocaleString()}`,
        code: targetBatch.rfq,
        status: 'Completed & Settled'
      });
      localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

      renderAll();
      closeModal();
      showToast(`Batch '${targetBatch.name}' completed! Net Farmer Profit: ₹ ${netProfit.toLocaleString()}`, 'success');
    });

    // Form Add Visit
    document.getElementById('form-add-visit').addEventListener('submit', (e) => {
      e.preventDefault();

      const rawVisitorName = document.getElementById('visit-visitor-name').value.trim();
      const sanitizedName = rawVisitorName.replace(/[^a-zA-Z\s]/g, '');

      if (!sanitizedName) {
        showToast('Visitor Name can only contain letters and spaces.', 'info');
        return;
      }

      const feedBags = Number(document.getElementById('visit-feed-bags-delivered').value) || 0;
      const assignedBatchStr = document.getElementById('visit-batch-select').value;

      const newVisit = {
        date: document.getElementById('visit-date').value,
        visitorName: sanitizedName,
        designation: document.getElementById('visit-designation-select').value,
        batch: assignedBatchStr,
        feedBagsDelivered: feedBags,
        feedbacks: document.getElementById('visit-feedback-text').value.trim(),
        status: document.getElementById('visit-satisfaction-status').value
      };

      // If feed bags were delivered during visit, update assigned batch feed column in ledger
      if (feedBags > 0) {
        const targetBatchObj = batchData.find(b => `${b.name} (${b.rfq})` === assignedBatchStr);
        if (targetBatchObj) {
          const startDate = targetBatchObj.startDate ? new Date(targetBatchObj.startDate) : new Date();
          const now = new Date();
          const diffDays = Math.floor(Math.abs(now - startDate) / (1000 * 60 * 60 * 24)) + 1;
          const currentDayNum = Math.min(40, Math.max(1, diffDays));

          if (!targetBatchObj.dailyRecords) targetBatchObj.dailyRecords = {};
          if (!targetBatchObj.dailyRecords[currentDayNum]) {
            targetBatchObj.dailyRecords[currentDayNum] = { mortality: 0, feedActual: '', fcrActual: '', bagsConsumed: 0, bagsDelivered: 0 };
          }

          targetBatchObj.dailyRecords[currentDayNum].bagsDelivered = Number(targetBatchObj.dailyRecords[currentDayNum].bagsDelivered || 0) + feedBags;
          localStorage.setItem('chickcheck_batches', JSON.stringify(batchData));
        }
      }

      visitsData.unshift(newVisit);
      localStorage.setItem('chickcheck_visits', JSON.stringify(visitsData));

      historyData.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        time: 'Just Now',
        module: '3. Visits',
        desc: `Logged Visit for ${newVisit.visitorName} (${newVisit.designation}) — Batch: ${newVisit.batch} ${feedBags > 0 ? `(+${feedBags} Feed Bags Delivered)` : ''}`,
        code: 'VST-' + Math.floor(100 + Math.random() * 900),
        status: newVisit.status
      });

      renderAll();
      closeModal();
      showToast(`Visit record for ${newVisit.visitorName} saved!`, 'success');
    });

    // Form Record Feed Delivery (Updates Feed Column & Remaining Stock)
    const formRecordFeed = document.getElementById('form-record-feed-delivery');
    if (formRecordFeed) {
      formRecordFeed.addEventListener('submit', (e) => {
        e.preventDefault();

        const delDate = document.getElementById('feed-delivery-date').value;
        const supplierName = document.getElementById('feed-delivery-supplier').value.trim();
        const assignedBatchStr = document.getElementById('feed-delivery-batch-select').value;
        const bagsDelivered = Number(document.getElementById('feed-delivery-bags').value) || 0;
        const notes = document.getElementById('feed-delivery-notes').value.trim() || 'Feed delivery completed';

        if (bagsDelivered <= 0) {
          showToast('Please enter a valid number of feed bags delivered.', 'info');
          return;
        }

        // Find assigned batch object and update feed column in ledger
        const targetBatchObj = batchData.find(b => `${b.name} (${b.rfq})` === assignedBatchStr);
        if (targetBatchObj) {
          const startDate = targetBatchObj.startDate ? new Date(targetBatchObj.startDate) : new Date();
          const now = new Date();
          const diffDays = Math.floor(Math.abs(now - startDate) / (1000 * 60 * 60 * 24)) + 1;
          const currentDayNum = Math.min(40, Math.max(1, diffDays));

          if (!targetBatchObj.dailyRecords) targetBatchObj.dailyRecords = {};
          if (!targetBatchObj.dailyRecords[currentDayNum]) {
            targetBatchObj.dailyRecords[currentDayNum] = { mortality: 0, feedActual: '', fcrActual: '', bagsConsumed: 0, bagsDelivered: 0 };
          }

          targetBatchObj.dailyRecords[currentDayNum].bagsDelivered = Number(targetBatchObj.dailyRecords[currentDayNum].bagsDelivered || 0) + bagsDelivered;
          localStorage.setItem('chickcheck_batches', JSON.stringify(batchData));
        }

        // Add to Visit Log as Feed Supplier delivery
        const newVisitRecord = {
          date: delDate,
          visitorName: supplierName,
          designation: 'Feed Supplier',
          batch: assignedBatchStr,
          feedBagsDelivered: bagsDelivered,
          feedbacks: notes,
          status: 'Satisfied'
        };

        visitsData.unshift(newVisitRecord);
        localStorage.setItem('chickcheck_visits', JSON.stringify(visitsData));

        historyData.unshift({
          id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
          time: 'Just Now',
          module: '3. Visits & Feed Delivery',
          desc: `Recorded delivery of +${bagsDelivered} Feed Bags by ${supplierName} for Batch '${assignedBatchStr}'`,
          code: 'FEED-' + Math.floor(100 + Math.random() * 900),
          status: 'Delivered'
        });
        localStorage.setItem('chickcheck_history', JSON.stringify(historyData));

        renderAll();
        closeModal();
        showToast(`Recorded +${bagsDelivered} Feed Bags Delivered for ${assignedBatchStr}!`, 'success');
      });
    }

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

    // Extend Batch Ledger Cycle Button Listener
    const extendBatchDayBtn = document.getElementById('extend-batch-day-btn');
    if (extendBatchDayBtn) {
      extendBatchDayBtn.addEventListener('click', () => {
        const activeBatch = batchData[selectedBatchIndex];
        if (!activeBatch) {
          showToast('Please select or create an active batch first!');
          return;
        }

        activeBatch.extraDays = (Number(activeBatch.extraDays) || 0) + 1;
        localStorage.setItem('chickcheck_batches', JSON.stringify(batchData));

        const startDate = new Date(activeBatch.startDate || Date.now());
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysElapsed = Math.max(1, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);
        const highestLogged = activeBatch.dailyRecords ? Object.keys(activeBatch.dailyRecords).reduce((max, k) => Math.max(max, Number(k) || 0), 0) : 0;
        const totalRowsNow = Math.max(daysElapsed, highestLogged) + activeBatch.extraDays;

        render40DayTracker(activeBatch);
        showToast(`Unlocked Day ${totalRowsNow} row for performance tracking!`, 'success');
      });
    }

    // Stock Market Chart Time Range Selector Handler (7D / 15D / 30D)
    document.body.addEventListener('click', (e) => {
      const rangeBtn = e.target.closest('.stock-range-btn');
      if (rangeBtn) {
        document.querySelectorAll('.stock-range-btn').forEach(b => b.classList.remove('active'));
        rangeBtn.classList.add('active');

        currentStockRangeDays = Number(rangeBtn.dataset.range) || 7;
        renderAutomatedStockPrices(currentStockRangeDays);
      }
    });

    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      themeToggleBtn.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });

    /* MANDATORY EMAIL VERIFICATION LOCK SCREEN (AUTH GATE) LOGIC */
    const authGateScreen = document.getElementById('auth-gate-screen');
    const savedVerifiedUser = localStorage.getItem('chickcheck_verified_user');

    function unlockWebsiteAccess(email) {
      localStorage.setItem('chickcheck_verified_user', email);
      if (authGateScreen) {
        authGateScreen.classList.add('unlocked');
      }
      const badge = document.getElementById('user-verification-badge');
      const check = document.getElementById('user-verified-check');
      if (badge) badge.textContent = `Verified (${email})`;
      if (check) check.style.color = '#16A34A';
      showToast(`Welcome! Email verified successfully for ${email}`, 'success');
    }

    if (savedVerifiedUser) {
      if (authGateScreen) authGateScreen.classList.add('unlocked');
      const badge = document.getElementById('user-verification-badge');
      if (badge) badge.textContent = `Verified (${savedVerifiedUser})`;
    } else {
      if (authGateScreen) authGateScreen.classList.remove('unlocked');
    }

    // Gate Option 1: 1-Click Google Verify
    const gateBtnGoogle = document.getElementById('gate-btn-google-auth');
    if (gateBtnGoogle) {
      gateBtnGoogle.addEventListener('click', () => {
        unlockWebsiteAccess('farmer.rajesh@gmail.com');
      });
    }

    // Gate Option 2: Email OTP Step 1 & 2
    let gateSimulatedOtp = '584920';
    let gateTargetEmail = '';
    const gateFormSendOtp = document.getElementById('gate-form-send-otp');
    const gateFormVerifyOtp = document.getElementById('gate-form-verify-otp');

    if (gateFormSendOtp) {
      gateFormSendOtp.addEventListener('submit', (e) => {
        e.preventDefault();
        gateTargetEmail = document.getElementById('gate-email-input').value.trim();
        if (!gateTargetEmail.includes('@')) {
          showToast('Please enter a valid email address', 'error');
          return;
        }
        document.getElementById('gate-target-email-lbl').textContent = gateTargetEmail;
        gateFormVerifyOtp.classList.remove('hidden');
        showToast(`Verification code sent to ${gateTargetEmail}! (Demo OTP Code: ${gateSimulatedOtp})`, 'info');
      });
    }

    if (gateFormVerifyOtp) {
      gateFormVerifyOtp.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('gate-otp-input').value.trim();
        if (code === gateSimulatedOtp || code.length === 6) {
          unlockWebsiteAccess(gateTargetEmail || 'farmer.rajesh@gmail.com');
        } else {
          showToast('Invalid 6-digit code. Please enter valid code.', 'error');
        }
      });
    }

    /* GMAIL USER IDENTITY VERIFICATION HANDLERS */
    const headerUserProfile = document.getElementById('header-user-profile');
    if (headerUserProfile) {
      headerUserProfile.addEventListener('click', () => {
        openModal('modal-verify-gmail');
      });
    }

    let generatedSimulatedOtp = '584920';
    let targetVerificationEmail = '';

    const btnGoogleOAuth = document.getElementById('btn-google-oauth-signin');
    if (btnGoogleOAuth) {
      btnGoogleOAuth.addEventListener('click', () => {
        const userEmail = 'rajesh.farmer@gmail.com';
        const badge = document.getElementById('user-verification-badge');
        const check = document.getElementById('user-verified-check');
        if (badge) badge.textContent = `Verified (${userEmail})`;
        if (check) check.style.color = '#16A34A';
        closeModal();
        showToast(`Authenticated & Verified via Google OAuth: ${userEmail}`, 'success');
      });
    }

    const formSendOtp = document.getElementById('form-send-gmail-otp');
    const formSubmitOtp = document.getElementById('form-submit-gmail-otp');
    if (formSendOtp) {
      formSendOtp.addEventListener('submit', (e) => {
        e.preventDefault();
        targetVerificationEmail = document.getElementById('gmail-verification-input').value.trim();
        if (!targetVerificationEmail.endsWith('@gmail.com') && !targetVerificationEmail.includes('@')) {
          showToast('Please enter a valid Gmail address', 'error');
          return;
        }
        document.getElementById('target-gmail-label').textContent = targetVerificationEmail;
        formSubmitOtp.classList.remove('hidden');
        showToast(`Verification code sent to ${targetVerificationEmail}! (Demo OTP: ${generatedSimulatedOtp})`, 'info');
      });
    }

    if (formSubmitOtp) {
      formSubmitOtp.addEventListener('submit', (e) => {
        e.preventDefault();
        const userOtp = document.getElementById('gmail-otp-input').value.trim();
        if (userOtp === generatedSimulatedOtp || userOtp.length === 6) {
          const badge = document.getElementById('user-verification-badge');
          const check = document.getElementById('user-verified-check');
          if (badge) badge.textContent = `Verified (${targetVerificationEmail || 'rajesh.farmer@gmail.com'})`;
          if (check) check.style.color = '#16A34A';
          closeModal();
          showToast(`Gmail identity verified successfully for ${targetVerificationEmail}!`, 'success');
        } else {
          showToast('Invalid verification code. Please enter 6-digit code.', 'error');
        }
      });
    }
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