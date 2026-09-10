const DB_NAME = "UhuruContactBase", STORE = "contacts"; // legacy names kept for reference only
let db, contacts = [];
let currentView = "all";

/* ---------------------------------------------------------------
   SUPABASE CONFIG
   1. Create a project at https://supabase.com
   2. Run supabase-schema.sql in the SQL Editor (once)
   3. Project Settings -> API -> paste your Project URL and
      "anon" public key below
   ------------------------------------------------------------- */
const SUPABASE_URL = "https://ghvvqzabpntnlkmxzsvr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodnZxemFicG50bmxrbXh6c3ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjg1NjUsImV4cCI6MjEwNDYwNDU2NX0.NBVawpAmpfpNjpU5sDEbl92fSBaUjmMJx5omXsqxp64";
const TABLE = "contacts";

const supabase =
  window.supabase && SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR-PROJECT") && !SUPABASE_ANON_KEY.includes("YOUR-ANON")
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const STATUSES = [
  { id: "not-called", label: "NOT CALLED", color: "#f59e0b" },
  { id: "called", label: "CALLED", color: "#3b82f6" },
  { id: "agreed", label: "AGREED", color: "#a855f7" },
  { id: "building", label: "BUILDING", color: "#8b5cf6" },
  { id: "live", label: "WEBSITE LIVE", color: "#22c55e" }
];

function statusOf(c) {
  const s = String(c.status || "");
  if (STATUSES.some(x => x.id === s)) return s;
  return c.called ? "called" : "not-called";
}

function money(n) {
  n = Number(n) || 0;
  return "R " + n.toLocaleString("en-ZA");
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!supabase) {
      reject(new Error(
        "Supabase is not configured yet. Open app.js and set SUPABASE_URL / SUPABASE_ANON_KEY " +
        "(see supabase-schema.sql / SUPABASE-SETUP.md)."
      ));
      return;
    }
    db = supabase;
    resolve();
  });
}

