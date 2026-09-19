const $ = (id) => document.getElementById(id);
const KEY = "saturday-receipt-v01";

const lastSaturday = () => {
  const d = new Date();
  const day = d.getDay();
  const back = day === 6 ? 7 : day + 1;
  d.setDate(d.getDate() - back);
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
};

const weekEnd = (start) => {
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0,10);
};

const money = (n) => {
  if (n === "" || n === null || Number.isNaN(Number(n))) return "";
  return Number(n).toFixed(2);
};

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyGrocery = () => ({
  id: uid(), date: "", merchant: "", item: "", paid: "", better: "",
  column: "captured", source: "docket", note: ""
});

const emptyFuel = () => ({
  id: uid(), date: "", station: "", litres: "", paidCpl: "",
  betterCpl: "", betterStation: "", source: "FuelWatch", note: ""
});

let state = {
  name: "", suburb: "", weekStart: lastSaturday(), radius: 5,
  groceries: [emptyGrocery()], fuels: [emptyFuel()]
};

const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state = { ...state, ...parsed };
    if (!state.groceries?.length) state.groceries = [emptyGrocery()];
    if (!state.fuels?.length) state.fuels = [emptyFuel()];
  } catch (e) {}
};

const groceryFields = (g) => `
  <div class="row">
    <div><label>Date</label><input type="date" data-g="${g.id}" data-k="date" value="${g.date || ""}"></div>
    <div><label>Merchant</label><input data-g="${g.id}" data-k="merchant" value="${g.merchant || ""}" placeholder="Woolworths Harrisdale"></div>
  </div>
  <div class="row">
    <div><label>Item</label><input data-g="${g.id}" data-k="item" value="${g.item || ""}" placeholder="Full cream 2L"></div>
    <div><label>Paid $</label><input type="number" step="0.01" min="0" data-g="${g.id}" data-k="paid" value="${g.paid || ""}"></div>
  </div>
  <div class="row">
    <div><label>Better $</label><input type="number" step="0.01" min="0" data-g="${g.id}" data-k="better" value="${g.better || ""}"></div>
    <div>
      <label>Column</label>
      <select data-g="${g.id}" data-k="column">
        <option value="captured" ${g.column==="captured"?"selected":""}>Captured</option>
        <option value="missed" ${g.column==="missed"?"selected":""}>Missed</option>
        <option value="unknown" ${g.column==="unknown"?"selected":""}>Unknown</option>
      </select>
    </div>
  </div>
  <div class="row">
    <div><label>Source</label><input data-g="${g.id}" data-k="source" value="${g.source || ""}" placeholder="docket / specials catalogue date"></div>
    <div><label>Note</label><input data-g="${g.id}" data-k="note" value="${g.note || ""}"></div>
  </div>
  <button class="btn danger" type="button" data-del-g="${g.id}">Remove line</button>
`;

const fuelFields = (f) => `
  <div class="row">
    <div><label>Date</label><input type="date" data-f="${f.id}" data-k="date" value="${f.date || ""}"></div>
    <div><label>Station paid</label><input data-f="${f.id}" data-k="station" value="${f.station || ""}" placeholder="Ampol Armadale Rd"></div>
  </div>
  <div class="row">
    <div><label>Litres</label><input type="number" step="0.01" min="0" data-f="${f.id}" data-k="litres" value="${f.litres || ""}"></div>
    <div><label>Paid c/L</label><input type="number" step="0.1" min="0" data-f="${f.id}" data-k="paidCpl" value="${f.paidCpl || ""}" placeholder="189.9"></div>
  </div>
  <div class="row">
    <div><label>Better c/L (FuelWatch)</label><input type="number" step="0.1" min="0" data-f="${f.id}" data-k="betterCpl" value="${f.betterCpl || ""}" placeholder="181.9"></div>
    <div><label>Better station + km</label><input data-f="${f.id}" data-k="betterStation" value="${f.betterStation || ""}" placeholder="Puma Haynes 2.4km"></div>
  </div>
  <div class="row">
    <div><label>Source</label><input data-f="${f.id}" data-k="source" value="${f.source || "FuelWatch"}"></div>
    <div><label>Note</label><input data-f="${f.id}" data-k="note" value="${f.note || ""}"></div>
  </div>
  <button class="btn danger" type="button" data-del-f="${f.id}">Remove fill</button>
`;

