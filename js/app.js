const $ = (s) => document.querySelector(s),
  K = "zippy-controle-v2",
  LEGACY_K = "zippy-controle-v1";
try {
  localStorage.removeItem(LEGACY_K);
} catch (e) {}
const fi = (d) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");
const ds = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return fi(d);
};
const br = (s) => s.split("-").reverse().join("/"),
  escHtml = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    ),
  R = (v) => (+v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  N = (n) => (+n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const now = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
  OPEN = ["enviado", "aprovado"];
const I = (id, name, sector, cat, unit, bu, conv, min, ideal, sup, stock, age) => ({
  id,
  name,
  sector,
  cat,
  unit,
  bu,
  conv,
  min,
  ideal,
  sup,
  stock,
  on: 1,
  lc: { q: stock, at: ds(-age), rec: 0, waste: 0 },
});
function seed() {
  return {
    uid: "admin",
    v: "cad",
    th: null,
    sectors: [],
    u: [{ id: "admin", name: "Administrador", role: "admin" }],
    s: [],
    i: [],
    cs: {},
    w: [],
    qt: [],
    o: [],
    notes: [],
    log: [],
  };
}
let S;
try {
  S = JSON.parse(localStorage.getItem(K));
} catch (e) {}
S = S || seed();
if (!Array.isArray(S.sectors)) {
  S.sectors = [
    ...new Set([
      ...S.i.map((i) => i.sector),
      ...S.u.map((u) => u.sector).filter(Boolean),
    ]),
  ];
}
let RID;
let supplierBatch = [];
const supplierNameKey = (name) => name.trim().toLocaleLowerCase();
const formatSupplierPhone = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return "(" + digits;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}${digits.length > 7 ? "-" + digits.slice(7) : ""}`;
};
const validateSupplierContact = (name, contact) => {
  if (!name.trim()) throw Error("Informe o nome do fornecedor.");
  const digits = contact.replace(/\D/g, "");
  if (!/^[1-9]\d9\d{8}$/.test(digits) || /[^\d\s()+-]/.test(contact))
    throw Error("Informe um celular válido com DDD: (11) 99999-9999.");
  return formatSupplierPhone(digits);
};
const renderSupplierBatch = () => {
  $("#supplier-batch-list").innerHTML = tb(
    ["Nome", "Contato", "Prazo (dias)", "Ações"],
    supplierBatch.map((supplier, index) => [
      escHtml(supplier.name),
      escHtml(supplier.contact || "Sem contato cadastrado"),
      supplier.lead,
      `<button class="x sm" type="button" aria-label="Remover ${escHtml(supplier.name)} da lista" onclick="A.removeSupplierFromBatch(${index})">Remover</button>`,
    ]),
  );
  $("#supplier-batch-save").disabled = !supplierBatch.length;
};
let itemImportDraft = null;
let itemImportRows = null;
let itemImportOptions = { sector: "", supplier: null };
const save = () => {
  try {
    localStorage.setItem(K, JSON.stringify(S));
  } catch (e) {}
};
const me = () => S.u.find((x) => x.id == S.uid),
  item = (id) => S.i.find((x) => x.id == id),
  sup = (id) => S.s.find((x) => x.id == id),
  activeSuppliers = () => S.s.filter((supplier) => !supplier.deleted && supplier.on !== 0),
  ord = (id) => S.o.find((x) => x.id == id),
  nm = (id) => item(id).name;
const items = (sec) => S.i.filter((i) => !i.deleted && i.on && (!sec || i.sector == sec));
const nextOrderId = () => {
  S.orderSequence = Math.max(S.orderSequence || 0, ...S.o.map((o) => Number(o.id.slice(2)))) + 1;
  return "P-" + String(S.orderSequence).padStart(3, "0");
};
const log = (m) => S.log.unshift({ t: now(), u: me().name, m });
const PERM = {
  count: ["func", "gestor", "admin"],
  waste: ["func", "gestor", "admin"],
  recv: ["func", "gestor", "compras", "admin"],
  ord: ["compras", "admin"],
  cad: ["admin"],
};
const guard = (a) => {
  if (!PERM[a].includes(me().role)) throw Error("Sem permissão para esta ação.");
};
const gs = (sec) => {
  if (me().role == "func" && me().sector != sec) throw Error("Setor não autorizado.");
};
const T =
  (f) =>
  (...a) => {
    try {
      f(...a);
      save();
      render();
    } catch (e) {
      alert(e.message);
    }
  };
const NAV = [
  ["dash", "Visão geral", ["analista", "gestor", "compras", "admin"]],
  ["count", "Contagens", ["func", "gestor", "admin"]],
  ["stock", "Estoque", ["analista", "gestor", "compras", "admin"]],
  ["orders", "Pedidos e cotações", ["compras", "admin"]],
  ["deliv", "Entregas", ["func", "gestor", "compras", "admin"]],
  ["waste", "Desperdícios", ["func", "gestor", "admin"]],
  ["sup", "Fornecedores", ["compras", "admin"]],
  ["cad", "Cadastros", ["admin"]],
  ["log", "Histórico", ["analista", "gestor", "compras", "admin"]],
];
const navIcon = (id) => {
  const paths = {
    dash: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    count: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM8 13l2 2 5-5M9 18h6"/>',
    stock: '<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l9 4"/>',
    orders: '<path d="M3 3h2l3 13h11l2-9H6M9 20h.01M18 20h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    deliv: '<path d="M3 5h11v12H3zM14 9h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    waste: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    sup: '<path d="M3 21V8l9-5 9 5v13M3 21h18M8 21v-6h8v6M8 9h1M15 9h1"/>',
    cad: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M12 12v6M9 15h6"/>',
    log: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
    collapse: '<path d="m14 7-5 5 5 5"/>',
  };
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.cad}</svg>`;
};
const navigation = (entries) =>
  `<nav class="app-nav ${S.navCollapsed ? "is-collapsed" : ""}" aria-label="Menu principal">
    <button class="nav-toggle" type="button" aria-expanded="${!S.navCollapsed}" aria-controls="nav-links" aria-label="${S.navCollapsed ? "Expandir menu" : "Recolher menu"}" title="${S.navCollapsed ? "Expandir menu" : "Recolher menu"}" onclick="A.toggleNavigation()">
      ${navIcon("collapse")}<span class="nav-label">Recolher menu</span>
    </button>
    <div id="nav-links" class="nav-links">${entries.map(([id, label]) =>
      `<button class="nav-link ${id == S.v ? "on" : ""}" type="button" aria-label="${label}" ${id == S.v ? 'aria-current="page"' : ""} title="${label}" onclick="A.nav('${id}')">${navIcon(id)}<span class="nav-label">${label}</span></button>`,
    ).join("")}</div>
  </nav>`;
const lvl = (i) =>
  i.stock < i.min
    ? ["Abaixo do mínimo", "er"]
    : i.stock <= i.min * 1.25
      ? ["Próximo do mínimo", "wa"]
      : ["Dentro do esperado", "ok"];
const stale = (i) => (new Date(ds(0)) - new Date(i.lc.at)) / 864e5 > 7;
const bd = (t, c) => `<span class="bd ${c}">${t}</span>`;
const tb = (h, r) =>
  `<div class="tw"><table><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr>${r.map((x) => `<tr>${x.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") || `<tr><td colspan=${h.length} class="mu">Sem registros</td></tr>`}</table></div>`;
const knownUnits = (field) => {
  const units = new Map();
  S.i.forEach((i) => {
    const unit = i[field]?.trim(),
      key = unit?.toLocaleLowerCase();
    if (key && !units.has(key)) units.set(key, unit);
  });
  return [...units.values()];
};
const unitOptions = (field) =>
  knownUnits(field).map((unit) => `<option value="${escHtml(unit)}"></option>`).join("");
const normalizeImportHeader = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const parseDelimitedText = (text) => {
  const firstLine = String(text).split(/\r?\n/, 1)[0] || "",
    delimiter = [";", "\t", ","].sort(
      (a, b) => firstLine.split(b).length - firstLine.split(a).length,
    )[0];
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  if (rows.length) rows[0][0] = String(rows[0][0]).replace(/^\uFEFF/, "");
  return rows;
};
const prepareItemImport = (rows, defaultSector, supplierId) => {
  const aliases = {
      name: ["item", "nome", "produto", "descricao", "nomedoitem", "descricaodoitem"],
      sector: ["setor", "area"],
      category: ["categoria", "grupo"],
      unit: ["unidade", "unidadedecontagem", "unidadecontagem", "unidadedemedida", "und"],
      stock: ["saldo", "saldoinicial", "estoque", "quantidade", "qtd"],
      minimum: ["minimo", "estoqueminimo"],
      ideal: ["ideal", "estoqueideal"],
    },
    headerIndex = rows.findIndex((row) => row.some((value) => String(value).trim())),
    header = headerIndex < 0 ? [] : rows[headerIndex].map(normalizeImportHeader),
    columns = Object.fromEntries(
      Object.entries(aliases).map(([field, names]) => [
        field,
        header.findIndex((value) => names.includes(value)),
      ]),
    ),
    valid = [],
    duplicates = [],
    invalid = [],
    existing = new Set(
      S.i.map((entry) => `${normalizeImportHeader(entry.sector)}:${normalizeImportHeader(entry.name)}`),
    ),
    seen = new Set();
  if (columns.name < 0) {
    return {
      valid,
      duplicates,
      invalid: [{ row: headerIndex + 1, reason: "Não encontrei uma coluna de item, nome, produto ou descrição." }],
    };
  }
  const sectors = new Map(S.sectors.map((sector) => [normalizeImportHeader(sector), sector])),
    supplier = activeSuppliers().find((entry) => entry.id == supplierId);
  rows.slice(headerIndex + 1).forEach((values, index) => {
    const rowNumber = headerIndex + index + 2;
    if (!values.some((value) => String(value).trim())) return;
    const name = String(values[columns.name] ?? "").trim();
    if (!name) {
      invalid.push({ row: rowNumber, reason: "Nome do item vazio." });
      return;
    }
    if (/[<>]/.test(name) || /[\u0000-\u001f]/.test(name)) {
      invalid.push({ row: rowNumber, reason: "Nome do item contém caracteres não permitidos." });
      return;
    }
    const rawSector =
        columns.sector >= 0 ? String(values[columns.sector] ?? "").trim() : "",
      sectorValue = rawSector || defaultSector,
      sector = sectors.get(normalizeImportHeader(sectorValue));
    if (!sector) {
      invalid.push({
        row: rowNumber,
        reason: sectorValue
          ? `Setor "${sectorValue}" não cadastrado.`
          : "Informe um setor na planilha ou selecione um setor padrão.",
      });
      return;
    }
    const key = `${normalizeImportHeader(sector)}:${normalizeImportHeader(name)}`;
    if (existing.has(key) || seen.has(key)) {
      duplicates.push({ row: rowNumber, name, sector });
      return;
    }
    const number = (field, label) => {
      if (columns[field] < 0 || !String(values[columns[field]] ?? "").trim()) return 0;
      const raw = String(values[columns[field]]).trim().replace(/\s/g, "");
      const normalized = raw.includes(",")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw;
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed) || parsed < 0) throw Error(`${label} inválido.`);
      return parsed;
    };
    try {
      const minimum = number("minimum", "Mínimo"),
        ideal = number("ideal", "Ideal"),
        stock = number("stock", "Saldo");
      if (ideal < minimum) throw Error("O ideal não pode ser menor que o mínimo.");
      const unit =
        columns.unit >= 0 && String(values[columns.unit] ?? "").trim()
          ? String(values[columns.unit]).trim()
          : "unidade";
      const category =
        columns.category >= 0 && String(values[columns.category] ?? "").trim()
          ? String(values[columns.category]).trim()
          : "Geral";
      if (/[<>]/.test(unit) || /[\u0000-\u001f]/.test(unit)) throw Error("Unidade contém caracteres não permitidos.");
      if (/[<>]/.test(category) || /[\u0000-\u001f]/.test(category))
        throw Error("Categoria contém caracteres não permitidos.");
      valid.push({
        row: rowNumber,
        name,
        sector,
        category,
        unit,
        stock,
        minimum,
        ideal,
        supplier: supplier?.id || "",
      });
      seen.add(key);
    } catch (error) {
      invalid.push({ row: rowNumber, reason: error.message });
    }
  });
  return { valid, duplicates, invalid };
};
const cost = (id) => {
  const q = S.qt.filter((x) => x.item == id).pop();
  return q ? q.price / item(id).conv : 0;
};
const late = (o) => OPEN.includes(o.st) && o.eta < ds(0),
  today = (o) => OPEN.includes(o.st) && o.eta == ds(0);