async function all() {
  const { data, error } = await supabase.from(TABLE).select("*").order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function put(c) {
  const { data, error } = await supabase.from(TABLE).insert(c).select("id").single();
  if (error) throw error;
  return data.id;
}

async function update(c) {
  const { id, ...rest } = c;
  const { error } = await supabase.from(TABLE).update(rest).eq("id", id);
  if (error) throw error;
}

async function del(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

async function clearDB() {
  // PostgREST requires a filter on delete; id > 0 matches every row.
  const { error } = await supabase.from(TABLE).delete().gt("id", 0);
  if (error) throw error;
}

function cleanPhone(p) {
  const raw = String(p || "").trim();
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 10) digits = "27" + digits.slice(1);
  else if (!digits.startsWith("27") && digits.length >= 9) digits = "27" + digits;
  return digits ? "+" + digits : "";
}

function phoneKey(p) { return cleanPhone(p).replace(/\D/g, ""); }

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function nextNumber() {
  return contacts.length ? Math.max(...contacts.map(c => Number(c.number) || 0)) + 1 : 1;
}

function whatsappNumber(phone) { return String(phone || "").replace(/\D/g, ""); }

function formatDate(v) { return v ? new Date(v).toLocaleString() : "Not called yet"; }

function daysAgo(v) {
  if (!v) return null;
  return Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
}

async function refresh() {
  contacts = await all();
  contacts.sort((a, b) => (Number(a.number) || Number(a.id)) - (Number(b.number) || Number(b.id)));
  let changed = false;
  contacts.forEach((c, i) => {
    const normalized = cleanPhone(c.phone);
    if (normalized && c.phone !== normalized) { c.phone = normalized; changed = true; }
    if (Number(c.number) !== i + 1) { c.number = i + 1; changed = true; }
    const s = statusOf(c);
    if (c.status !== s) { c.status = s; changed = true; }
  });
  if (changed) { for (const c of contacts) await update(c); }
  render();
}

function safeWebsite(url) {
  const v = String(url || "").trim();
  if (!v) return "";
  const full = /^https?:\/\//i.test(v) ? v : "https://" + v;
  try { return new URL(full).href; } catch { return ""; }
}

function contactHTML(c) {
  const site = safeWebsite(c.website), built = safeWebsite(c.siteUrl);
  const st = STATUSES.find(s => s.id === statusOf(c)) || STATUSES[0];
  const lastDays = daysAgo(c.lastCalled);
  return `<div class="row">
  <div class="serial">${esc(c.number || c.id)}</div>
  <div>${esc(c.business)}</div>
  <div>${esc(c.address || "—")}</div>
  <div class="number">${esc(c.phone)}</div>
  <div class="call-info">
    <span class="status-badge" style="border-color:${st.color};color:${st.color}">${st.label}</span>
    <small>${c.called ? ("Last call: " + esc(formatDate(c.lastCalled)) + (lastDays !== null && lastDays > 0 ? ` (${lastDays}d ago)` : "")) : "No call recorded"}</small>
    ${c.recall ? '<span class="recall-badge">CALL AGAIN</span>' : ""}
    ${c.lead ? '<span class="lead-badge">LEAD / RETURN</span>' : ""}
    ${c.followUp ? `<span class="follow-badge">Follow-up: ${esc(c.followUp)}</span>` : ""}
    ${(Number(c.price) > 0) ? `<small class="money">Quote: ${money(c.price)}${Number(c.paid) > 0 ? ` · Paid: ${money(c.paid)}` : ""}</small>` : ""}
    ${c.notes ? `<div class="note-preview">${esc(c.notes)}</div>` : ""}
    ${site ? `<a class="website-link" href="${esc(site)}" target="_blank" rel="noopener">Their website</a>` : ""}
    ${built ? `<a class="website-link live-link" href="${esc(built)}" target="_blank" rel="noopener">Site we built</a>` : ""}
  </div>
  <div class="actions">
    <button class="whatsapp" type="button" onclick="openWhatsApp(${c.id})">WhatsApp</button>
    <button class="called" type="button" onclick="markCalled(${c.id})">${c.called ? "Called" : "I Called"}</button>
    <button type="button" onclick="toggleAgreed(${c.id})">${statusOf(c) === "agreed" ? "Un-agree" : "Agreed"}</button>
    <button type="button" onclick="setBuilding(${c.id})" ${statusOf(c) !== "agreed" ? "disabled" : ""}>Building</button>
    <button class="live-btn" type="button" onclick="markLive(${c.id})">Go Live</button>
    <button type="button" onclick="toggleRecall(${c.id})">${c.recall ? "Remove Recall" : "Call Again"}</button>
    <button type="button" onclick="toggleLead(${c.id})">${c.lead ? "Remove Lead" : "Lead"}</button>
    <button type="button" onclick="editNotes(${c.id})">Notes</button>
    <button type="button" onclick="editContact(${c.id})">Edit</button>
    <button class="danger" type="button" onclick="removeContact(${c.id})">Delete</button>
  </div>
</div>`;
}

function groupByPlace(list) {
  const groups = {};
  list.forEach(c => {
    const k = (c.address || "Not specified").trim();
    (groups[k] || (groups[k] = [])).push(c);
  });
  return groups;
}

function donutSVG(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const r = 60, cx = 85, cy = 85, C = 2 * Math.PI * r;
  let off = 0;
  const segs = STATUSES.filter(s => counts[s.id] > 0).map(s => {
    const frac = counts[s.id] / total, len = Math.max(frac * C - 2, 0.5);
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="22" stroke-dasharray="${len} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"><title>${s.label}: ${counts[s.id]}</title></circle>`;
    off += frac * C;
    return el;
  }).join("");
  return `<svg class="donut" viewBox="0 0 170 170">${segs}<text x="85" y="82" text-anchor="middle" class="donut-total">${total}</text><text x="85" y="100" text-anchor="middle" class="donut-sub">TOTAL</text></svg>`;
}

function columnChart(entries) {
  const max = Math.max(1, ...entries.map(e => e[1]));
  const totalCalls = entries.reduce((a, e) => a + e[1], 0);
  return `<div class="chart-columns">${entries.map(([d, n]) =>
    `<div class="col-wrap" title="${d}: ${n} call(s)"><div class="col${n === 0 ? " zero" : ""}" style="height:${Math.max(Math.round(n / max * 100), n > 0 ? 6 : 2)}%"></div><span>${esc(d.slice(8))}</span></div>`
  ).join("")}</div><small class="chart-note">${totalCalls} call(s) in the last ${entries.length} days</small>`;
}

function callsByDay(days = 14) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  contacts.forEach(c => {
    if (c.lastCalled) {
      const k = new Date(c.lastCalled).toISOString().slice(0, 10);
      if (k in buckets) buckets[k]++;
    }
  });
  return Object.entries(buckets);
}

function placeBars(groups, limit = 8) {
  const top = Object.entries(groups).sort((a, b) => b[1].length - a[1].length).slice(0, limit);
  if (!top.length) return `<div class="empty">No data yet.</div>`;
  const max = Math.max(1, ...top.map(x => x[1].length));
  return top.map(([p, n]) =>
    `<div class="hbar-row"><span class="hbar-label" title="${esc(p)}">${esc(p)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(Math.round(n.length / max * 100), 4)}%"></div></div><span class="hbar-n">${n.length}</span></div>`
  ).join("");
}

function statusCounts(list) {
  const m = {};
  STATUSES.forEach(s => m[s.id] = 0);
  list.forEach(c => m[statusOf(c)]++);
  return m;
}

function avg(nums) {
  const a = nums.filter(n => n > 0);
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

function computeAnalytics(list) {
  const counts = statusCounts(list);
  const total = list.length;
  const calledN = counts.called + counts.agreed + counts.building + counts.live;
  const pipelineN = counts.agreed + counts.building;
  const revenue = list.reduce((a, c) => a + (Number(c.paid) || 0), 0);
  const quoted = list.reduce((a, c) => a + (Number(c.price) || 0), 0);
  const pipelineValue = list.reduce((a, c) => a + ((statusOf(c) === "agreed" || statusOf(c) === "building") ? (Number(c.price) || 0) : 0), 0);
  const outstanding = list.reduce((a, c) => {
    const price = Number(c.price) || 0;
    const paid = Number(c.paid) || 0;
    return a + Math.max(0, price - paid);
  }, 0);
  const liveValue = list.filter(c => statusOf(c) === "live").reduce((a, c) => a + (Number(c.paid) || 0), 0);
  const avgDeal = avg(list.filter(c => statusOf(c) === "live" || statusOf(c) === "building" || statusOf(c) === "agreed").map(c => Number(c.price) || 0));
  const avgPaid = avg(list.filter(c => Number(c.paid) > 0).map(c => Number(c.paid) || 0));
  const leads = list.filter(c => c.lead).length;
  const recall = list.filter(c => c.recall).length;
  const overdueFU = list.filter(c => c.followUp && new Date(c.followUp) <= new Date()).length;
  const futureFU = list.filter(c => c.followUp && new Date(c.followUp) > new Date()).length;
  const withNotes = list.filter(c => (c.notes || "").trim()).length;
  const withWebsite = list.filter(c => safeWebsite(c.website)).length;
  const withBuilt = list.filter(c => safeWebsite(c.siteUrl)).length;
  const groups = groupByPlace(list);
  const placeCount = Object.keys(groups).length;
  const convRate = calledN ? Math.round((pipelineN + counts.live) / calledN * 100) : 0;
  const closeRate = calledN ? Math.round(counts.live / calledN * 100) : 0;
  const callRate = total ? Math.round(calledN / total * 100) : 0;
  const notCalled = counts["not-called"];

  // Call activity
  const last7 = callsByDay(7);
  const last14 = callsByDay(14);
  const calls7 = last7.reduce((a, e) => a + e[1], 0);
  const calls14 = last14.reduce((a, e) => a + e[1], 0);
  const avgCallsPerDay = +(calls14 / 14).toFixed(1);
  const daysWithCalls = last14.filter(e => e[1] > 0).length;

  // Stale: called > 14 days ago and still not-called status? or status called/agreed with no recent activity
  const stale = list.filter(c => {
    const s = statusOf(c);
    if (s === "live" || s === "building") return false;
    if (!c.lastCalled) return s === "not-called" && true;
    const d = daysAgo(c.lastCalled);
    return d !== null && d >= 14 && (s === "called" || s === "agreed" || c.recall || c.lead);
  }).length;

  // Collection rate
  const collectionRate = quoted > 0 ? Math.round(revenue / quoted * 100) : 0;

  // Projections (rule-based)
  // Assume continuing same call volume & conversion
  const projectedCallsMonth = Math.round(avgCallsPerDay * 30);
  const projectedDealsMonth = calledN > 0 ? Math.round(projectedCallsMonth * (counts.live / Math.max(calledN, 1))) : 0;
  const projectedRevenueMonth = Math.round(projectedDealsMonth * (avgDeal || avgPaid || 0));
  // Pipeline conversion: assume 40% of pipeline closes in 30 days if avg deal known
  const pipelineCloseEst = Math.round(pipelineValue * 0.4);
  const monthOutlook = projectedRevenueMonth + pipelineCloseEst;

  return {
    counts, total, calledN, pipelineN, revenue, quoted, pipelineValue, outstanding,
    liveValue, avgDeal, avgPaid, leads, recall, overdueFU, futureFU, withNotes,
    withWebsite, withBuilt, groups, placeCount, convRate, closeRate, callRate,
    notCalled, calls7, calls14, avgCallsPerDay, daysWithCalls, stale, collectionRate,
    projectedCallsMonth, projectedDealsMonth, projectedRevenueMonth, pipelineCloseEst, monthOutlook,
    last14
  };
}

function advisorInsights(A) {
  const tips = [];
  const alerts = [];
  const projections = [];

  // Alerts
  if (A.total === 0) {
    tips.push({ type: "tip", title: "Start your list", body: "Add your first 20 businesses in one area. Focus is faster than scattering." });
    return { tips, alerts, projections };
  }
  if (A.notCalled > A.total * 0.5) {
    alerts.push({ type: "alert", title: "Large uncalled backlog", body: `${A.notCalled} of ${A.total} contacts have never been called. Prioritise 15 calls today from one place.` });
  }
  if (A.overdueFU > 0) {
    alerts.push({ type: "alert", title: "Overdue follow-ups", body: `${A.overdueFU} follow-up(s) are due or overdue. Clear them before adding new leads.` });
  }
  if (A.outstanding > 0) {
    alerts.push({ type: "alert", title: "Money still outstanding", body: `${money(A.outstanding)} quoted but not fully paid. Chase payments on live and building clients first.` });
  }
  if (A.stale > 5) {
    alerts.push({ type: "alert", title: "Stale pipeline", body: `${A.stale} contacts have gone quiet for 14+ days. Re-open or mark Call Again.` });
  }
  if (A.calls7 === 0 && A.total > 0) {
    alerts.push({ type: "alert", title: "No calls this week", body: "Zero calls logged in the last 7 days. Consistency beats intensity — aim for a small daily target." });
  }

  // Performance tips from data
  if (A.callRate < 40 && A.total >= 10) {
    tips.push({ type: "tip", title: "Raise call coverage", body: `Only ${A.callRate}% of contacts have been called. Target 60%+ before expanding into new areas.` });
  }
  if (A.convRate < 15 && A.calledN >= 10) {
    tips.push({ type: "tip", title: "Improve pitch conversion", body: `Call-to-deal is ${A.convRate}%. Try a short demo link or price menu on WhatsApp after the first call.` });
  }
  if (A.convRate >= 25 && A.calledN >= 5) {
    tips.push({ type: "tip", title: "Strong conversion", body: `Call-to-deal at ${A.convRate}% is solid. Double down on the places and scripts that are working.` });
  }
  if (A.avgCallsPerDay < 3 && A.total >= 5) {
    tips.push({ type: "tip", title: "Lift daily call volume", body: `You average ${A.avgCallsPerDay} calls/day over 14 days. A steady 8–12 quality calls beats random bursts.` });
  }
  if (A.avgCallsPerDay >= 8) {
    tips.push({ type: "tip", title: "Healthy activity", body: `${A.avgCallsPerDay} calls/day average — keep the rhythm and protect time for follow-ups and delivery.` });
  }
  if (A.pipelineN > 0 && A.counts.building === 0 && A.counts.agreed > 0) {
    tips.push({ type: "tip", title: "Move agreed deals forward", body: `${A.counts.agreed} agreed deal(s) are not marked Building yet. Start delivery to protect momentum and cash flow.` });
  }
  if (A.counts.building > 0 && A.counts.live === 0) {
    tips.push({ type: "tip", title: "Ship the first live site", body: "You have sites in Building. Deliver one this week and mark Go Live — proof sells the next deals." });
  }
  if (A.collectionRate < 50 && A.quoted > 0) {
    tips.push({ type: "tip", title: "Tighten collections", body: `Only ${A.collectionRate}% of quoted value is collected. Ask for a deposit before starting and balance on Go Live.` });
  }
  if (A.placeCount === 1 && A.total >= 8) {
    tips.push({ type: "tip", title: "Own one area first", body: "You're concentrated in one place — good. Finish that pocket before opening a second location." });
  }
  if (A.placeCount > 5 && A.callRate < 50) {
    tips.push({ type: "tip", title: "Too many places, low coverage", body: `${A.placeCount} places but low call coverage. Pick the top 2 by contact count and finish those first.` });
  }
  if (A.leads > 0 && A.recall === 0) {
    tips.push({ type: "tip", title: "Work your leads", body: `${A.leads} lead(s) flagged. Schedule follow-up dates so they don't go cold.` });
  }
  if (A.withNotes / Math.max(A.total, 1) < 0.2 && A.calledN >= 5) {
    tips.push({ type: "tip", title: "Write short notes", body: "Few contacts have notes. After each call, log one line — objection, budget, or next step." });
  }
  if (A.daysWithCalls < 5 && A.total >= 5) {
    tips.push({ type: "tip", title: "Call on more days", body: `Only ${A.daysWithCalls} of the last 14 days had calls. Spread activity across the week for better owner reach.` });
  }

  // Default tips if few generated
  if (tips.length < 2) {
    tips.push({ type: "tip", title: "Morning block", body: "Call 10 new businesses before 10am — owners are more available early." });
    tips.push({ type: "tip", title: "Pipeline discipline", body: "Agreed → Building → Go Live. Always attach the live URL and paid amount so the dashboard stays accurate." });
  }

  // Projections
  if (A.total > 0) {
    projections.push({
      type: "proj",
      title: "30-day call outlook",
      body: `At ${A.avgCallsPerDay} calls/day you are on track for about ${A.projectedCallsMonth} calls this month.`
    });
    if (A.avgDeal > 0 || A.avgPaid > 0) {
      projections.push({
        type: "proj",
        title: "Revenue projection",
        body: `If conversion holds, roughly ${A.projectedDealsMonth} new live deal(s) this month ≈ ${money(A.projectedRevenueMonth)} from new closes.`
      });
    }
    if (A.pipelineValue > 0) {
      projections.push({
        type: "proj",
        title: "Pipeline conversion",
        body: `Pipeline value ${money(A.pipelineValue)}. Conservatively, ~40% closing soon ≈ ${money(A.pipelineCloseEst)} potential.`
      });
    }
    projections.push({
      type: "proj",
      title: "Month outlook (combined)",
      body: `New closes + pipeline: about ${money(A.monthOutlook)} potential this month if activity continues.`
    });
    if (A.outstanding > 0) {
      projections.push({
        type: "proj",
        title: "Cash you can unlock",
        body: `${money(A.outstanding)} is quoted but unpaid. Collecting half of that this week is ${money(Math.round(A.outstanding / 2))}.`
      });
    }
  }

  return { tips: tips.slice(0, 6), alerts: alerts.slice(0, 5), projections: projections.slice(0, 5) };
}

function funnelHTML(A) {
  const steps = [
    { label: "Contacts", n: A.total, color: "#64748b" },
    { label: "Called", n: A.calledN, color: "#3b82f6" },
    { label: "Pipeline", n: A.pipelineN, color: "#a855f7" },
    { label: "Live", n: A.counts.live, color: "#22c55e" }
  ];
  const max = Math.max(1, ...steps.map(s => s.n));
  return `<div class="funnel">${steps.map(s => `
    <div class="funnel-step">
      <div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${Math.max(8, Math.round(s.n / max * 100))}%;background:${s.color}"></div></div>
      <div class="funnel-meta"><strong>${s.n}</strong><span>${s.label}</span></div>
    </div>`).join("")}</div>
    <small class="chart-note">Call rate ${A.callRate}% · Deal rate ${A.convRate}% · Close rate ${A.closeRate}%</small>`;
}

function outstandingList(list) {
  const rows = list
    .map(c => ({ c, due: Math.max(0, (Number(c.price) || 0) - (Number(c.paid) || 0)) }))
    .filter(x => x.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 6);
  if (!rows.length) return `<div class="empty">No outstanding balances.</div>`;
  return rows.map(({ c, due }) =>
    `<div class="act-row"><span class="dot" style="background:#ef4444"></span><div class="act-info"><strong>${esc(c.business)}</strong><small>${statusOf(c).replace(/-/g, " ")} · Quote ${money(c.price)} · Paid ${money(c.paid)}</small></div><small class="act-when money" style="color:#ef4444">${money(due)}</small></div>`
  ).join("");
}

function insightCard(item) {
  const cls = item.type === "alert" ? "insight alert" : item.type === "proj" ? "insight proj" : "insight tip";
  return `<div class="${cls}"><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p></div>`;
}

function dashboardHTML(list) {
  const A = computeAnalytics(list.length ? list : contacts);
  const adv = advisorInsights(A);
  const total = A.total || 1;

  const stats = `<div class="stat-grid stats-wide">
  <div class="stat-card"><strong>${A.total}</strong><small>Total contacts</small></div>
  <div class="stat-card"><strong>${A.calledN}</strong><small>Called</small></div>
  <div class="stat-card"><strong>${A.notCalled}</strong><small>Not called</small></div>
  <div class="stat-card"><strong>${A.pipelineN}</strong><small>In pipeline</small></div>
  <div class="stat-card"><strong>${A.counts.live}</strong><small>Live sites</small></div>
  <div class="stat-card"><strong>${A.leads}</strong><small>Leads</small></div>
  <div class="stat-card"><strong>${A.recall}</strong><small>Call again</small></div>
  <div class="stat-card"><strong>${A.overdueFU}</strong><small>Overdue FUs</small></div>
  <div class="stat-card"><strong>${money(A.revenue)}</strong><small>Money collected</small></div>
  <div class="stat-card"><strong>${money(A.pipelineValue)}</strong><small>Pipeline value</small></div>
  <div class="stat-card"><strong>${money(A.outstanding)}</strong><small>Outstanding</small></div>
  <div class="stat-card"><strong>${money(Math.round(A.avgDeal))}</strong><small>Avg deal size</small></div>
  <div class="stat-card"><strong>${A.convRate}%</strong><small>Call → deal</small></div>
  <div class="stat-card"><strong>${A.closeRate}%</strong><small>Call → live</small></div>
  <div class="stat-card"><strong>${A.collectionRate}%</strong><small>Collection rate</small></div>
  <div class="stat-card"><strong>${A.avgCallsPerDay}</strong><small>Calls / day (14d)</small></div>
</div>`;

  const legend = STATUSES.map(s =>
    `<div class="legend-row"><span class="dot" style="background:${s.color}"></span><span>${s.label}</span><strong>${A.counts[s.id]}</strong><small>${Math.round(A.counts[s.id] / total * 100)}%</small></div>`
  ).join("");

  const recent = contacts.filter(c => c.lastCalled)
    .sort((a, b) => new Date(b.lastCalled) - new Date(a.lastCalled)).slice(0, 6)
    .map(c => `<div class="act-row"><span class="dot" style="background:${(STATUSES.find(s => s.id === statusOf(c)) || {}).color}"></span><div class="act-info"><strong>${esc(c.business)}</strong><small>${esc(c.address || "—")}</small></div><small class="act-when">${esc(formatDate(c.lastCalled))}</small></div>`)
    .join("") || `<div class="empty">No calls logged yet.</div>`;

  const nextUp = contacts.filter(c => c.recall || (c.followUp && new Date(c.followUp) <= new Date())).slice(0, 6)
    .map(c => `<div class="act-row"><span class="dot" style="background:#f59e0b"></span><div class="act-info"><strong>${esc(c.business)}</strong><small>${esc(c.phone)}</small></div><small class="act-when">${c.followUp ? esc(c.followUp) : "Call again"}</small></div>`)
    .join("") || `<div class="empty">Nothing scheduled. You're all caught up.</div>`;

  const advisorBlock = `
<div class="advisor-panel">
  <div class="advisor-head">
    <div class="advisor-badge">Advisor</div>
    <div>
      <strong>Performance & projection insights</strong>
      <p>Generated from your current contacts, calls, pipeline and money — updates as you work.</p>
    </div>
  </div>
  <div class="insight-grid">
    ${adv.alerts.map(insightCard).join("")}
    ${adv.projections.map(insightCard).join("")}
    ${adv.tips.map(insightCard).join("")}
  </div>
</div>`;

  return stats + advisorBlock + `
<div class="dash-grid">
  <div class="dash-card"><h3>Sales funnel</h3>${funnelHTML(A)}</div>
  <div class="dash-card"><h3>Sales pipeline</h3><div class="donut-wrap">${donutSVG(A.counts)}<div class="legend">${legend}</div></div></div>
  <div class="dash-card"><h3>Calls — last 14 days</h3>${columnChart(A.last14)}</div>
  <div class="dash-card"><h3>Top places</h3>${placeBars(A.groups)}</div>
  <div class="dash-card"><h3>Outstanding balances</h3>${outstandingList(contacts)}</div>
  <div class="dash-card"><h3>Recent calls</h3>${recent}</div>
  <div class="dash-card"><h3>Next follow-ups</h3>${nextUp}</div>
  <div class="dash-card"><h3>Coverage snapshot</h3>
    <div class="cov-grid">
      <div><strong>${A.withNotes}</strong><span>With notes</span></div>
      <div><strong>${A.withWebsite}</strong><span>Have website</span></div>
      <div><strong>${A.withBuilt}</strong><span>Site we built</span></div>
      <div><strong>${A.placeCount}</strong><span>Places</span></div>
      <div><strong>${A.futureFU}</strong><span>Future FUs</span></div>
      <div><strong>${A.stale}</strong><span>Stale (14d+)</span></div>
      <div><strong>${A.calls7}</strong><span>Calls (7d)</span></div>
      <div><strong>${A.calls14}</strong><span>Calls (14d)</span></div>
    </div>
  </div>
</div>`;
}

function sitesHTML(list) {
  const sites = list.filter(c => safeWebsite(c.siteUrl) || statusOf(c) === "live");
  if (!sites.length) return `<div class="empty">No websites delivered yet. Go call and close some deals.</div>`;
  return sites.map(c => {
    const built = safeWebsite(c.siteUrl);
    return `<div class="site-row">
  <span class="serial">${esc(c.number || c.id)}</span>
  <div class="site-info">
    <strong>${esc(c.business)}</strong>
    <small>${esc(c.address || "—")} · <span class="number">${esc(c.phone)}</span></small>
    ${Number(c.price) > 0 ? `<small class="money">${money(c.price)}</small>` : ""}
    ${c.notes ? `<div class="note-preview">${esc(c.notes)}</div>` : ""}
  </div>
  <div class="site-actions">
    ${built ? `<a class="website-link live-link" href="${esc(built)}" target="_blank" rel="noopener">Open site</a>` : `<button type="button" onclick="markLive(${c.id})">Add site link</button>`}
    <button type="button" onclick="copyLink(${c.id})">Copy link</button>
    <button type="button" onclick="openWhatsApp(${c.id})">WhatsApp</button>
  </div>
</div>`;
  }).join("");
}

function render() {
  const q = document.querySelector("#search").value.toLowerCase();
  let list = contacts.filter(c =>
    (`${c.business || ""} ${c.address || ""} ${c.phone || ""} ${c.website || ""} ${c.number || ""} ${c.notes || ""} ${c.siteUrl || ""}`).toLowerCase().includes(q)
  );
  if (currentView === "recall") list = list.filter(c => c.recall);
  if (currentView === "leads") list = list.filter(c => c.lead);
  if (currentView === "followups") list = list.filter(c => c.recall || (c.followUp && new Date(c.followUp) <= new Date()));

  document.querySelector("#total").textContent = contacts.length;
  const box = document.querySelector("#contacts");
  const title = document.querySelector("#viewTitle");
  const head = document.querySelector(".table-head");
  const empty = document.querySelector("#empty");

  const titles = {
    all: "All Contacts",
    places: "Contacts grouped by place",
    recall: "Contacts to call again",
    dashboard: "Analytics dashboard",
    followups: "Follow-ups & call-backs",
    sites: "Websites we built",
    leads: "Leads / contacts to return to"
  };
  title.textContent = titles[currentView] || "All Contacts";
  head.style.display = (currentView === "dashboard" || currentView === "sites") ? "none" : "grid";

  if (currentView === "dashboard") {
    box.innerHTML = dashboardHTML(list);
    empty.style.display = "none";
    return;
  }
  if (currentView === "sites") {
    box.innerHTML = sitesHTML(list);
    empty.style.display = "none";
    return;
  }
  if (currentView === "places") {
    const groups = groupByPlace(list);
    box.innerHTML = Object.entries(groups).map(([place, items]) =>
      `<div class="place-group"><h3>${esc(place)} <small>(${items.length})</small></h3>${items.map(contactHTML).join("")}</div>`
    ).join("");
  } else {
    box.innerHTML = list.map(contactHTML).join("");
  }
  empty.style.display = list.length ? "none" : "block";
}

async function add(b, a, p, website = "", silentDuplicate = false, extra = {}) {
  b = String(b || "").trim();
  a = String(a || "").trim();
  p = cleanPhone(p);
  if (!b || !a || !p) {
    alert("Business name, address / place and contact number are required.");
    return false;
  }
  if (contacts.some(c => phoneKey(c.phone) === phoneKey(p))) {
    if (!silentDuplicate) alert(`Duplicate number detected: ${p}`);
    return false;
  }
  const site = safeWebsite(website);
  const rec = {
    number: nextNumber(),
    business: b,
    address: a,
    phone: p,
    website: site,
    created: new Date().toISOString(),
    called: false,
    lastCalled: null,
    notes: "",
    recall: false,
    lead: false,
    status: "not-called",
    price: 0,
    paid: 0,
    followUp: "",
    siteUrl: "",
    ...extra
  };
  if (!rec.siteUrl && rec.status === "live") rec.siteUrl = site;
  await put(rec);
  await refresh();
  return true;
}

window.openWhatsApp = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  window.open(`https://wa.me/${whatsappNumber(c.phone)}`, "_blank");
};

window.markCalled = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  c.called = true;
  c.lastCalled = new Date().toISOString();
  if (statusOf(c) === "not-called") c.status = "called";
  await update(c);
  await refresh();
};

window.editNotes = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  const note = prompt(`Notes for ${c.business}:`, c.notes || "");
  if (note === null) return;
  c.notes = note.trim();
  await update(c);
  await refresh();
};