const renderForms = () => {
  $("name").value = state.name;
  $("suburb").value = state.suburb;
  $("weekStart").value = state.weekStart;
  $("radius").value = state.radius;
  $("groceryList").innerHTML = state.groceries.map(g => `<div class="line">${groceryFields(g)}</div>`).join("");
  $("fuelList").innerHTML = state.fuels.map(f => `<div class="line">${fuelFields(f)}</div>`).join("");
};

const compute = () => {
  const lines = [];
  let spent = 0, captured = 0, missed = 0, unknown = 0;
  state.groceries.forEach((g) => {
    if (!g.item && !g.paid && !g.merchant) return;
    const paid = Number(g.paid || 0);
    const better = g.better === "" || g.better == null ? null : Number(g.better);
    spent += paid;
    let saved = 0;
    let column = g.column || "unknown";
    if (better == null || Number.isNaN(better) || !g.source) column = "unknown";
    else if (better < paid) saved = +(paid - better).toFixed(2);
    else saved = 0;
    if (column === "captured") captured += saved;
    else if (column === "missed") missed += saved;
    else unknown += 1;
    lines.push({
      date: g.date || "",
      what: `${g.merchant || "Grocery"} — ${g.item || "item"}`,
      paid, better, saved, column,
      source: g.source || "",
      confidence: column === "unknown" ? "unknown" : (g.source || "").toLowerCase().includes("docket") ? "docket" : "matched"
    });
  });
  state.fuels.forEach((f) => {
    if (!f.litres && !f.paidCpl && !f.station) return;
    const litres = Number(f.litres || 0);
    const paidCpl = Number(f.paidCpl || 0);
    const betterCpl = f.betterCpl === "" || f.betterCpl == null ? null : Number(f.betterCpl);
    const paid = litres && paidCpl ? +(litres * paidCpl / 100).toFixed(2) : 0;
    spent += paid;
    let saved = 0;
    let column = "unknown";
    if (betterCpl == null || Number.isNaN(betterCpl) || !f.source) { column = "unknown"; unknown += 1; }
    else if (betterCpl < paidCpl && litres) {
      saved = +(litres * (paidCpl - betterCpl) / 100).toFixed(2);
      column = "missed"; missed += saved;
    } else { column = "captured"; }
    const what = `${f.station || "Fuel"} — ${litres || "?"} L @ ${paidCpl || "?"}c` + (f.betterStation ? ` / better ${f.betterStation}` : "");
    lines.push({
      date: f.date || "", what, paid,
      better: betterCpl == null ? null : +(litres * betterCpl / 100).toFixed(2),
      saved, column, source: f.source || "FuelWatch",
      confidence: column === "unknown" ? "unknown" : "official"
    });
  });
  return {
    spent: +spent.toFixed(2), captured: +captured.toFixed(2), missed: +missed.toFixed(2),
    unknown, netNothing: +captured.toFixed(2), netCareful: +(captured + missed).toFixed(2), lines
  };
};

const showReceipt = () => {
  const c = compute();
  const start = state.weekStart;
  const end = weekEnd(start);
  $("totals").innerHTML = `
    <div class="tot"><span>Spent on tracked buys</span><b>$${money(c.spent)}</b></div>
    <div class="tot captured"><span>Captured</span><b>$${money(c.captured)}</b></div>
    <div class="tot missed"><span>Missed</span><b>$${money(c.missed)}</b></div>
    <div class="tot"><span>Unknown lines</span><b>${c.unknown}</b></div>`;
  $("rows").innerHTML = c.lines.length ? c.lines.map(l => `
    <tr>
      <td>${l.date || "—"}</td>
      <td>${l.what}</td>
      <td>${l.paid ? "$"+money(l.paid) : "—"}</td>
      <td>${l.better == null ? "—" : "$"+money(l.better)}</td>
      <td>${l.saved ? "$"+money(l.saved) : "$0.00"}</td>
      <td><span class="pill ${l.column}">${l.column}</span></td>
      <td>${l.source || "—"}<br><span class="hint">${l.confidence}</span></td>
    </tr>`).join("") : `<tr><td colspan="7">No dockets this week. Spent unknown. Captured unknown. Missed unknown.</td></tr>`;
  const header = [
    `SATURDAY RECEIPT`,
    `${state.name || "Household"} · ${state.suburb || "suburb not set"}`,
    `Week ${start} to ${end} AWST`,
    `Fuel miss radius ${state.radius} km`,
    ``,
    `Spent on tracked buys     $${money(c.spent)}`,
    `Captured                  $${money(c.captured)}`,
    `Missed                    $${money(c.missed)}`,
    `Net vs doing nothing      $${money(c.netNothing)}`,
    `Net vs a careful week     $${money(c.netCareful)}`,
    `Unknown lines             ${c.unknown}`,
    ``,
    `as_of | what | paid | better | saved | column | source | confidence`
  ];
  const body = c.lines.map(l => `${l.date || "undated"} | ${l.what} | ${l.paid ?? ""} | ${l.better ?? ""} | ${l.saved} | ${l.column} | ${l.source} | ${l.confidence}`);
  const foot = [``,
    `A dollar counts only with purchase + paid price + dated better number + source.`,
    `Unknown is not zero. Demo lines, if any, are not your money.`,
    `Built ${new Date().toISOString().slice(0,16).replace("T"," ")} UTC · Saturday Receipt v0.1`];
  $("plain").textContent = [...header, ...body, ...foot].join("\n");
};