const stc = {
  rascunho: "wa",
  "aguardando aprovação": "wa",
  "em cotação": "wa",
  aprovado: "ok",
  enviado: "ok",
  "recebido parcialmente": "wa",
  recebido: "ok",
  "com divergência": "er",
  cancelado: "er",
};
const V = {};
V.dash = () => {
  const f = S.f || "",
    its = items(f),
    op = S.o.filter((o) => !["recebido", "cancelado"].includes(o.st)),
    cards = [
      ["Itens abaixo do mínimo", its.filter((i) => i.stock < i.min).length, "stock", "low"],
      ["Pedidos em andamento", op.length, "orders"],
      ["Entregas previstas hoje", S.o.filter(today).length, "deliv"],
      ["Pedidos atrasados", S.o.filter(late).length, "deliv"],
      ["Contagens desatualizadas", its.filter(stale).length, "stock", "old"],
    ];
  const from = S.pd ? ds(-S.pd) : "",
    ws = S.w.filter((w) => (!f || w.sec == f) && (w.d || ds(0)) >= from),
    rs = {};
  ws.forEach((w) => (rs[w.reason] = (rs[w.reason] || 0) + w.q));
  const mx = Math.max(1, ...Object.values(rs));
  return (
    `<h2>Visão geral</h2><div class="fm" style="max-width:540px"><label>Período<select onchange="A.pd(this.value)">${[
      [0, "Todo o histórico"],
      [7, "Últimos 7 dias"],
      [30, "Últimos 30 dias"],
    ]
      .map(
        (p) => `<option value="${p[0]}" ${p[0] == (S.pd || 0) ? "selected" : ""}>${p[1]}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Setor<select onchange="A.f(this.value)"><option value="">Todos</option>${S.sectors.map((s) => `<option ${s == f ? "selected" : ""}>${escHtml(s)}</option>`).join("")}</select></label></div>` +
    notes() +
    `<div class="grid">${cards.map((c) => `<button class="card tap" onclick="A.go('${c[2]}','${c[3] || ""}')"><span class="mu">${c[0]}</span><b class="n">${c[1]}</b></button>`).join("")}</div>
 <h3>Consumo estimado por item <span class="mu">(estimativa: inicial + recebimentos − desperdícios − final)</span></h3>` +
    tb(
      ["Item", "Período", "Consumo estimado"],
      its
        .filter((i) => i.cons && i.cons.to >= from)
        .map((i) => [
          i.name,
          br(i.cons.from) + " a " + br(i.cons.to),
          N(i.cons.v) + " " + i.unit + " " + bd("estimado", "wa"),
        ]),
    ) +
    `<h3>Desperdício por motivo</h3>` +
    (Object.keys(rs)
      .map(
        (k) =>
          `<div class="row"><span style="width:110px">${k}</span><div class="f"><div class="bar" style="width:${(rs[k] / mx) * 100}%"></div></div><span>${N(rs[k])}</span></div>`,
      )
      .join("") || '<p class="mu">Sem registros</p>') +
    `<p class="mu">Valor estimado: ${R(ws.reduce((a, w) => a + w.q * cost(w.item), 0))}</p><h3>Preços cotados</h3>` +
    tb(
      ["Item", "Menor", "Maior", "Cotações"],
      its
        .filter((i) => S.qt.some((q) => q.item == i.id))
        .map((i) => {
          const p = S.qt.filter((q) => q.item == i.id).map((q) => q.price);
          return [i.name, R(Math.min(...p)), R(Math.max(...p)), p.length];
        }),
    )
  );
};
const notes = () =>
  S.notes
    .slice(0, 4)
    .map((n) => `<div class="al er">${n}</div>`)
    .join("");
V.count = () => {
  const u = me(),
    secs = u.role == "func" ? [u.sector] : S.sectors,
    sec = secs.includes(S.sec) ? S.sec : null;
  if (!sec)
    return `<h2>Contagens</h2><div class="grid">${secs
      .map((s) => {
        const c = S.cs[s],
          n = c ? Object.keys(c.v).length : 0;
        return `<button class="card tap" onclick="A.sec(${escHtml(JSON.stringify(s))})"><b>${escHtml(s)}</b><span class="mu">${c ? n + " de " + items(s).length + " contados · em andamento" : "Não iniciada"}</span></button>`;
      })
      .join("")}</div>`;
  const its = items(sec),
    c = S.cs[sec] || { v: {} },
    n = Object.keys(c.v).length,
    cats = [...new Set(its.map((i) => i.cat))],
    q = (S.q || "").toLowerCase();
  return (
    `<h2>Contagem · ${escHtml(sec)}</h2><div class="row" style="border:0;padding:0"><button class="g sm" onclick="A.sec(null)">Pausar e voltar</button><span class="mu f">Progresso salvo automaticamente${c.by ? " · " + c.by + " · " + c.at : ""}</span></div>
 <div class="pg"><div style="width:${(n / its.length) * 100}%"></div></div><p class="mu" style="margin:0 0 8px">${n} de ${its.length} itens contados</p>
 <input placeholder="Buscar produto" value="${S.q || ""}" oninput="S.q=this.value;document.querySelectorAll('[data-n]').forEach(e=>e.style.display=e.dataset.n.includes(this.value.toLowerCase())?'':'none')">` +
    cats
      .map(
        (k) =>
          `<h3>${k}</h3>` +
          its
            .filter((i) => i.cat == k)
            .map(
              (
                i,
              ) => `<div class="row" data-n="${i.name.toLowerCase()}" ${q && !i.name.toLowerCase().includes(q) ? 'style="display:none"' : ""}><div class="f"><b>${i.name}</b><br><span class="mu">${i.unit}</span> ${c.v[i.id] === undefined ? bd("não contado", "wa") : ""}</div>
 <div class="cnt"><button class="g" onclick="A.cnt('${i.id}',-1)">−</button><input inputmode="decimal" placeholder="—" value="${c.v[i.id] ?? ""}" onchange="A.set('${i.id}',this.value)"><button onclick="A.cnt('${i.id}',1)">+</button></div></div>`,
            )
            .join(""),
      )
      .join("") +
    `<div class="row" style="border:0"><button onclick="A.fin()">Concluir contagem</button></div>`
  );
};
V.stock = () => {
  const f = S.lf;
  let its = items();
  if (f == "low") its = its.filter((i) => i.stock < i.min);
  if (f == "old") its = its.filter(stale);
  return (
    `<h2>Estoque estimado</h2>${f ? `<p><button class="g sm" onclick="A.go('stock','')">Limpar filtro</button></p>` : ""}` +
    tb(
      ["Item", "Setor", "Saldo estimado", "Mín./Ideal", "Situação", "Última contagem", ""],
      its.map((i) => {
        const l = lvl(i);
        return [
          i.name,
          escHtml(i.sector),
          N(i.stock) + " " + i.unit,
          N(i.min) + " / " + N(i.ideal),
          bd(l[0], l[1]),
          br(i.lc.at) + (stale(i) ? " " + bd("desatualizado", "wa") : ""),
          PERM.count.includes(me().role)
            ? `<button class="g sm" onclick="A.fix('${i.id}')">Corrigir contagem</button>`
            : "",
        ];
      }),
    )
  );
};
const wasteSectors = () => me().role == "func"
  ? S.sectors.filter((sector) => sector == me().sector)
  : S.sectors;
const wasteSuggestions = (sec, field) => {
  const values = new Map(),
    history = S.w.filter((w) => w.sec == sec),
    names = field == "name"
      ? [...history.filter((w) => !w.item || items(sec).some((i) => i.id == w.item))
        .map((w) => w.name || item(w.item)?.name), ...items(sec).map((i) => i.name)]
      : history.map((w) => w.obs);
  names.forEach((value) => {
    const text = value?.trim(),
      key = text?.toLocaleLowerCase();
    if (key && !values.has(key)) values.set(key, text);
  });
  return [...values.values()]
    .map((value) => `<option value="${escHtml(value)}"></option>`).join("");
};
V.waste = () => {
  const secs = wasteSectors(),
    filter = secs.includes(S.wasteFilter) ? S.wasteFilter : "",
    sec = filter || secs[0] || "",
    ws = S.w.filter((w) => secs.includes(w.sec) && (!filter || w.sec == filter));
  return (
    `<h2>Desperdícios</h2>
    <div class="fm"><label>Filtrar por setor<select id="waste-filter" onchange="A.filterWaste(this.value)"><option value="">Todos os setores</option>${secs.map((s) => `<option value="${escHtml(s)}" ${s == filter ? "selected" : ""}>${escHtml(s)}</option>`).join("")}</select></label></div>
    <div class="fm"><label>Setor do registro<select id="wsec" onchange="A.wasteSector()">${secs.map((s) => `<option value="${escHtml(s)}" ${s == sec ? "selected" : ""}>${escHtml(s)}</option>`).join("")}</select></label>
    <label>Item<input id="wi" list="waste-item-options" placeholder="Digite ou selecione" autocomplete="off"></label>
    <label>Quantidade<input id="wq" type="number" step="any" min="0"></label><label>Motivo<select id="wr"><option>vencimento</option><option>avaria</option><option>erro de preparo</option><option>sobra</option><option>outro</option></select></label>
    <label>Observação<input id="wo" list="waste-note-options" placeholder="Digite ou selecione" autocomplete="off"></label><button onclick="A.waste()" ${secs.length ? "" : "disabled"}>Registrar</button></div>
    <datalist id="waste-item-options">${wasteSuggestions(sec, "name")}</datalist>
    <datalist id="waste-note-options">${wasteSuggestions(sec, "obs")}</datalist>
    <p class="mu">${secs.length ? "Itens e observações registrados ficam disponíveis para reutilizar no mesmo setor. Itens cadastrados usam sua unidade e descontam o estoque; nomes novos ficam apenas neste histórico, sem custo estimado." : "Cadastre um setor antes de registrar desperdícios."}</p>
    <h3>Histórico de desperdícios</h3>` +
    tb(
      ["Quando", "Item", "Qtd.", "Motivo", "Setor", "Responsável"],
      ws.map((w) => [
        escHtml(w.at),
        escHtml(w.name || item(w.item)?.name || "Item removido"),
        N(w.q) + (w.unit ? " " + escHtml(w.unit) : ""),
        escHtml(w.reason) + (w.obs ? " · " + escHtml(w.obs) : ""),
        escHtml(w.sec),
        escHtml(w.by),
      ]),
    )
  );
};
V.orders = () => {
  const sg = items().filter(
    (i) =>
      i.stock <= i.min &&
      !S.o.some(
        (o) => !["recebido", "cancelado"].includes(o.st) && o.items.some((l) => l.id == i.id),
      ),
  );
  return (
    `<h2>Pedidos e cotações</h2><h3>Sugestões de reposição</h3>` +
    (sg
      .map((i) => {
        const qs = S.qt.filter((q) => q.item == i.id),
          ch = qs.find((q) => q.sel),
          sp = ch ? ch.sup : i.sup,
          need = Math.max(0, Math.ceil((i.ideal - i.stock) / i.conv));
        return (
          `<div class="card" style="margin-bottom:10px"><b>${i.name}</b><span class="mu">Saldo ${N(i.stock)} ${i.unit} · ideal ${N(i.ideal)} · sugerido: ${need} × ${i.bu}</span>` +
          qs
            .map(
              (q) =>
                `<div class="row"><span class="f">${sup(q.sup).name}: ${R(q.price)}/${i.bu} · mín. ${q.min} · ${q.days} d · total ${R(q.price * need)} ${q.pend ? bd("pendente", "wa") : ""} ${q.sel ? bd("selecionada", "ok") : ""}</span>${q.sel ? "" : `<button class="g sm" onclick="A.pick(${q.id})">Escolher</button>`}</div>`,
            )
            .join("") +
          `<div class="fm"><label>Fornecedor<select id="sp-${i.id}">${activeSuppliers().map((s) => `<option value="${s.id}" ${s.id == sp ? "selected" : ""}>${escHtml(s.name)}</option>`).join("")}</select></label><label>Qtd. (${i.bu})<input id="qy-${i.id}" type="number" min="0" step="any" value="${need}"></label><button onclick="A.mk('${i.id}')">Criar pedido</button></div></div>`
        );
      })
      .join("") || '<p class="mu">Nenhum item precisa de reposição.</p>') +
    `<h3>Registrar cotação</h3><div class="fm"><label>Item<select id="qi">${items()
      .map((i) => `<option value="${i.id}">${i.name}</option>`)
      .join(
        "",
      )}</select></label><label>Fornecedor<select id="qs">${activeSuppliers().map((s) => `<option value="${s.id}">${escHtml(s.name)}</option>`).join("")}</select></label><label>Preço (R$/un. compra)<input id="qp" type="number" step="any"></label><label>Qtd. mínima<input id="qm" type="number" value="1"></label><label>Prazo (dias)<input id="qd" type="number" value="2"></label><label>Observações<input id="qo"></label><button onclick="A.quote()">Salvar cotação</button></div>
 <h3>Pedidos</h3>` +
    S.o
      .map((o) => {
        const ac = {
          rascunho: ["aguardando aprovação", "Enviar p/ aprovação"],
          "aguardando aprovação": ["aprovado", "Aprovar"],
          "em cotação": ["aprovado", "Aprovar"],
          aprovado: ["enviado", "Marcar como enviado"],
        }[o.st];
        return `<div class="card" style="margin-bottom:10px"><div class="row" style="border:0;padding:0"><b class="f">${o.id} · ${sup(o.sup).name}</b>${bd(o.st, stc[o.st])}${late(o) ? bd("atrasado", "er") : ""}</div><span class="mu">${o.items.map((l) => l.q + " × " + item(l.id).bu + " " + nm(l.id)).join(", ")} · total ${R(o.items.reduce((a, l) => a + l.q * l.p, 0))} · pedido em ${br(o.date)}</span>
 <div class="row" style="border:0"><label>Previsão<input type="date" value="${o.eta}" onchange="A.eta('${o.id}',this.value)" ${["recebido", "cancelado"].includes(o.st) ? "disabled" : ""}></label>${ac ? `<button class="sm" onclick="A.ost('${o.id}','${ac[0]}')">${ac[1]}</button>` : ""}${["recebido", "cancelado"].includes(o.st) ? "" : `<button class="g sm" onclick="A.ost('${o.id}','cancelado')">Cancelar</button>`}</div>${o.h.length ? `<span class="mu">${o.h.slice(-2).join(" | ")}</span>` : ""}</div>`;
      })
      .join("")
  );
};
V.deliv = () => {
  const op = S.o.filter((o) => OPEN.includes(o.st)).sort((a, b) => (a.eta < b.eta ? -1 : 1));
  return (
    `<h2>Entregas</h2>` +
    op
      .filter(today)
      .map(
        (o) =>
          `<div class="al">${sup(o.sup).name} tem uma entrega prevista para hoje — fique atento.</div>`,
      )
      .join("") +
    op
      .filter(late)
      .map(
        (o) =>
          `<div class="al er">${o.id} · ${sup(o.sup).name} está atrasado (previsto para ${br(o.eta)}).</div>`,
      )
      .join("") +
    notes() +
    (op
      .map(
        (o) =>
          `<div class="card" style="margin:10px 0"><div class="row" style="border:0;padding:0"><b class="f">${o.id} · ${sup(o.sup).name}</b><span>${br(o.eta)}</span></div><span class="mu">${o.items.map((l) => l.q + " × " + item(l.id).bu + " " + nm(l.id)).join(", ")}</span><div><button class="sm" onclick="A.rv('${o.id}')">Conferir recebimento</button></div></div>`,
      )
      .join("") || '<p class="mu">Nenhuma entrega aguardada.</p>') +
    `<h3>Concluídas</h3>` +
    tb(
      ["Pedido", "Fornecedor", "Situação", "Recebido"],
      S.o
        .filter((o) => ["recebido", "recebido parcialmente", "com divergência"].includes(o.st))
        .map((o) => [
          o.id,
          sup(o.sup).name,
          bd(o.st, stc[o.st]),
          o.items.map((l) => (l.r ?? 0) + "/" + l.q + " " + nm(l.id)).join(", "),
        ]),
    )
  );
};
V.sup = () =>
  `<h2>Fornecedores</h2>${me().role == "admin" ? '<p><button class="add" onclick="A.openSupplierBatch()">Adicionar fornecedores</button></p>' : ""}<div class="supplier-list">${S.s
    .filter((supplier) => !supplier.deleted)
    .map((supplier) => {
      const servedItems = S.i.filter(
        (i) => !i.deleted && (i.sup == supplier.id || S.qt.some((q) => q.item == i.id && q.sup == supplier.id)),
      );
      return `<article class="supplier-card ${supplier.on === 0 ? "is-inactive" : ""}">
        <div class="supplier-info"><div class="supplier-name">${escHtml(supplier.name)} ${bd(supplier.on === 0 ? "Inativo" : "Ativo", supplier.on === 0 ? "wa" : "ok")}</div>
          <div class="supplier-details"><span>${escHtml(supplier.contact || "Sem contato cadastrado")}</span><span>Prazo habitual: ${supplier.lead} dia(s)</span><span>${servedItems.length} item(ns) atendido(s)</span></div>
          ${servedItems.length ? `<div class="supplier-items">${servedItems.map((i) => escHtml(i.name)).join(" · ")}</div>` : ""}
        </div>
      </article>`;
    })
    .join("") || '<p class="mu supplier-empty">Nenhum fornecedor cadastrado ainda.</p>'}</div>`;
const CAD_SECTIONS = [
  ["sectors", "Setores"],
  ["items", "Itens"],
  ["suppliers", "Fornecedores"],
];
const itemImportPreview = () => {
  if (!itemImportDraft) return "";
  const { valid, duplicates, invalid } = itemImportDraft;
  return `<div class="import-preview" aria-live="polite">
    <b>Prévia da importação</b>
    <p class="mu">${valid.length} item(ns) pronto(s) · ${duplicates.length} duplicado(s) ignorado(s) · ${invalid.length} linha(s) com problema</p>
    ${valid.length ? `<div class="tw">${tb(["Linha", "Item", "Setor", "Categoria", "Unidade", "Saldo"], valid.slice(0, 20).map((entry) => [entry.row, escHtml(entry.name), escHtml(entry.sector), escHtml(entry.category), escHtml(entry.unit), N(entry.stock)]))}</div>${valid.length > 20 ? `<p class="mu">Exibindo 20 de ${valid.length} itens.</p>` : ""}` : ""}
    ${duplicates.length ? `<details><summary>${duplicates.length} duplicado(s) ignorado(s)</summary><ul>${duplicates.slice(0, 20).map((entry) => `<li>Linha ${entry.row}: ${escHtml(entry.name)} (${escHtml(entry.sector)})</li>`).join("")}</ul></details>` : ""}
    ${invalid.length ? `<details open><summary>${invalid.length} linha(s) precisam de correção</summary><ul>${invalid.slice(0, 20).map((entry) => `<li>Linha ${entry.row}: ${escHtml(entry.reason)}</li>`).join("")}</ul></details>` : ""}
    <div class="row"><button class="add" onclick="A.applyItemImport()" ${valid.length ? "" : "disabled"}>Importar ${valid.length} item(ns)</button><button class="g" onclick="A.cancelItemImport()">Cancelar</button></div>
  </div>`;
};
const importTemplate = () => {
  const content = "\uFEFFItem;Setor;Categoria;Unidade;Saldo inicial;Mínimo;Ideal\r\nExemplo de item;Cozinha;Geral;unidade;0;0;0\r\n";
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })),
    link = document.createElement("a");
  link.href = url;
  link.download = "modelo-itens-contagem.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
const itemRegistrationForm = () =>
    `${S.sectors.length && S.s.length ? "" : '<p class="mu">Cadastre pelo menos um setor e um fornecedor antes de adicionar itens manualmente.</p>'}
    <div class="fm">
      <label>Nome<input id="n-name"></label>
      <label>Setor<select id="n-sec">${S.sectors.map((s) => `<option>${escHtml(s)}</option>`).join("")}</select></label>
      <label>Categoria<input id="n-cat"></label>
      <label>Unidade de contagem<input id="n-un" list="count-unit-options" placeholder="garrafa, kg, litro"></label>
      <label>Unidade de compra<input id="n-bu" list="buy-unit-options" placeholder="caixa (12)"></label>
      <label>Unidades por compra<input id="n-cv" type="number" step="any" value="1"></label>
      <label>Mínimo<input id="n-min" type="number" step="any" value="0"></label>
      <label>Ideal<input id="n-ide" type="number" step="any" value="0"></label>
      <label>Fornecedor principal<select id="n-sup">${activeSuppliers().map((s) => `<option value="${s.id}">${escHtml(s.name)}</option>`).join("")}</select></label>
      <label>Saldo inicial<input id="n-st" type="number" step="any" value="0"></label>
      <button class="add" type="submit">Adicionar à lista</button>
    </div>`;
const itemImportForm = () =>
    `<div class="import-panel">
      <p class="mu">Envie um arquivo Excel (.xlsx/.xls) ou CSV. A primeira linha deve ter cabeçalhos, incluindo Item ou Produto. Setor, Categoria, Unidade, Saldo inicial, Mínimo e Ideal são opcionais. Itens repetidos no mesmo setor serão ignorados.</p>
      <div class="fm">
        <label>Setor padrão (se a planilha não tiver setor)
          <select id="import-sector" onchange="A.updateItemImportOptions()"><option value="">Usar setor da planilha</option>${S.sectors.map((sector) => `<option value="${escHtml(sector)}" ${sector == itemImportOptions.sector ? "selected" : ""}>${escHtml(sector)}</option>`).join("")}</select>
        </label>
        <label>Fornecedor principal (opcional)
          <select id="import-supplier" onchange="A.updateItemImportOptions()"><option value="" ${((itemImportOptions.supplier ?? activeSuppliers()[0]?.id) || "") === "" ? "selected" : ""}>Sem fornecedor definido</option>${activeSuppliers().map((supplier) => `<option value="${escHtml(supplier.id)}" ${supplier.id == (itemImportOptions.supplier ?? activeSuppliers()[0]?.id) ? "selected" : ""}>${escHtml(supplier.name)}</option>`).join("")}</select>
        </label>
        <label>Arquivo da planilha<input type="file" accept=".xlsx,.xls,.csv,.tsv" onchange="A.readItemImport(this.files[0])" ${S.sectors.length ? "" : "disabled"}></label>
        <button class="g" onclick="A.downloadItemImportTemplate()">Baixar modelo CSV</button>
      </div>
      ${!S.sectors.length ? '<p class="mu">Cadastre ao menos um setor antes de importar.</p>' : ""}
      ${itemImportPreview()}
    </div>`;
let registrationBatch = [];
let registrationKind = null;
const registrationKey = (name) => name.trim().toLocaleLowerCase();
const renderRegistrationBatch = () => {
  $("#registration-batch-list").innerHTML = tb(
    registrationKind == "sectors" ? ["Setor", "Ações"] : ["Item", "Setor", "Categoria", "Unidade", "Compra", "Mínimo / Ideal", "Fornecedor", "Saldo", "Ações"],
    registrationBatch.map((entry, index) => [
      escHtml(entry.name),
      ...(registrationKind == "items"
        ? [escHtml(entry.sector), escHtml(entry.cat), escHtml(entry.unit),
          `${escHtml(entry.bu)} = ${N(entry.conv)} ${escHtml(entry.unit)}`,
          `${N(entry.min)} / ${N(entry.ideal)}`, escHtml(sup(entry.sup)?.name || ""), N(entry.stock)]
        : []),
      `<button class="x sm" type="button" onclick="A.removeRegistrationEntry(${index})">Remover</button>`,
    ]),
  );
  $("#registration-batch-save").disabled = !registrationBatch.length;
};
const registrationFieldsChanged = () =>
  registrationKind == "sectors"
    ? Boolean($("#sector-name").value.trim())
    : registrationKind == "items" && (
      ["name", "cat", "un", "bu"].some((field) => $("#n-" + field).value.trim()) ||
      $("#n-cv").value !== "1" ||
      ["min", "ide", "st"].some((field) => $("#n-" + field).value !== "0")
    );
const registrationAction = (action) => (...args) => {
  try {
    guard("cad");
    action(...args);
  } catch (error) {
    alert(error.message);
  }
};
const cadViews = {
  sectors: () =>
    `<button class="add" onclick="A.openRegistrationBatch('sectors')">Adicionar setores</button>
    <h3>Setores cadastrados</h3>` +
    tb(
      ["Setor", "Ações"],
      S.sectors.map((sector, index) => [
        `<input id="sector-${index}" value="${escHtml(sector)}" aria-label="Nome do setor ${escHtml(sector)}" onblur="setTimeout(() => A.renameSector(${index}), 0)" onkeydown="if(event.key === 'Enter'){event.preventDefault();this.blur()}">`,
        `<button class="x sm" onclick="A.deleteSector(${index})">Excluir</button>`,
      ]),
    ),
  items: () =>
    `<div class="row"><button class="add" onclick="A.openRegistrationBatch('items')">Adicionar itens</button>
    <button class="g" onclick="A.openItemImport()">Importar planilha de contagem</button></div>
    <h3>Itens cadastrados</h3>` +
    tb(
      ["Item", "Setor", "Unidade", "Compra", "Mínimo", "Ideal", "Situação", "Ações"],
      S.i
        .filter((i) => !i.deleted)
        .map((i) => [
          i.name,
          escHtml(i.sector),
          i.unit,
          i.bu + " = " + i.conv + " " + i.unit,
          `<input type="number" style="width:80px" value="${i.min}" onchange="A.cad('${i.id}','min',this.value)">`,
          `<input type="number" style="width:80px" value="${i.ideal}" onchange="A.cad('${i.id}','ideal',this.value)">`,
          bd(i.on ? "Ativo" : "Inativo", i.on ? "ok" : "wa"),
          `<button class="g sm" onclick="A.editItem('${i.id}')">Editar</button>`,
        ]),
    ),
  suppliers: () =>
    `<button class="add" onclick="A.openSupplierBatch()">Adicionar fornecedores</button>
    <div class="supplier-heading"><div><h3>Fornecedores cadastrados</h3><span class="mu">${activeSuppliers().length} ativo(s) · ${S.s.filter((s) => !s.deleted && s.on === 0).length} inativo(s)</span></div></div>
    <div class="supplier-list">${S.s
      .filter((supplier) => !supplier.deleted)
      .map(
        (supplier) =>
          `<article class="supplier-card ${supplier.on === 0 ? "is-inactive" : ""}">
            <div class="supplier-info"><div class="supplier-name">${escHtml(supplier.name)} ${bd(supplier.on === 0 ? "Inativo" : "Ativo", supplier.on === 0 ? "wa" : "ok")}</div>
              <div class="supplier-details"><span>${escHtml(supplier.contact || "Sem contato cadastrado")}</span><span>Prazo habitual: ${supplier.lead} dia(s)</span><span>${S.i.filter((i) => i.sup == supplier.id && !i.deleted).length} item(ns)</span></div>
            </div>
            <div class="supplier-actions"><button class="g sm" onclick="A.editSupplier('${escHtml(supplier.id)}')">Editar</button></div>
          </article>`,
      )
      .join("") || '<p class="mu supplier-empty">Nenhum fornecedor cadastrado ainda.</p>'}</div>`,
};
V.cad = () => {
  const section = CAD_SECTIONS.some(([id]) => id == S.cadSection) ? S.cadSection : "sectors";
  return `<h2>Cadastros</h2>
    <p class="mu">Escolha o cadastro que deseja gerenciar.</p>
    <div class="cad-sections" role="group" aria-label="Tipos de cadastro">
      ${CAD_SECTIONS.map(
        ([id, label]) =>
          `<button class="g" aria-pressed="${id == section}" aria-controls="cad-content" onclick="A.cadSection('${id}')">${label}</button>`,
      ).join("")}
    </div>
    <section id="cad-content" aria-label="${CAD_SECTIONS.find(([id]) => id == section)[1]}">
      ${cadViews[section]()}
    </section>`;
};
V.log = () =>
  `<h2>Histórico</h2>` +
  tb(
    ["Quando", "Quem", "O quê"],
    S.log.slice(0, 60).map((l) => [l.t, l.u, l.m]),
  );
const A = {
  toggleNavigation: () => {
    try {
      const next = { ...S, navCollapsed: !S.navCollapsed };
      localStorage.setItem(K, JSON.stringify(next));
      S = next;
      render();
      $(".nav-toggle").focus();
    } catch (error) {
      alert(error.message);
    }
  },
  openRegistrationBatch: registrationAction((kind) => {
    if (!["sectors", "items"].includes(kind)) throw Error("Cadastro não encontrado.");
    registrationKind = kind;
    registrationBatch = [];
    $("#registration-title").textContent = kind == "sectors" ? "Cadastrar setores" : "Cadastrar itens";
    $("#registration-form").innerHTML = kind == "sectors"
      ? `<div class="fm"><label>Nome do setor<input id="sector-name" required></label><button class="add" type="submit">Adicionar à lista</button></div>`
      : itemRegistrationForm();
    $("#count-unit-options").innerHTML = unitOptions("unit");
    $("#buy-unit-options").innerHTML = unitOptions("bu");
    renderRegistrationBatch();
    $("#registration-dialog").showModal();
    $(kind == "sectors" ? "#sector-name" : "#n-name").focus();
  }),
  addRegistrationEntry: () => {
    if (registrationKind == "sectors") A.newSector();
    else A.newItem();
  },
  removeRegistrationEntry: registrationAction((index) => {
    if (!Number.isInteger(index) || !registrationBatch[index])
      throw Error("Cadastro não encontrado na lista.");
    registrationBatch.splice(index, 1);
    renderRegistrationBatch();
  }),
  closeRegistrationBatch: () => {
    if ((registrationBatch.length || registrationFieldsChanged()) &&
      !confirm("Descartar os cadastros e dados ainda não salvos?")) return;
    registrationBatch = [];
    registrationKind = null;
    $("#registration-dialog").close();
    $("#registration-form").innerHTML = "";
  },
  saveRegistrationBatch: registrationAction(() => {
    if (!registrationKind || !registrationBatch.length)
      throw Error("Adicione pelo menos um cadastro à lista.");
    if (registrationFieldsChanged())
      throw Error("Há dados nos campos. Adicione o cadastro à lista ou limpe os campos antes de salvar.");
    const next = JSON.parse(JSON.stringify(S));
    registrationBatch.forEach((entry, index) => {
      if (registrationKind == "sectors") {
        if (next.sectors.some((sector) => registrationKey(sector) == registrationKey(entry.name)))
          throw Error(`Já existe um setor com o nome "${entry.name}".`);
        next.sectors.push(entry.name);
      } else {
        if (!next.sectors.includes(entry.sector))
          throw Error(`O setor "${entry.sector}" não está mais cadastrado.`);
        if (!activeSuppliers().some((supplier) => supplier.id == entry.sup))
          throw Error(`Selecione um fornecedor ativo para "${entry.name}".`);
        if (next.i.some((item) => !item.deleted && item.sector == entry.sector &&
          registrationKey(item.name) == registrationKey(entry.name)))
          throw Error(`Já existe o item "${entry.name}" neste setor.`);
        let id = `i${Date.now()}-${index}`;
        while (next.i.some((item) => item.id == id)) id += "-1";
        next.i.push({ ...entry, id });
      }
      next.log.unshift({
        t: now(), u: me().name,
        m: `${registrationKind == "sectors" ? "Setor" : "Item"} cadastrado: ${entry.name}`,
      });
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    registrationBatch = [];
    registrationKind = null;
    $("#registration-dialog").close();
    $("#registration-form").innerHTML = "";
    render();
  }),
  openItemImport: registrationAction(() => {
    itemImportDraft = null;
    itemImportRows = null;
    itemImportOptions = { sector: "", supplier: null };
    $("#item-import-content").innerHTML = itemImportForm();
    $("#item-import-dialog").showModal();
  }),
  th: () => {
    const d =
      document.documentElement.dataset.theme == "dark" ||
      (!S.th && matchMedia("(prefers-color-scheme:dark)").matches);
    S.th = d ? "light" : "dark";
    save();
    render();
  },
  user: (id) => {
    S.uid = id;
    S.sec = null;
    S.v = null;
    save();
    render();
  },
  nav: (v) => {
    S.v = v;
    S.lf = "";
    render();
  },
  go: (v, f) => {
    S.v = v;
    S.lf = f;
    render();
  },
  f: (v) => {
    S.f = v;
    render();
  },
  pd: (v) => {
    S.pd = +v;
    save();
    render();
  },
  cadSection: T((section) => {
    guard("cad");
    if (!CAD_SECTIONS.some(([id]) => id == section)) throw Error("Cadastro não encontrado.");
    S.cadSection = section;
  }),
  readItemImport: async (file) => {
    try {
      guard("cad");
      if (!file) return;
      const extension = file.name.split(".").pop().toLowerCase();
      let rows;
      if (["xlsx", "xls"].includes(extension)) {
        if (!window.XLSX) throw Error("Não foi possível carregar o leitor de Excel. Tente novamente ou envie um CSV.");
        const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" }),
          sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw Error("A planilha não contém uma aba para importar.");
        rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      } else if (["csv", "tsv"].includes(extension)) {
        rows = parseDelimitedText(await file.text());
      } else {
        throw Error("Formato não suportado. Envie um arquivo Excel (.xlsx/.xls) ou CSV.");
      }
      itemImportRows = rows;
      itemImportOptions.sector = $("#import-sector").value;
      itemImportOptions.supplier = $("#import-supplier").value;
      itemImportDraft = prepareItemImport(
        itemImportRows,
        itemImportOptions.sector,
        itemImportOptions.supplier,
      );
      $("#item-import-content").innerHTML = itemImportForm();
    } catch (error) {
      alert(error.message);
    }
  },
  updateItemImportOptions: () => {
    try {
      guard("cad");
      if (!itemImportRows) return;
      itemImportOptions.sector = $("#import-sector").value;
      itemImportOptions.supplier = $("#import-supplier").value;
      itemImportDraft = prepareItemImport(
        itemImportRows,
        itemImportOptions.sector,
        itemImportOptions.supplier,
      );
      $("#item-import-content").innerHTML = itemImportForm();
    } catch (error) {
      alert(error.message);
    }
  },
  downloadItemImportTemplate: importTemplate,
  applyItemImport: registrationAction(() => {
    guard("cad");
    if (!itemImportDraft || !itemImportDraft.valid.length) throw Error("Não há itens válidos para importar.");
    const existing = new Set(
        S.i.map((entry) => `${normalizeImportHeader(entry.sector)}:${normalizeImportHeader(entry.name)}`),
      ),
      additions = itemImportDraft.valid.filter((entry) => {
        const key = `${normalizeImportHeader(entry.sector)}:${normalizeImportHeader(entry.name)}`;
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
    if (!additions.length) throw Error("Os itens da prévia já foram cadastrados.");
    const next = JSON.parse(JSON.stringify(S));
    additions.forEach((entry) => {
      if (!next.sectors.includes(entry.sector))
        throw Error(`O setor "${entry.sector}" não está mais cadastrado.`);
      if (entry.supplier && !activeSuppliers().some((supplier) => supplier.id == entry.supplier))
        throw Error(`O fornecedor de "${entry.name}" não está mais ativo.`);
      let id = "i" + Date.now(),
        suffix = 1;
      while (next.i.some((item) => item.id == id)) id = "i" + Date.now() + "-" + suffix++;
      next.i.push(
        I(
          id,
          entry.name,
          entry.sector,
          entry.category,
          entry.unit,
          entry.unit,
          1,
          entry.minimum,
          entry.ideal,
          entry.supplier,
          entry.stock,
          0,
        ),
      );
    });
    next.log.unshift({
      t: now(), u: me().name, m: `${additions.length} item(ns) importado(s) da planilha`,
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    itemImportDraft = null;
    itemImportRows = null;
    itemImportOptions = { sector: "", supplier: null };
    $("#item-import-dialog").close();
    $("#item-import-content").innerHTML = "";
    render();
  }),
  cancelItemImport: () => {
    if (itemImportDraft && !confirm("Descartar a prévia da importação?")) return;
    itemImportDraft = null;
    itemImportRows = null;
    itemImportOptions = { sector: "", supplier: null };
    $("#item-import-content").innerHTML = "";
    $("#item-import-dialog").close();
  },
  newItem: registrationAction(() => {
    guard("cad");
    const g = (k) => $("#n-" + k).value.trim(),
      nm_ = g("name"),
      cv = Number(g("cv")),
      mn = g("min") ? Number(g("min")) : NaN,
      id_ = g("ide") ? Number(g("ide")) : NaN,
      stock = g("st") ? Number(g("st")) : NaN;
    if (!nm_ || !g("un") || !g("bu"))
      throw Error("Preencha nome, unidade de contagem e unidade de compra.");
    if (!(cv > 0) || !Number.isFinite(cv)) throw Error("A conversão deve ser maior que zero.");
    if (![mn, id_, stock].every((value) => Number.isFinite(value) && value >= 0))
      throw Error("Mínimo, ideal e saldo inicial devem ser números iguais ou maiores que zero.");
    if (id_ < mn) throw Error("O estoque ideal não pode ser menor que o mínimo.");
    if (!S.sectors.includes(g("sec"))) throw Error("Cadastre e selecione um setor válido.");
    if (!activeSuppliers().some((supplier) => supplier.id == g("sup")))
      throw Error("Cadastre e selecione um fornecedor ativo.");
    if ([...S.i.filter((item) => !item.deleted), ...registrationBatch].some(
      (item) => item.sector == g("sec") && registrationKey(item.name) == registrationKey(nm_),
    )) throw Error("Já existe um item com esse nome no setor ou na lista.");
    const it = I(
      "",
      nm_,
      g("sec"),
      g("cat") || "Geral",
      g("un"),
      g("bu"),
      cv,
      mn,
      id_,
      g("sup"),
      stock,
      0,
    );
    registrationBatch.push(it);
    $("#registration-form").reset();
    renderRegistrationBatch();
    $("#n-name").focus();
  }),
  openSupplierBatch: () => {
    try {
      guard("cad");
      supplierBatch = [];
      $("#supplier-batch-form").reset();
      renderSupplierBatch();
      $("#new-suppliers-dialog").showModal();
      $("#s-name").focus();
    } catch (error) {
      alert(error.message);
    }
  },
  newSup: () => {
    try {
      guard("cad");
      const name = $("#s-name").value.trim(),
        contact = $("#s-ct").value.trim(),
        leadValue = $("#s-ld").value.trim(),
        lead = Number(leadValue);
      if (!name) throw Error("Informe o nome do fornecedor.");
      if (!leadValue || !Number.isSafeInteger(lead) || lead < 0)
        throw Error("O prazo habitual deve ser um número inteiro igual ou maior que zero.");
      const key = supplierNameKey(name);
      if (S.s.some((supplier) => !supplier.deleted && supplierNameKey(supplier.name) == key))
        throw Error("Já existe um fornecedor com esse nome.");
      if (supplierBatch.some((supplier) => supplierNameKey(supplier.name) == key))
        throw Error("Este fornecedor já está na lista.");
      supplierBatch.push({ name, contact: validateSupplierContact(name, contact), lead });
      $("#supplier-batch-form").reset();
      renderSupplierBatch();
      $("#s-name").focus();
    } catch (error) {
      alert(error.message);
    }
  },
  removeSupplierFromBatch: (index) => {
    try {
      guard("cad");
      if (!Number.isInteger(index) || !supplierBatch[index])
        throw Error("Fornecedor não encontrado na lista.");
      supplierBatch.splice(index, 1);
      renderSupplierBatch();
    } catch (error) {
      alert(error.message);
    }
  },
  closeSupplierBatch: () => {
    if (
      (supplierBatch.length || $("#s-name").value.trim() || $("#s-ct").value.trim() ||
        $("#s-ld").value !== "2") &&
      !confirm("Descartar os fornecedores e dados ainda não salvos?")
    ) return;
    supplierBatch = [];
    $("#supplier-batch-form").reset();
    renderSupplierBatch();
    $("#new-suppliers-dialog").close();
  },
  saveSupplierBatch: () => {
    try {
      guard("cad");
      if (!supplierBatch.length) throw Error("Adicione pelo menos um fornecedor à lista.");
      if ($("#s-name").value.trim() || $("#s-ct").value.trim() || $("#s-ld").value !== "2")
        throw Error("Há dados nos campos. Adicione o fornecedor à lista ou limpe os campos antes de salvar.");
      const names = new Set(
        S.s.filter((supplier) => !supplier.deleted).map((supplier) => supplierNameKey(supplier.name)),
      );
      supplierBatch.forEach((supplier) => {
        validateSupplierContact(supplier.name, supplier.contact);
        const key = supplierNameKey(supplier.name);
        if (names.has(key)) throw Error(`Já existe um fornecedor com o nome "${supplier.name}".`);
        names.add(key);
      });
      const next = JSON.parse(JSON.stringify(S)),
        timestamp = Date.now();
      supplierBatch.forEach((supplier, index) => {
        let id = `s${timestamp}-${index}`;
        while (next.s.some((existing) => existing.id == id)) id += "-1";
        next.s.push({
          id,
          ...supplier,
          contact: validateSupplierContact(supplier.name, supplier.contact),
          on: 1,
        });
        next.log.unshift({ t: now(), u: me().name, m: "Fornecedor cadastrado: " + supplier.name });
      });
      localStorage.setItem(K, JSON.stringify(next));
      S = next;
      supplierBatch = [];
      renderSupplierBatch();
      $("#new-suppliers-dialog").close();
      render();
    } catch (error) {
      alert(error.message);
    }
  },
  editSupplier: T((id) => {
    guard("cad");
    const supplier = sup(id);
    if (!supplier || supplier.deleted) throw Error("Fornecedor não encontrado.");
    $("#edit-supplier-dialog").dataset.id = id;
    $("#edit-supplier-name").value = supplier.name;
    $("#edit-supplier-contact").value = supplier.contact || "";
    $("#edit-supplier-lead").value = supplier.lead;
    $("#edit-supplier-toggle").textContent =
      supplier.on === 0 ? "Ativar fornecedor" : "Inativar fornecedor";
    $("#delete-supplier-confirm").hidden = true;
    $("#edit-supplier-dialog").showModal();
  }),
  updateSupplier: T((id) => {
    guard("cad");
    const current = sup(id);
    if (!current || current.deleted) throw Error("Fornecedor não encontrado.");
    const name = $("#edit-supplier-name").value.trim(),
      contact = $("#edit-supplier-contact").value.trim(),
      leadValue = String($("#edit-supplier-lead").value).trim(),
      lead = Number(leadValue);
    if (!name) throw Error("Informe o nome do fornecedor.");
    if (!leadValue || !Number.isInteger(lead) || lead < 0)
      throw Error("O prazo habitual deve ser um número inteiro igual ou maior que zero.");
    if (
      S.s.some(
        (supplier) =>
          supplier.id != id &&
          !supplier.deleted &&
          supplier.name.trim().toLocaleLowerCase() == name.toLocaleLowerCase(),
      )
    )
      throw Error("Já existe outro fornecedor com esse nome.");

    const formattedContact = validateSupplierContact(name, contact);
    const next = JSON.parse(JSON.stringify(S)),
      updated = next.s.find((supplier) => supplier.id == id);
    Object.assign(updated, { name, contact: formattedContact, lead });
    next.log.unshift({
      t: now(),
      u: me().name,
      m: `Fornecedor atualizado: ${current.name}${current.name == name ? "" : " → " + name}.`,
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    $("#edit-supplier-dialog").close();
  }),
  toggleSupplier: T((id) => {
    guard("cad");
    const current = sup(id);
    if (!current || current.deleted) throw Error("Fornecedor não encontrado.");
    const next = JSON.parse(JSON.stringify(S)),
      updated = next.s.find((supplier) => supplier.id == id);
    updated.on = updated.on === 0 ? 1 : 0;
    next.log.unshift({
      t: now(),
      u: me().name,
      m: `Fornecedor ${updated.on ? "ativado" : "inativado"}: ${updated.name}.`,
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    $("#edit-supplier-dialog").close();
  }),
  deleteSupplier: T((id) => {
    guard("cad");
    const current = sup(id);
    if (!current || current.deleted) throw Error("Fornecedor não encontrado.");
    const next = JSON.parse(JSON.stringify(S)),
      deleted = next.s.find((supplier) => supplier.id == id);
    deleted.deleted = true;
    deleted.on = 0;
    next.log.unshift({
      t: now(),
      u: me().name,
      m: `Fornecedor removido do cadastro: ${current.name}. Pedidos e registros anteriores preservados.`,
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    $("#edit-supplier-dialog").close();
  }),
  newSector: registrationAction(() => {
    guard("cad");
    const name = $("#sector-name").value.trim();
    if (!name) throw Error("Informe o nome do setor.");
    if (S.sectors.some((sector) => sector.toLocaleLowerCase() == name.toLocaleLowerCase()))
      throw Error("Já existe um setor com esse nome.");
    if (registrationBatch.some((entry) => registrationKey(entry.name) == registrationKey(name)))
      throw Error("Este setor já está na lista.");
    registrationBatch.push({ name });
    $("#sector-name").value = "";
    renderRegistrationBatch();
    $("#sector-name").focus();
  }),
  renameSector: T((index) => {
    guard("cad");
    const oldName = S.sectors[index],
      name = $("#sector-" + index).value.trim();
    if (!oldName) throw Error("Setor não encontrado.");
    if (!name) throw Error("Informe o nome do setor.");
    if (
      S.sectors.some(
        (sector, currentIndex) =>
          currentIndex != index && sector.toLocaleLowerCase() == name.toLocaleLowerCase(),
      )
    )
      throw Error("Já existe um setor com esse nome.");
    if (name == oldName) return;

    S.sectors[index] = name;
    S.i.forEach((item) => {
      if (item.sector == oldName) item.sector = name;
    });
    S.u.forEach((user) => {
      if (user.sector == oldName) user.sector = name;
    });
    S.w.forEach((waste) => {
      if (waste.sec == oldName) waste.sec = name;
    });
    if (S.cs[oldName]) {
      S.cs[name] = S.cs[oldName];
      delete S.cs[oldName];
    }
    if (S.sec == oldName) S.sec = name;
    if (S.f == oldName) S.f = name;
    if (S.wasteFilter == oldName) S.wasteFilter = name;
    log(`Setor renomeado: ${oldName} → ${name}`);
  }),
  deleteSector: T((index, typed, acknowledged) => {
    guard("cad");
    const name = S.sectors[index];
    if (!name) throw Error("Setor não encontrado.");
    const ids = new Set(S.i.filter((i) => i.sector == name).map((i) => i.id)),
      quotes = S.qt.filter((q) => ids.has(q.item)).length,
      wastes = S.w.filter((w) => w.sec == name || ids.has(w.item)).length,
      orders = S.o.filter((o) => o.items.some((line) => ids.has(line.id))),
      users = S.u.filter((u) => u.sector == name).length;
    const impact =
      `Excluir permanentemente o setor "${name}"?\n\n` +
      `${ids.size} itens, ${quotes} cotações e ${wastes} desperdícios serão apagados.\n` +
      `Os itens deste setor serão removidos de ${orders.length} pedidos; pedidos vazios serão excluídos.\n` +
      `As contagens e os dados de consumo dos itens serão apagados.\n` +
      `${users} usuários serão mantidos, mas ficarão sem setor.\n` +
      `O histórico de auditoria será preservado.\n\nEsta ação não pode ser desfeita.`;
    if (typed === undefined) {
      $("#delete-sector-impact").textContent = impact;
      $("#delete-sector-name").value = "";
      $("#delete-sector-ack").checked = false;
      $("#delete-sector-dialog").dataset.index = index;
      $("#delete-sector-dialog").showModal();
      return;
    }
    if (typed === null) return;
    if (typed !== name) throw Error("O nome digitado não corresponde ao setor. Nada foi excluído.");
    if (!acknowledged) throw Error("Confirme que entende que a exclusão é definitiva.");

    const next = JSON.parse(JSON.stringify(S)),
      removedOrders = new Set();
    next.orderSequence = Math.max(
      next.orderSequence || 0,
      ...next.o.map((o) => Number(o.id.slice(2))),
    );
    next.sectors.splice(index, 1);
    next.i = next.i.filter((i) => !ids.has(i.id));
    next.qt = next.qt.filter((q) => !ids.has(q.item));
    next.w = next.w.filter((w) => w.sec != name && !ids.has(w.item));
    next.o = next.o.filter((o) => {
      o.items = o.items.filter((line) => !ids.has(line.id));
      if (!o.items.length) removedOrders.add(o.id);
      return o.items.length > 0;
    });
    next.notes = next.notes.filter(
      (note) => ![...removedOrders].some((id) => note.startsWith(id + " (")),
    );
    delete next.cs[name];
    Object.values(next.cs).forEach((count) => {
      ids.forEach((id) => delete count.v[id]);
    });
    next.u.forEach((user) => {
      if (user.sector == name) user.sector = null;
    });
    if (next.sec == name) {
      next.sec = null;
      next.cat = null;
      next.q = "";
      next.pend = 0;
    }
    if (next.f == name) next.f = "";
    if (next.wasteFilter == name) next.wasteFilter = "";
    next.log.unshift({
      t: now(),
      u: me().name,
      m: impact.split("\n\n")[0] + " Exclusão confirmada.",
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    $("#delete-sector-dialog").close();
    if (LU && ids.has(LU.id)) {
      LU = null;
      if ($("#toast")) $("#toast").style.display = "none";
    }
    if (removedOrders.has(RID)) {
      RID = undefined;
      $("#dlg").close();
    }
  }),
  fix: T((id) => {
    guard("count");
    const i = item(id);
    gs(i.sector);
    const q = parseFloat(
      String(
        prompt("Nova quantidade contada de " + i.name + " (" + i.unit + "):", i.lc.q) || "",
      ).replace(",", "."),
    );
    if (isNaN(q) || q < 0) return;
    const j = (prompt("Justificativa da correção (obrigatória):") || "").trim();
    if (!j) throw Error("Justificativa obrigatória.");
    (i.fix = i.fix || []).push({ at: now(), by: me().name, de: i.lc.q, para: q, j });
    i.stock = Math.max(0, i.stock + q - i.lc.q);
    log(`Correção de contagem ${i.name}: ${N(i.lc.q)} → ${N(q)} ${i.unit}. Justificativa: ${j}`);
    i.lc.q = q;
  }),
  sec: (s) => {
    S.sec = s;
    S.q = "";
    render();
  },
  set: T((id, v) => {
    guard("count");
    const i = item(id);
    gs(i.sector);
    const c = sess(i.sector);
    if (v === "") delete c.v[id];
    else c.v[id] = Math.max(0, parseFloat(String(v).replace(",", ".")) || 0);
  }),
  cnt: T((id, d) => {
    guard("count");
    const i = item(id);
    gs(i.sector);
    const c = sess(i.sector);
    c.v[id] = Math.max(0, Math.round(((c.v[id] ?? 0) + d) * 1000) / 1000);
  }),
  fin: T(() => {
    guard("count");
    const sec = S.sec;
    gs(sec);
    const c = S.cs[sec];
    if (!c || !Object.keys(c.v).length) throw Error("Nenhum item contado.");
    const m = items(sec).filter((i) => c.v[i.id] === undefined).length;
    if (m && !confirm(m + " itens não contados manterão o saldo atual. Concluir?")) return;
    Object.keys(c.v).forEach((id) => {
      const i = item(id),
        q = c.v[id];
      i.cons = {
        v: Math.round((i.lc.q + i.lc.rec - i.lc.waste - q) * 1000) / 1000,
        from: i.lc.at,
        to: ds(0),
      };
      log(`Contagem ${i.name}: ${N(q)} ${i.unit} (saldo anterior ${N(i.stock)})`);
      i.stock = q;
      i.lc = { q, at: ds(0), rec: 0, waste: 0 };
    });
    delete S.cs[sec];
    S.sec = null;
  }),
  filterWaste: T((sec) => {
    guard("waste");
    if (sec && !wasteSectors().includes(sec)) throw Error("Setor não autorizado.");
    S.wasteFilter = sec;
  }),
  wasteSector: () => {
    $("#wi").value = "";
    $("#wo").value = "";
    $("#waste-item-options").innerHTML = wasteSuggestions($("#wsec").value, "name");
    $("#waste-note-options").innerHTML = wasteSuggestions($("#wsec").value, "obs");
  },
  waste: T(() => {
    guard("waste");
    const name = $("#wi").value.trim(),
      sec = $("#wsec").value,
      q = Number($("#wq").value),
      reason = $("#wr").value,
      obs = $("#wo").value.trim();
    if (!wasteSectors().includes(sec)) throw Error("Selecione um setor autorizado.");
    gs(sec);
    if (!name) throw Error("Informe o item.");
    if (!(q > 0) || !Number.isFinite(q)) throw Error("Informe uma quantidade maior que zero.");
    if (!["vencimento", "avaria", "erro de preparo", "sobra", "outro"].includes(reason))
      throw Error("Selecione um motivo válido.");
    const i = S.i.find((i) => !i.deleted && i.sector == sec &&
      i.name.trim().toLocaleLowerCase() == name.toLocaleLowerCase());
    if (i && !i.on) throw Error("Este item está inativo no cadastro.");
    const next = JSON.parse(JSON.stringify(S));
    if (i) {
      const current = next.i.find((entry) => entry.id == i.id);
      current.stock = Math.max(0, current.stock - q);
      current.lc.waste += q;
    }
    next.w.unshift({
      item: i?.id || null,
      name: i?.name || name,
      unit: i?.unit || "",
      q,
      reason,
      obs,
      by: me().name,
      at: now(),
      d: ds(0),
      sec,
    });
    next.log.unshift({
      t: now(),
      u: me().name,
      m: `Desperdício: ${N(q)}${i ? " " + i.unit : ""} de ${i?.name || name} (${reason}) · ${sec}`,
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
  }),
  quote: T(() => {
    guard("ord");
    const p = parseFloat($("#qp").value);
    if (!(p > 0)) throw Error("Informe o preço.");
    if (!activeSuppliers().some((supplier) => supplier.id == $("#qs").value))
      throw Error("Selecione um fornecedor ativo.");
    S.qt.push({
      id: Date.now(),
      item: $("#qi").value,
      sup: $("#qs").value,
      price: p,
      min: +$("#qm").value,
      days: +$("#qd").value,
      obs: $("#qo").value,
      sel: 0,
    });
    log("Cotação registrada: " + nm($("#qi").value));
  }),
  pick: T((id) => {
    guard("ord");
    const q = S.qt.find((x) => x.id == id);
    S.qt.filter((x) => x.item == q.item).forEach((x) => (x.sel = 0));
    q.sel = 1;
    q.pend = 0;
    log("Cotação selecionada: " + nm(q.item) + " / " + sup(q.sup).name);
  }),
  mk: T((id) => {
    guard("ord");
    const s = $("#sp-" + id).value,
      q = parseFloat($("#qy-" + id).value),
      c = S.qt.find((x) => x.item == id && x.sup == s);
    if (!(q > 0)) throw Error("Quantidade inválida.");
    if (!activeSuppliers().some((supplier) => supplier.id == s))
      throw Error("Selecione um fornecedor ativo.");
    const n = nextOrderId();
    S.o.unshift({
      id: n,
      sup: s,
      items: [{ id, q, p: c ? c.price : 0 }],
      st: "rascunho",
      date: ds(0),
      eta: ds(c ? c.days : sup(s).lead),
      h: [now() + " · " + me().name + ": criado"],
    });
    log("Pedido " + n + " criado");
  }),
  ost: T((id, st) => {
    guard("ord");
    if (st == "cancelado" && !confirm("Cancelar este pedido?")) return;
    const o = ord(id);
    o.st = st;
    o.h.push(now() + " · " + me().name + ": " + st);
    log(`Pedido ${id}: ${st}`);
  }),
  eta: T((id, v) => {
    guard("ord");
    ord(id).eta = v;
    ord(id).h.push(now() + " · " + me().name + ": previsão " + br(v));
    log(`Pedido ${id}: previsão ${br(v)}`);
  }),
  rv: (id) => {
    RID = id;
    const o = ord(id);
    $("#dt").textContent = o.id + " · " + sup(o.sup).name;
    $("#db").innerHTML = o.items
      .map(
        (l) =>
          `<label>${nm(l.id)} · pedido: ${l.q} ${item(l.id).bu}<input type="number" step="any" min="0" id="rq-${l.id}" value="${l.q}"></label>`,
      )
      .join("");
    $("#dr").value = "";
    $("#do").value = "";
    $("#dlg").showModal();
  },
  rc: T((mode) => {
    guard("recv");
    const o = ord(RID);
    let diff = false,
      rs = $("#dr").value;
    if (mode == "none" && !rs) rs = "item faltando";
    o.items.forEach((l) => {
      const r =
        mode == "full"
          ? l.q
          : mode == "none"
            ? 0
            : Math.max(0, parseFloat($("#rq-" + l.id).value) || 0);
      l.r = r;
      if (r != l.q) diff = true;
      if (r > 0) {
        const i = item(l.id);
        i.stock += r * i.conv;
        i.lc.rec += r * i.conv;
      }
    });
    o.st =
      !diff && !rs
        ? "recebido"
        : rs || mode == "none"
          ? "com divergência"
          : "recebido parcialmente";
    const m = `${o.id} (${sup(o.sup).name}): ${o.st}${rs ? " — " + rs : ""}${$("#do").value ? " · " + $("#do").value : ""}`;
    o.h.push(now() + " · " + me().name + ": " + o.st);
    log("Recebimento " + m);
    if (o.st != "recebido") S.notes.unshift(m);
    $("#dlg").close();
  }),
  cad: T((id, f, v) => {
    guard("cad");
    item(id)[f] = Math.max(0, +v);
    log(`Cadastro ${nm(id)}: ${f} = ${v}`);
  }),
  editItem: T((id) => {
    guard("cad");
    const i = item(id);
    if (!i || i.deleted) throw Error("Item não encontrado.");
    $("#count-unit-options").innerHTML = unitOptions("unit");
    $("#buy-unit-options").innerHTML = unitOptions("bu");
    $("#edit-item-dialog").dataset.id = id;
    $("#edit-item-name").value = i.name;
    $("#edit-item-sector").innerHTML = S.sectors
      .map((sector) => `<option value="${escHtml(sector)}">${escHtml(sector)}</option>`)
      .join("");
    $("#edit-item-sector").value = i.sector;
    $("#edit-item-category").value = i.cat || "";
    $("#edit-item-unit").value = i.unit;
    $("#edit-item-buy-unit").value = i.bu;
    $("#edit-item-conversion").value = i.conv;
    $("#edit-item-minimum").value = i.min;
    $("#edit-item-ideal").value = i.ideal;
    $("#edit-item-supplier").innerHTML =
      '<option value="">Sem fornecedor definido</option>' +
      S.s
        .map((supplier) => `<option value="${escHtml(supplier.id)}">${escHtml(supplier.name)}</option>`)
        .join("");
    $("#edit-item-supplier").value = i.sup;
    $("#edit-item-stock").value = i.stock;
    $("#edit-item-toggle").textContent = i.on ? "Desativar item" : "Ativar item";
    $("#edit-item-delete-confirm").hidden = true;
    $("#edit-item-dialog").showModal();
  }),
  updateItem: T((id) => {
    guard("cad");
    const current = item(id);
    if (!current || current.deleted) throw Error("Item não encontrado.");
    const number = (selector) => {
      const value = String($(selector).value).trim();
      return value ? Number(value) : NaN;
    };
    const name = $("#edit-item-name").value.trim(),
      sector = $("#edit-item-sector").value,
      category = $("#edit-item-category").value.trim() || "Geral",
      unit = $("#edit-item-unit").value.trim(),
      buyUnit = $("#edit-item-buy-unit").value.trim(),
      conversion = number("#edit-item-conversion"),
      minimum = number("#edit-item-minimum"),
      ideal = number("#edit-item-ideal"),
      supplier = $("#edit-item-supplier").value,
      stock = number("#edit-item-stock");
    if (!name || !unit || !buyUnit) throw Error("Preencha nome e unidades de contagem e compra.");
    if (!S.sectors.includes(sector)) throw Error("Selecione um setor válido.");
    if (!(conversion > 0) || !Number.isFinite(conversion))
      throw Error("A conversão deve ser maior que zero.");
    if (![minimum, ideal, stock].every((value) => Number.isFinite(value) && value >= 0))
      throw Error("Mínimo, ideal e saldo atual devem ser números iguais ou maiores que zero.");
    if (ideal < minimum) throw Error("O estoque ideal não pode ser menor que o mínimo.");
    if (supplier ? !sup(supplier) : current.sup)
      throw Error("Selecione um fornecedor válido ou mantenha o item sem fornecedor.");

    const next = JSON.parse(JSON.stringify(S)),
      updated = next.i.find((candidate) => candidate.id == id);
    Object.assign(updated, {
      name,
      sector,
      cat: category,
      unit,
      bu: buyUnit,
      conv: conversion,
      min: minimum,
      ideal,
      sup: supplier,
      stock,
    });
    next.log.unshift({
      t: now(),
      u: me().name,
      m: `Cadastro atualizado: ${current.name}${current.name == name ? "" : " → " + name}.`,
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    $("#edit-item-dialog").close();
  }),
  on: T((id) => {
    guard("cad");
    const i = item(id);
    if (!i || i.deleted) throw Error("Item não encontrado.");
    i.on = i.on ? 0 : 1;
    log(`${i.name}: ${i.on ? "ativado" : "inativado"}`);
    $("#edit-item-dialog").close();
  }),
  deleteItem: T((id) => {
    guard("cad");
    const i = item(id);
    if (!i || i.deleted) throw Error("Item não encontrado.");
    const next = JSON.parse(JSON.stringify(S));
    next.i.find((i) => i.id == id).deleted = true;
    Object.values(next.cs).forEach((count) => delete count.v[id]);
    next.log.unshift({
      t: now(),
      u: me().name,
      m: `Item excluído do cadastro: ${i.name}. Registros anteriores preservados.`,
    });
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    if (LU && LU.id == id) {
      LU = null;
      if ($("#toast")) $("#toast").style.display = "none";
    }
    $("#edit-item-dialog").close();
  }),
};
const sess = (sec) => {
  const c = S.cs[sec] || (S.cs[sec] = { v: {} });
  c.by = me().name;
  c.at = now();
  return c;
};
function render() {
  const u = me(),
    nav = NAV.filter((n) => n[2].includes(u.role));
  if (!nav.find((n) => n[0] == S.v)) S.v = nav[0][0];
  if (S.th) document.documentElement.dataset.theme = S.th;
  else delete document.documentElement.dataset.theme;
  $("#app").innerHTML =
    `<header><div class="logo"><i>zippy</i><b>.</b><span>controle</span></div><select onchange="A.user(this.value)" title="Usuário atual">${S.u.map((x) => `<option value="${x.id}" ${x.id == S.uid ? "selected" : ""}>${x.name} · ${{ func: "Funcionário", analista: "Analista", gestor: "Gestor", compras: "Compras", admin: "Admin" }[x.role]}</option>`).join("")}</select><button class="bell" onclick="A.bell()" aria-label="Avisos" title="Avisos"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>${unread() ? `<b>${unread()}</b>` : ""}</button><label class="switch" title="Alternar tema"><input type="checkbox" aria-label="Alternar tema" ${(S.th ? S.th == "dark" : matchMedia("(prefers-color-scheme:dark)").matches) ? "checked" : ""} onchange="A.th()"><span class="slider"></span></label></header>
 ${panel()}<div class="lay">${navigation(nav)}<main>${V[S.v]()}</main></div>`;
}
const series = () => {
  const dc = [34, 41, 38, 52, 47, 58, 55],
    dw = [3, 2, 4, 2, 5, 3, 2];
  return [...Array(7)].map((_, k) => {
    const d = ds(k - 6);
    return {
      d,
      c:
        dc[k] + S.i.reduce((a, i) => a + (i.cons && i.cons.to == d ? Math.max(0, i.cons.v) : 0), 0),
      w: dw[k] + S.w.filter((w) => w.d == d).reduce((a, w) => a + w.q, 0),
    };
  });
};
A.sec = (s) => {
  S.sec = s;
  S.cat = null;
  S.q = "";
  S.pend = 0;
  render();
};
A.cat = (c) => {
  S.cat = c;
  S.q = "";
  S.pend = 0;
  render();
};
A.pend = () => {
  S.pend = !S.pend;
  render();
};
A.set = (id, v) => {
  try {
    guard("count");
    const i = item(id);
    gs(i.sector);
    const c = sess(i.sector);
    if (v === "") delete c.v[id];
    else c.v[id] = Math.max(0, parseFloat(String(v).replace(",", ".")) || 0);
    save();
  } catch (e) {
    alert(e.message);
  }
};
V.dash = () => {
  const f = S.f || "",
    u = me(),
    its = items(f),
    from = S.pd ? ds(-S.pd) : "",
    open = S.o.filter((o) => !["recebido", "cancelado"].includes(o.st)),
    td = S.o.filter(today),
    lt = S.o.filter(late),
    low = its.filter((i) => i.stock < i.min),
    wv = (a, b) =>
      S.w
        .filter((w) => (w.d || "") >= a && (w.d || "") <= b && (!f || w.sec == f))
        .reduce((s, w) => s + w.q * cost(w.item), 0),
    w1 = wv(ds(-6), ds(0)),
    w0 = wv(ds(-13), ds(-7)),
    pc = w0 ? Math.round(((w1 - w0) / w0) * 100) : null,
    h = new Date().getHours(),
    sp = new Set(td.map((o) => o.sup)).size,
    kp = [
      ["Estoque abaixo do mínimo", low.length, "itens para repor", "var(--or)", "stock", "low"],
      [
        "Pedidos em andamento",
        open.length,
        S.o.filter((o) => o.st == "aguardando aprovação").length + " aguardam aprovação",
        "var(--pk)",
        "orders",
        "",
      ],
      [
        "Entregas para hoje",
        td.length,
        "de " + sp + " fornecedor" + (sp == 1 ? "" : "es"),
        "var(--wa)",
        "deliv",
        "",
      ],
      [
        "Desperdício na semana",
        R(w1),
        pc === null
          ? "semana anterior sem dados"
          : (pc <= 0 ? "↓ " : "↑ ") + Math.abs(pc) + "% esta semana",
        pc !== null && pc > 0 ? "var(--er)" : "var(--ok)",
        "waste",
        "",
      ],
    ],
    sr = series(),
    mx = Math.max(...sr.map((x) => Math.max(x.c, x.w))) * 1.1,
    pth = (k) => {
      const p = sr.map((x, i) => [i * 100, 200 - (x[k] / mx) * 190]);
      return p
        .map((q, i) =>
          i
            ? `C${(p[i - 1][0] + q[0]) / 2},${p[i - 1][1]} ${(p[i - 1][0] + q[0]) / 2},${q[1]} ${q[0]},${q[1]}`
            : `M${q[0]},${q[1]}`,
        )
        .join("");
    },
    grp = {};
  td.forEach((o) => (grp[o.sup] = (grp[o.sup] || 0) + 1));
  const ws = S.w.filter((w) => (!f || w.sec == f) && (w.d || ds(0)) >= from),
    rs = {};
  ws.forEach((w) => (rs[w.reason] = (rs[w.reason] || 0) + w.q));
  const rm = Math.max(1, ...Object.values(rs));
  const at =
    Object.keys(grp)
      .map(
        (s) =>
          `<div class="at hl"><span class="dt" style="background:var(--or)"></span><b>Entrega prevista hoje</b><div class="l"><span class="mu">${sup(s).name} · ${grp[s]} pedido${grp[s] > 1 ? "s" : ""}</span><a onclick="A.go('deliv','')">Acompanhar →</a></div></div>`,
      )
      .join("") +
    lt
      .map(
        (o) =>
          `<div class="at"><span class="dt" style="background:var(--er)"></span><b>Pedido atrasado</b><br><span class="mu">${sup(o.sup).name} · ${o.id} (previsto ${br(o.eta)})</span></div>`,
      )
      .join("") +
    low
      .slice(0, 3)
      .map(
        (i) =>
          `<div class="at"><span class="dt" style="background:var(--pk)"></span><b>Estoque crítico</b><br><span class="mu">${i.name} · ${N(i.stock)} ${i.unit} restantes</span></div>`,
      )
      .join("");
  return (
    `<div class="crumb">Zippy Controle / Visão geral</div><h2 style="margin-bottom:2px">${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"}, ${u.name.split(" ")[0]} 👋</h2><p class="mu" style="font-family:Inter;margin:0 0 14px">Resumo da operação hoje, ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}.</p>
 <div class="fm" style="max-width:480px"><label>Período<select onchange="A.pd(this.value)">${[
   [0, "Todo o histórico"],
   [7, "Últimos 7 dias"],
   [30, "Últimos 30 dias"],
 ]
   .map((p) => `<option value="${p[0]}" ${p[0] == (S.pd || 0) ? "selected" : ""}>${p[1]}</option>`)
   .join(
     "",
   )}</select></label><label>Setor<select onchange="A.f(this.value)"><option value="">Todos</option>${S.sectors.map((s) => `<option ${s == f ? "selected" : ""}>${escHtml(s)}</option>`).join("")}</select></label></div>
 <div class="grid">${kp.map((k) => `<button class="card tap kpi" onclick="A.go('${k[4]}','${k[5]}')"><span class="mu" style="font-family:Inter">${k[0]}</span><b class="n">${k[1]}</b><span class="sb" style="color:${k[3]}">${k[2]}</span></button>`).join("")}</div>
 <div class="two"><div class="card" style="padding:20px"><h3 style="margin:0">Consumo de insumos</h3><span class="mu">Unidades estimadas, todos os itens · últimos 7 dias · base de demonstração</span>
 <svg viewBox="0 0 600 200" preserveAspectRatio="none" style="width:100%;height:190px;margin-top:12px">${[0, 1, 2, 3].map((k) => `<line x1="0" x2="600" y1="${k * 62 + 5}" y2="${k * 62 + 5}" stroke="var(--ln)"/>`).join("")}<path d="${pth("c")}" fill="none" stroke="var(--or)" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${pth("w")}" fill="none" stroke="var(--pk)" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
 <div class="row" style="border:0;justify-content:space-between;padding:4px 0 0">${sr.map((x) => `<span class="mu">${new Date(x.d + "T12:00").toLocaleDateString("pt-BR", { weekday: "short" })}</span>`).join("")}</div><span class="mu"><span class="dt" style="background:var(--or)"></span>Consumo estimado <span class="dt" style="background:var(--pk);margin-left:10px"></span>Desperdício</span></div>
 <div class="card" style="padding:20px"><h3 style="margin:0">Atenção para hoje</h3><span class="mu" style="font-family:Inter">Entregas previstas e itens críticos</span>${at || '<p class="mu">Nada urgente hoje.</p>'}</div></div>
 <div class="card" style="padding:20px;margin-top:12px"><div class="row" style="border:0;padding:0"><div class="f"><h3 style="margin:0">Itens para repor</h3><span class="mu" style="font-family:Inter">Produtos abaixo do estoque mínimo</span></div>${PERM.ord.includes(u.role) ? `<button onclick="A.go('orders','')">+ Criar pedido</button>` : ""}</div>` +
    tb(
      ["Item", "Setor", "Saldo", "Mínimo", "Fornecedor"],
      low.map((i) => [
        `<b>${i.name}</b>`,
        escHtml(i.sector),
        `<span style="color:var(--pk)">${N(i.stock)} ${i.unit}</span>`,
        "mín. " + N(i.min),
        `<b>${sup(i.sup).name}</b>`,
      ]),
    ) +
    `</div>
 <h3>Consumo estimado por item <span class="mu">(inicial + recebimentos − desperdícios − final)</span></h3>` +
    tb(
      ["Item", "Período", "Consumo estimado"],
      its
        .filter((i) => i.cons && i.cons.to >= from)
        .map((i) => [
          i.name,
          br(i.cons.from) + " a " + br(i.cons.to),
          N(i.cons.v) + " " + i.unit + " " + bd("estimado", "wa"),
        ]),
    ) +
    `<h3>Desperdício por motivo · ${R(ws.reduce((a, w) => a + w.q * cost(w.item), 0))} estimados</h3>` +
    (Object.keys(rs)
      .map(
        (k) =>
          `<div class="row"><span style="width:110px">${k}</span><div class="f"><div class="bar" style="width:${(rs[k] / rm) * 100}%"></div></div><span>${N(rs[k])}</span></div>`,
      )
      .join("") || '<p class="mu">Sem registros</p>') +
    `<h3>Preços cotados</h3>` +
    tb(
      ["Item", "Menor", "Maior", "Cotações"],
      its
        .filter((i) => S.qt.some((q) => q.item == i.id))
        .map((i) => {
          const p = S.qt.filter((q) => q.item == i.id).map((q) => q.price);
          return [i.name, R(Math.min(...p)), R(Math.max(...p)), p.length];
        }),
    )
  );
};
V.count = () => {
  const u = me(),
    secs = u.role == "func" ? [u.sector].filter(Boolean) : S.sectors,
    sec = secs.includes(S.sec) ? S.sec : null,
    q = (S.q || "").toLowerCase(),
    ic = { Bar: ["◉", "--or"], Hortifruti: ["✿", "--pk"], "Estoque seco": ["▤", "--ok"] };
  if (!secs.length)
    return `<h2>Contagens</h2><p class="mu">${u.role == "func" ? "Você está sem setor. Solicite a vinculação a um administrador." : "Nenhum setor cadastrado. Cadastre um setor antes de iniciar uma contagem."}</p>`;
  if (!sec) {
    const tgt = secs.find((s) => S.cs[s]) || secs[0];
    return (
      `<div class="cw"><h2 style="margin-bottom:2px">Contagem de hoje</h2><p class="mu" style="font-family:Inter;margin:0 0 12px">Escolha o setor para começar</p><input placeholder="Buscar setor ou produto" style="margin-bottom:12px" oninput="document.querySelectorAll('[data-s]').forEach(e=>e.style.display=e.dataset.s.includes(this.value.toLowerCase())?'':'none')">` +
      secs
        .map((s) => {
          const its = items(s),
            n = S.cs[s] ? Object.keys(S.cs[s].v).length : 0,
            x = ic[s] || ["◉", "--or"];
          return `<div class="card sc" data-s="${escHtml((s + " " + its.map((i) => i.name + " " + i.cat).join(" ")).toLowerCase())}" onclick="A.sec(${escHtml(JSON.stringify(s))})"><div class="ic" style="background:color-mix(in srgb,var(${x[1]}) 14%,transparent);color:var(${x[1]})">${x[0]}</div><div class="f"><b>${escHtml(s)}</b><br><span class="mu" style="font-family:Inter">${escHtml([...new Set(its.map((i) => i.cat))].join(", "))}</span><div class="pg" style="margin:8px 0 4px"><div style="width:${its.length ? (n / its.length) * 100 : 0}%"></div></div><span class="mu">${n ? n + " de " + its.length + " itens" : "Ainda não iniciado"}</span></div><span class="mu">›</span></div>`;
        })
        .join("") +
      `<button style="width:100%;padding:14px;margin-top:6px" onclick="A.sec(${escHtml(JSON.stringify(tgt))})">${S.cs[tgt] ? "Continuar contagem" : "Iniciar contagem"}</button></div>`
    );
  }
  const its = items(sec),
    c = S.cs[sec] || { v: {} },
    n = Object.keys(c.v).length,
    cats = [...new Set(its.map((i) => i.cat))],
    cat = cats.includes(S.cat) ? S.cat : null;
  if (!cat)
    return (
      `<div class="cw"><button class="bk" onclick="A.sec(null)">‹ Voltar</button><h2 style="margin-bottom:2px">${escHtml(sec)}</h2><p class="mu" style="font-family:Inter;margin:0 0 8px">Escolha a categoria${c.by ? " · " + c.by + " · " + c.at : ""}</p><div class="pg"><div style="width:${its.length ? (n / its.length) * 100 : 0}%"></div></div><p class="mu">${n} de ${its.length} itens contados</p>` +
      cats
        .map((k) => {
          const ci = its.filter((i) => i.cat == k);
          return `<div class="card sc" data-category="${escHtml(k)}" onclick="A.cat(this.dataset.category)"><div class="f"><b>${escHtml(k)}</b><br><span class="mu">${ci.filter((i) => c.v[i.id] !== undefined).length} de ${ci.length} itens</span></div><span class="mu">›</span></div>`;
        })
        .join("") +
      `<button style="width:100%;padding:14px;margin-top:6px" onclick="A.fin()">Concluir contagem do setor</button></div>`
    );
  const ci = its.filter((i) => i.cat == cat),
    cn = ci.filter((i) => c.v[i.id] !== undefined).length,
    list = ci.filter(
      (i) => (!S.pend || c.v[i.id] === undefined) && (!q || i.name.toLowerCase().includes(q)),
    );
  return (
    `<div class="cw"><button class="bk" onclick="A.cat(null)">‹ Voltar</button><h2 style="margin-bottom:2px">${escHtml(sec)} · ${escHtml(cat)}</h2><p class="mu" style="font-family:Inter;margin:0 0 8px">Conte o que está disponível no setor</p><div class="pg"><div style="width:${(cn / ci.length) * 100}%"></div></div>
 <div class="row" style="border:0;padding:0 0 8px"><span class="mu f">${cn} de ${ci.length} itens contados</span><button class="lk" onclick="A.pend()">${S.pend ? "Ver todos" : "Ver pendentes"}</button></div>
 <input placeholder="Buscar produto" value="${S.q || ""}" style="margin-bottom:10px" oninput="S.q=this.value;document.querySelectorAll('[data-n]').forEach(e=>e.style.display=e.dataset.n.includes(this.value.toLowerCase())?'':'none')">` +
    list
      .map(
        (i) =>
          `<div class="it" data-n="${escHtml(i.name.toLowerCase())}"><b>${escHtml(i.name)}</b><br><span class="mu">Unidade de contagem: ${escHtml(i.unit)}</span> ${c.v[i.id] === undefined ? bd("não contado", "wa") : ""}<div class="c2"><button onclick="A.cnt('${i.id}',-1)">−</button><input inputmode="decimal" placeholder="—" value="${c.v[i.id] ?? ""}" onchange="A.set('${i.id}',this.value)"><button class="pl" onclick="A.cnt('${i.id}',1)">+</button><span class="mu">${escHtml(i.unit)}</span></div></div>`,
      )
      .join("") +
    `<button style="width:100%;padding:14px;margin-top:4px" onclick="A.cat(null)">Salvar e continuar</button></div>`
  );
};
const alerts = () => {
  const a = [],
    r = me().role;
  S.o.filter(late).forEach((o) =>
    a.push({
      id: "late-" + o.id,
      t: o.id + " atrasado",
      s: sup(o.sup).name + " · previsto " + br(o.eta),
      c: "var(--er)",
      v: "deliv",
    }),
  );
  S.o.filter(today).forEach((o) =>
    a.push({
      id: "td-" + o.id + ds(0),
      t: "Entrega prevista hoje",
      s: sup(o.sup).name + " · " + o.id,
      c: "var(--or)",
      v: "deliv",
    }),
  );
  S.notes
    .slice(0, 5)
    .forEach((n) =>
      a.push({ id: "n-" + n, t: "Divergência no recebimento", s: n, c: "var(--er)", v: "deliv" }),
    );
  if (r != "func")
    items()
      .filter((i) => i.stock < i.min)
      .forEach((i) =>
        a.push({
          id: "low-" + i.id + "-" + i.stock,
          t: "Estoque abaixo do mínimo",
          s: i.name + " · " + N(i.stock) + " " + i.unit,
          c: "var(--pk)",
          v: "stock",
        }),
      );
  return a;
};
const unread = () => alerts().filter((a) => !(S.rd || []).includes(a.id)).length;
const panel = () => {
  if (!S.bo) return "";
  const a = alerts(),
    rd = S.rd || [];
  return (
    `<div class="pn card"><div class="row" style="border:0;padding:0"><b class="f">Avisos</b><button class="lk" onclick="A.rdall()">Marcar tudo como lido</button></div>` +
    (a
      .map(
        (x, k) =>
          `<div class="at ${rd.includes(x.id) ? "" : "hl"}" style="cursor:pointer;opacity:${rd.includes(x.id) ? 0.6 : 1}" onclick="A.al(${k})"><span class="dt" style="background:${x.c}"></span><b>${x.t}</b><br><span class="mu">${x.s}</span></div>`,
      )
      .join("") || '<p class="mu">Sem avisos.</p>') +
    `</div>`
  );
};
A.bell = () => {
  S.bo = !S.bo;
  render();
};
A.rdall = () => {
  S.rd = alerts().map((a) => a.id);
  save();
  render();
};
A.al = (k) => {
  const a = alerts()[k];
  S.rd = [...(S.rd || []), a.id];
  S.bo = 0;
  if (NAV.some((n) => n[0] == a.v && n[2].includes(me().role))) {
    S.v = a.v;
    S.lf = "";
  }
  save();
  render();
};
let LU = null;
const toast = () => {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.innerHTML =
    "Salvo às " +
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) +
    ' · <a onclick="A.undo()">Desfazer</a>';
  t.style.display = "block";
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.style.display = "none"), 5000);
};
A.cnt = (id, d) => {
  try {
    guard("count");
    const i = item(id);
    gs(i.sector);
    const c = sess(i.sector);
    LU = { id, prev: c.v[id] };
    c.v[id] = Math.max(0, Math.round(((c.v[id] ?? 0) + d) * 1000) / 1000);
    save();
    render();
    toast();
  } catch (e) {
    alert(e.message);
  }
};
A.set = (id, v) => {
  try {
    guard("count");
    const i = item(id);
    gs(i.sector);
    const c = sess(i.sector);
    LU = { id, prev: c.v[id] };
    if (v === "") delete c.v[id];
    else c.v[id] = Math.max(0, parseFloat(String(v).replace(",", ".")) || 0);
    save();
    toast();
  } catch (e) {
    alert(e.message);
  }
};
A.undo = () => {
  if (!LU) return;
  const i = item(LU.id),
    c = sess(i.sector);
  if (LU.prev === undefined) delete c.v[LU.id];
  else c.v[LU.id] = LU.prev;
  LU = null;
  save();
  render();
  $("#toast").style.display = "none";
};
const msg = (o) =>
  `Olá, ${sup(o.sup).name.replace(" (demo)", "")}! Segue o pedido ${o.id} do bar (Zippy Controle):\n` +
  o.items.map((l) => `• ${l.q} × ${item(l.id).bu} — ${nm(l.id)}`).join("\n") +
  `\nPrevisão de entrega: ${br(o.eta)}.\nPode confirmar o recebimento? Obrigado!`;
A.send = T((id) => {
  guard("ord");
  const o = ord(id),
    s = sup(o.sup);
  window.open(
    "https://wa.me/" + (s.wa || "") + "?text=" + encodeURIComponent(msg(o)),
    "_blank",
    "noopener",
  );
  if (
    o.st == "aprovado" &&
    confirm("Mensagem enviada ao fornecedor? Marcar o pedido como enviado.")
  )
    o.st = "enviado";
  o.h.push(now() + " · " + me().name + ": WhatsApp aberto para " + s.name);
  log("Pedido " + id + ": mensagem de WhatsApp preparada");
});
A.cp = (id) => {
  navigator.clipboard.writeText(msg(ord(id))).then(
    () => alert("Pedido copiado."),
    () => alert("Não foi possível copiar neste navegador."),
  );
};
A.wa = T((id, v) => {
  guard("ord");
  let d = v.replace(/\D/g, "");
  if (d && d.length <= 11) d = "55" + d;
  sup(id).wa = d;
  log("WhatsApp atualizado: " + sup(id).name);
});
A.genAll = T(() => {
  guard("ord");
  const sg = items().filter(
      (i) =>
        i.stock <= i.min &&
        !S.o.some(
          (o) => !["recebido", "cancelado"].includes(o.st) && o.items.some((l) => l.id == i.id),
        ),
    ),
    g = {};
  sg.forEach((i) => {
    const ch = S.qt.find((x) => x.item == i.id && x.sel),
      s = ch ? ch.sup : i.sup,
      q = S.qt.find((x) => x.item == i.id && x.sup == s);
    (g[s] = g[s] || []).push({
      id: i.id,
      q: Math.max(1, Math.ceil((i.ideal - i.stock) / i.conv)),
      p: q ? q.price : 0,
      d: q ? q.days : sup(s).lead,
    });
  });
  const ks = Object.keys(g);
  if (!ks.length) throw Error("Nenhuma sugestão pendente.");
  ks.forEach((s) => {
    const n = nextOrderId();
    S.o.unshift({
      id: n,
      sup: s,
      items: g[s].map(({ id, q, p }) => ({ id, q, p })),
      st: "rascunho",
      date: ds(0),
      eta: ds(Math.max(...g[s].map((x) => x.d))),
      h: [now() + " · " + me().name + ": gerado das sugestões"],
    });
    log("Pedido " + n + " gerado das sugestões");
  });
});
A.csv = () => {
  const r = [
    ["Item", "Setor", "Saldo", "Minimo", "Fornecedor"],
    ...items()
      .filter((i) => i.stock < i.min)
      .map((i) => [i.name, i.sector, i.stock, i.min, sup(i.sup).name]),
  ];
  navigator.clipboard.writeText(r.map((x) => x.join(";")).join("\n")).then(
    () => alert("CSV copiado."),
    () => alert("Não foi possível copiar neste navegador."),
  );
};
const vo = V.orders,
  vd = V.dash,
  vs = V.sup;
V.orders = () => {
  const rd = S.o.filter((o) => ["aprovado", "enviado"].includes(o.st));
  return vo().replace(
    "<h3>Sugestões de reposição</h3>",
    `<div class="card" style="padding:16px;margin-bottom:12px"><b>Envio por WhatsApp</b><span class="mu" style="font-family:Inter">Pedidos aprovados prontos para o fornecedor. A mensagem abre pronta no WhatsApp.</span>` +
      (rd
        .map(
          (o) =>
            `<div class="row"><span class="f"><b>${o.id}</b> · ${sup(o.sup).name}<br><span class="mu">${sup(o.sup).wa ? "+" + sup(o.sup).wa : "sem número cadastrado"}</span></span><button class="sm" onclick="A.send('${o.id}')">WhatsApp</button><button class="g sm" onclick="A.cp('${o.id}')">Copiar</button></div>`,
        )
        .join("") || '<p class="mu">Nenhum pedido aprovado aguardando envio.</p>') +
      `</div><button onclick="A.genAll()">Gerar pedidos das sugestões</button><h3>Sugestões de reposição</h3>`,
  );
};
V.dash = () =>
  vd() + `<p><button class="g sm" onclick="A.csv()">Copiar CSV dos itens para repor</button></p>`;
V.sup = () =>
  vs() +
  `<h3>WhatsApp dos fornecedores</h3><div class="fm">${S.s.filter((supplier) => !supplier.deleted).map((s) => `<label>${escHtml(s.name)}<input type="tel" placeholder="(19) 99999-9999" value="${escHtml(s.wa || "")}" onchange="A.wa('${escHtml(s.id)}',this.value)"></label>`).join("")}</div>`;
A.th = () => {
  const d =
    document.documentElement.dataset.theme == "dark" ||
    (!S.th && matchMedia("(prefers-color-scheme:dark)").matches);
  S.th = d ? "light" : "dark";
  document.documentElement.dataset.theme = S.th;
  save();
};
let LK = "";
const _r = render;
render = function () {
  _r();
  const k = S.v + "|" + S.sec + "|" + S.cat,
    m = document.querySelector("main");
  if (m && k != LK) m.classList.add("pi");
  LK = k;
};
render();