window.toggleRecall = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  c.recall = !c.recall;
  await update(c);
  await refresh();
};

window.toggleLead = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  c.lead = !c.lead;
  await update(c);
  await refresh();
};

window.toggleAgreed = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  c.status = statusOf(c) === "agreed" ? "called" : "agreed";
  c.called = true;
  if (!c.lastCalled) c.lastCalled = new Date().toISOString();
  await update(c);
  await refresh();
};

window.setBuilding = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  if (statusOf(c) !== "agreed") {
    alert("Mark the deal as Agreed first.");
    return;
  }
  c.status = "building";
  c.called = true;
  await update(c);
  await refresh();
};

window.markLive = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  const url = prompt("Link of the website we built (e.g. client.co.za):", c.siteUrl || "");
  if (url === null) return;
  const site = safeWebsite(url);
  if (!site) {
    alert("Invalid website link.");
    return;
  }
  c.siteUrl = site;
  c.status = "live";
  c.called = true;
  if (!c.lastCalled) c.lastCalled = new Date().toISOString();
  const price = prompt("Price charged for the website (R):", c.price || "");
  if (price !== null && String(price).trim() !== "") c.price = Number(price) || 0;
  const paid = prompt("Amount paid so far (R):", c.paid || "");
  if (paid !== null && String(paid).trim() !== "") c.paid = Number(paid) || 0;
  await update(c);
  await refresh();
};