const switchTab = (name) => {
  ["intake","receipt","rules","pilot"].forEach((id) => $(id).classList.toggle("hidden", id !== name));
  document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
};

document.querySelector("nav.tabs").addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.tab === "receipt") showReceipt();
  switchTab(t.dataset.tab);
});

const bindState = () => {
  ["name","suburb","weekStart","radius"].forEach((k) => {
    $(k).addEventListener("input", () => {
      state[k] = k === "radius" ? Number($(k).value) : $(k).value;
      save();
    });
  });
};

$("groceryList").addEventListener("input", (e) => {
  const id = e.target.dataset.g, k = e.target.dataset.k;
  if (!id) return;
  const g = state.groceries.find(x => x.id === id);
  if (!g) return;
  g[k] = e.target.value; save();
});
$("groceryList").addEventListener("click", (e) => {
  const id = e.target.dataset.delG;
  if (!id) return;
  state.groceries = state.groceries.filter(x => x.id !== id);
  if (!state.groceries.length) state.groceries.push(emptyGrocery());
  save(); renderForms();
});
$("fuelList").addEventListener("input", (e) => {
  const id = e.target.dataset.f, k = e.target.dataset.k;
  if (!id) return;
  const f = state.fuels.find(x => x.id === id);
  if (!f) return;
  f[k] = e.target.value; save();
});
$("fuelList").addEventListener("click", (e) => {
  const id = e.target.dataset.delF;
  if (!id) return;
  state.fuels = state.fuels.filter(x => x.id !== id);
  if (!state.fuels.length) state.fuels.push(emptyFuel());
  save(); renderForms();
});

$("addGrocery").onclick = () => { state.groceries.push(emptyGrocery()); save(); renderForms(); };
$("addFuel").onclick = () => { state.fuels.push(emptyFuel()); save(); renderForms(); };
$("build").onclick = () => { save(); showReceipt(); switchTab("receipt"); };
$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("plain").textContent);
    $("copy").textContent = "Copied";
    setTimeout(() => $("copy").textContent = "Copy receipt", 1200);
  } catch (err) { $("copy").textContent = "Select the text and copy"; }
};
$("print").onclick = () => window.print();
$("wipe").onclick = () => {
  if (!confirm("Clear all Saturday Receipt data on this device?")) return;
  localStorage.removeItem(KEY);
  state = { name: "", suburb: "", weekStart: lastSaturday(), radius: 5, groceries: [emptyGrocery()], fuels: [emptyFuel()] };
  renderForms(); switchTab("intake");
};
$("demo").onclick = () => {
  state = {
    name: "DEMO household", suburb: "Harrisdale", weekStart: lastSaturday(), radius: 5,
    groceries: [
      { id: uid(), date: lastSaturday(), merchant: "Woolworths Harrisdale", item: "DEMO Full cream 2L", paid: "3.50", better: "2.80", column: "captured", source: "docket special", note: "DEMO" },
      { id: uid(), date: lastSaturday(), merchant: "Woolworths Harrisdale", item: "DEMO bananas 1kg", paid: "4.90", better: "", column: "unknown", source: "", note: "DEMO no better source" }
    ],
    fuels: [
      { id: uid(), date: lastSaturday(), station: "DEMO Ampol Armadale Rd", litres: "41.2", paidCpl: "189.9", betterCpl: "181.9", betterStation: "Puma Haynes 2.4km", source: "FuelWatch (DEMO figures)", note: "DEMO not a real fill" }
    ]
  };
  save(); renderForms(); showReceipt(); switchTab("receipt");
};

load();
renderForms();
bindState();