window.copyLink = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  const link = c.siteUrl || safeWebsite(c.website);
  if (!link) {
    alert("No site link saved.");
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    alert("Link copied:\n" + link);
  } catch {
    prompt("Copy this link:", link);
  }
};

window.removeContact = async id => {
  if (confirm("Delete this contact?")) {
    await del(id);
    const remaining = await all();
    remaining.sort((a, b) => (a.number || a.id) - (b.number || b.id));
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].number = i + 1;
      await update(remaining[i]);
    }
    await refresh();
  }
};

window.editContact = async id => {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  const b = prompt("Business name:", c.business);
  if (b === null) return;
  const a = prompt("Business address / place:", c.address || "");
  if (a === null) return;
  const p = prompt("Contact number / WhatsApp:", c.phone);
  if (p === null) return;
  const website = prompt("Their current website (optional):", c.website || "");
  if (website === null) return;
  const price = prompt("Quote price (R):", c.price || "");
  if (price === null) return;
  const paid = prompt("Amount paid (R):", c.paid || "");
  if (paid === null) return;
  const followUp = prompt("Follow-up date (YYYY-MM-DD, optional):", c.followUp || "");
  if (followUp === null) return;
  const siteUrl = prompt("Link of the website we built (optional):", c.siteUrl || "");
  if (siteUrl === null) return;
  const phone = cleanPhone(p);
  if (!b.trim() || !a.trim() || !phone) {
    alert("Business name, address and number are required.");
    return;
  }
  if (contacts.some(x => x.id !== id && phoneKey(x.phone) === phoneKey(phone))) {
    alert("Duplicate number detected.");
    return;
  }
  c.business = b.trim();
  c.address = a.trim();
  c.phone = phone;
  c.website = safeWebsite(website);
  c.price = Number(price) || 0;
  c.paid = Number(paid) || 0;
  c.followUp = /^\d{4}-\d{2}-\d{2}$/.test(followUp.trim()) ? followUp.trim() : "";
  c.siteUrl = safeWebsite(siteUrl);
  if (c.siteUrl) c.status = "live";
  else if (statusOf(c) === "live") c.status = "called";
  await update(c);
  await refresh();
};

document.querySelector("#addBtn").onclick = async () => {
  const ok = await add(
    document.querySelector("#business").value,
    document.querySelector("#address").value,
    document.querySelector("#phone").value,
    document.querySelector("#website").value,
    false,
    { price: Number(document.querySelector("#price").value) || 0 }
  );
  if (ok) {
    document.querySelector("#phone").value = "";
    document.querySelector("#website").value = "";
    document.querySelector("#price").value = "";
  }
};

document.querySelector("#bulkBtn").onclick = async () => {
  const address = document.querySelector("#address").value.trim();
  if (!address) {
    alert("Enter the business address / place first. All bulk contacts will use this same place.");
    return;
  }
  const lines = document.querySelector("#bulkInput").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) {
    alert("Paste at least one business name and contact number.");
    return;
  }
  let n = 0, skipped = 0;
  for (const line of lines) {
    let parts = line.split(/\s*(?:,|\||\t)\s*/);
    if (parts.length < 2) {
      const m = line.match(/^(.*?)(?:\s+-\s+)([+\d][\d\s()\-]{6,})$/);
      parts = m ? [m[1], m[2]] : [];
    }
    if (parts.length < 2) { skipped++; continue; }
    const phone = parts.pop().trim();
    const business = parts.join(", ").trim();
    if (await add(business, address, phone, "", true)) n++;
    else skipped++;
  }
  if (n) document.querySelector("#bulkInput").value = "";
  alert(`${n} contact(s) saved with the same place: ${address}. ${skipped ? skipped + " skipped (check the format or duplicates)." : ""}`);
};

document.querySelector("#search").oninput = render;

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.querySelector("#csvBtn").onclick = () => {
  const rows = [
    ["No.", "Business Name", "Address / Place", "Contact Number", "Website", "Status", "Called", "Last Called", "Price (R)", "Paid (R)", "Follow-Up", "Site We Built", "Notes"],
    ...contacts.map(c => [
      c.number || c.id, c.business, c.address || "", c.phone, c.website || "", statusOf(c),
      c.called ? "YES" : "NO", c.lastCalled || "", Number(c.price) || 0, Number(c.paid) || 0,
      c.followUp || "", c.siteUrl || "", c.notes || ""
    ])
  ];
  const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  download("uhuru-contact-base.csv", csv, "text/csv");
};

document.querySelector("#vcfBtn").onclick = () => {
  const v = contacts.map(c =>
    `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${c.business}\r\nORG:${c.business}\r\nADR:;;${c.address || ""};;;;\r\nTEL;TYPE=CELL,VOICE:${c.phone}${c.website ? `\r\nURL:${c.website}` : ""}${c.siteUrl ? `\r\nURL:${c.siteUrl}` : ""}\r\nNOTE:Contact No. ${c.number || c.id} | Status: ${statusOf(c)}\r\nEND:VCARD`
  ).join("\r\n");
  download("uhuru-contact-base.vcf", v, "text/vcard");
};

document.querySelector("#backupBtn").onclick = () =>
  download("uhuru-contact-base-backup.json", JSON.stringify(contacts, null, 2), "application/json");

document.querySelector("#csvFile").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    const lines = r.result.split(/\r?\n/).filter(Boolean);
    let n = 0;
    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(x => x.replace(/^"|"$/g, "").replaceAll('""', '"').trim()) || [];
      if (i === 0 && /business/i.test(lines[i])) continue;
      let b, a, p, website = "", status = "", price = 0, paid = 0, followUp = "", siteUrl = "", notes = "";
      if (cols.length >= 13) [, b, a, p, website, status, , , price, paid, followUp, siteUrl, notes] = cols;
      else if (cols.length >= 8) [, b, a, p, website, , , notes] = cols;
      else if (cols.length >= 5) [, b, a, p, website] = cols;
      else if (cols.length >= 4) [, b, a, p] = cols;
      else if (cols.length >= 3) [b, a, p] = cols;
      else continue;
      const extra = { notes: notes || "", price: Number(price) || 0, paid: Number(paid) || 0, followUp: followUp || "", siteUrl: siteUrl || "" };
      if (STATUSES.some(s => s.id === status)) extra.status = status;
      if (await add(b, a, p, website, true, extra)) n++;
    }
    alert(`${n} contact(s) imported.`);
  };
  r.readAsText(f);
  e.target.value = "";
};

document.querySelector("#jsonFile").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const data = JSON.parse(r.result);
      let n = 0;
      for (const c of data) {
        const extra = { ...c };
        delete extra.id;
        delete extra.number;
        delete extra.business;
        delete extra.address;
        delete extra.phone;
        if (await add(c.business, c.address || "Not specified", c.phone, c.website || "", true, extra)) {
          const added = contacts.find(x => phoneKey(x.phone) === phoneKey(c.phone));
          if (added) await update({ ...added, ...extra, id: added.id, number: added.number });
          n++;
        }
      }
      await refresh();
      alert(`${n} contact(s) restored.`);
    } catch {
      alert("Invalid backup file.");
    }
  };
  r.readAsText(f);
  e.target.value = "";
};

document.querySelector("#dedupeBtn").onclick = async () => {
  const seen = new Set();
  let removed = 0;
  const sorted = [...contacts].sort((a, b) => (a.number || a.id) - (b.number || b.id));
  for (const c of sorted) {
    const key = phoneKey(c.phone);
    if (key && seen.has(key)) {
      await del(c.id);
      removed++;
    } else if (key) seen.add(key);
  }
  await refresh();
  alert(removed ? `${removed} duplicate contact(s) removed.` : "No duplicate numbers found.");
};

document.querySelector("#clearBtn").onclick = async () => {
  if (confirm("Delete all local contacts? This cannot be undone.")) {
    await clearDB();
    await refresh();
  }
};

document.querySelectorAll("#viewTabs button").forEach(btn => {
  btn.onclick = () => {
    currentView = btn.dataset.view;
    document.querySelectorAll("#viewTabs button").forEach(b => b.classList.toggle("active", b === btn));
    render();
  };
});

openDB().then(refresh).catch(err => alert("Database error: " + err.message));

const THEME_KEY = "UhuruContactBaseTheme";
function applyTheme(theme) {
  document.body.dataset.theme = theme === "iphone" || theme === "light" ? "light" : "";
  localStorage.setItem(THEME_KEY, theme === "iphone" || theme === "light" ? "light" : "dark");
  const btn = document.querySelector("#themeToggle");
  if (btn) btn.textContent = (theme === "iphone" || theme === "light") ? "Dark View" : "Light View";
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    (theme === "iphone" || theme === "light") ? "#f4f5f7" : "#0b0d12"
  );
}
const saved = localStorage.getItem(THEME_KEY);
applyTheme(saved === "iphone" || saved === "light" ? "light" : "dark");
document.querySelector("#themeToggle").onclick = () => {
  const next = document.body.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
};

function unfoldVCard(text) { return text.replace(/\r?\n[ \t]/g, ""); }

function parseVCardFile(text) {
  const cards = unfoldVCard(text).split(/END:VCARD/i);
  const results = [];
  for (const card of cards) {
    if (!/BEGIN:VCARD/i.test(card)) continue;
    const lines = card.split(/\r?\n/);
    let name = "", org = "", address = "", website = "", phones = [];
    for (let line of lines) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).toUpperCase(), value = line.slice(idx + 1).trim();
      if (key.startsWith("FN")) name = value;
      else if (key.startsWith("ORG")) org = value.replace(/;/g, " ");
      else if (key.startsWith("ADR")) address = value.split(";").filter(Boolean).join(", ");
      else if (key.startsWith("URL")) website = value;
      else if (key.startsWith("TEL")) phones.push(value);
    }
    const business = (org || name || "Unnamed Contact").trim();
    for (const phone of phones) results.push({ business, address: address || "Imported Contact", phone, website });
  }
  return results;
}

document.querySelector("#contactFile").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    const imported = parseVCardFile(String(r.result || ""));
    if (!imported.length) {
      alert("No phone contacts were found in this file. Please import a .vcf / vCard file.");
      return;
    }
    let saved = 0, skipped = 0;
    for (const c of imported) {
      if (await add(c.business, c.address, c.phone, c.website || "", true)) saved++;
      else skipped++;
    }
    alert(`${saved} contact(s) imported. ${skipped ? skipped + " skipped (invalid or duplicate)." : ""}`);
  };
  r.readAsText(f);
  e.target.value = "";
};
