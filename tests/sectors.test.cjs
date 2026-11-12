const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "css", "styles.css"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const demoFixture = `
  S.uid = "u5";
  S.v = "count";
  S.sectors = ["Bar", "Hortifruti", "Estoque seco"];
  S.u = [
    {id:"u1",name:"Ana (demo)",role:"func",sector:"Bar"},
    {id:"u2",name:"Bruno (demo)",role:"analista"},
    {id:"u3",name:"Carla (demo)",role:"gestor"},
    {id:"u4",name:"Diego (demo)",role:"compras"},
    {id:"u5",name:"Eva (demo)",role:"admin"}
  ];
  S.s = [
    {id:"s1",name:"Adega Central (demo)",contact:"(11) 5555-0101",lead:2},
    {id:"s2",name:"Hortifruti Bom Preço (demo)",contact:"(11) 5555-0102",lead:1},
    {id:"s3",name:"Distribuidora Seca (demo)",contact:"(11) 5555-0103",lead:3}
  ];
  S.i = [
    I("gin","Gin London Dry","Bar","Destilados","garrafa","caixa (6)",6,4,12,"s1",3,2),
    I("vod","Vodka","Bar","Destilados","garrafa","caixa (12)",12,6,18,"s1",10,2),
    I("lim","Limão","Hortifruti","Frutas","kg","caixa 20 kg",20,5,20,"s2",8,9),
    I("gua","Guardanapos","Estoque seco","Descartáveis","pacote","caixa (20)",20,10,40,"s3",12,3)
  ];
  S.cs = {Bar:{v:{gin:3,vod:10},by:"Ana (demo)",at:now()}};
  S.w = [{item:"lim",q:2,reason:"vencimento",obs:"",by:"Ana (demo)",at:now(),d:ds(0),sec:"Hortifruti"}];
  S.qt = [{id:1,item:"gin",sup:"s1",price:540,min:1,days:2,obs:"",sel:1}];
  S.o = [
    {id:"P-001",sup:"s1",items:[{id:"vod",q:2,p:560}],st:"enviado",date:ds(-2),eta:ds(0),h:[]},
    {id:"P-003",sup:"s2",items:[{id:"lim",q:1,p:70}],st:"aguardando aprovação",date:ds(0),eta:ds(1),h:[]}
  ];
  S.notes = ["P-001 (Adega): com divergência"];
  S.log = [];
`;

test("delivery reminders appear in notifications, not in counting", () => {
  const app = setup();
  assert.doesNotMatch(app.run("V.count()"), /entrega prevista|Chegou/);
  assert.equal(app.run('alerts().some((alert) => alert.t === "Entrega prevista hoje")'), true);
  app.run("S.bo = true");
  assert.match(app.run("panel()"), /Entrega prevista hoje/);
});

test("primary and save buttons are green while destructive buttons stay red", () => {
  assert.match(styles, /button\s*\{[^}]*background:\s*var\(--ok\)/s);
  assert.match(styles, /button\.p\s*\{[^}]*background:\s*var\(--ok\)/s);
  assert.match(styles, /button\.add\s*\{[^}]*background:\s*var\(--or\)/s);
  assert.match(styles, /button\.x\s*\{[^}]*background:\s*var\(--er\)/s);
  assert.match(styles, /button\.supplier-toggle\s*\{[^}]*background:\s*#d97706/s);
  assert.match(styles, /button\.supplier-delete\s*\{[^}]*background:\s*#d00024/s);
  assert.match(styles, /button\.g\s*\{[^}]*background:\s*transparent/s);
});

test("add actions use the orange button style", () => {
  const app = setup();
  assert.match(app.run("cadViews.sectors()"), /<button class="add"[^>]*>Adicionar setores/);
  assert.match(app.run("cadViews.items()"), /<button class="add"[^>]*>Adicionar itens/);
  assert.match(app.run("cadViews.suppliers()"), /<button class="add"[^>]*>Adicionar fornecedor/);
});

test("navigation has accessible icons, active state and a persistent collapse toggle", () => {
  const app = setup();
  const markup = app.run("navigation(NAV.filter((entry) => entry[2].includes(me().role)))");
  assert.match(markup, /aria-label="Menu principal"/);
  assert.equal((markup.match(/class="nav-link /g) || []).length, 9);
  assert.equal((markup.match(/aria-current="page"/g) || []).length, 1);
  assert.match(markup, /aria-expanded="true"/);
  assert.match(markup, /aria-hidden="true"/);
  app.run("A.toggleNavigation()");
  assert.equal(app.state().navCollapsed, true);
  assert.equal(JSON.parse(app.storage.get("zippy-controle-v2")).navCollapsed, true);
  const collapsed = app.run("navigation(NAV)");
  assert.match(collapsed, /is-collapsed/);
  assert.match(collapsed, /aria-label="Expandir menu"/);
  assert.match(collapsed, /aria-expanded="false"/);
  app.run("A.nav('stock')");
  assert.equal(app.state().v, "stock");
  assert.equal(app.state().navCollapsed, true);
  app.run("A.toggleNavigation()");
  assert.equal(app.state().navCollapsed, false);
});

test("navigation collapse reports storage errors without changing state", () => {
  const app = setup();
  const before = app.state();
  app.context.localStorage.setItem = () => { throw Error("Sem espaço"); };
  app.run("A.toggleNavigation()");
  assert.deepEqual(app.state(), before);
  assert.deepEqual(app.messages, ["Sem espaço"]);
});

function setup({ empty = false, legacyData = false, storedData } = {}) {
  const messages = [];
  const storage = new Map(
    legacyData ? [["zippy-controle-v1", JSON.stringify({ fake: "data" })]] : [],
  );
  if (storedData) storage.set("zippy-controle-v2", storedData);
  const nodes = new Map();
  const getNode = (selector) => {
    if (!nodes.has(selector)) {
      nodes.set(selector, {
        style: {},
        dataset: {},
        value: "",
        innerHTML: "",
        textContent: "",
        hidden: false,
        classList: { add() {} },
        open: false,
        close() { this.open = false; },
        showModal() { this.open = true; },
        focus() {},
        reset() {
          if (selector === "#registration-form") {
            getNode("#sector-name").value = "";
            for (const field of ["name", "cat", "un", "bu"]) getNode("#n-" + field).value = "";
            for (const field of ["min", "ide", "st"]) getNode("#n-" + field).value = "0";
            getNode("#n-cv").value = "1";
            return;
          }
          getNode("#s-name").value = "";
          getNode("#s-ct").value = "";
          getNode("#s-ld").value = "2";
        },
      });
    }
    return nodes.get(selector);
  };
  const context = vm.createContext({
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    document: {
      querySelector: getNode,
      documentElement: { dataset: {} },
    },
    matchMedia: () => ({ matches: false }),
    alert: (message) => messages.push(message),
    prompt: () => "Bar",
    confirm: () => true,
  });
  vm.runInContext(source, context);
  if (!empty) vm.runInContext(demoFixture, context);
  vm.runInContext("render = () => {};", context);
  return {
    context,
    messages,
    node: getNode,
    run: (code) => vm.runInContext(code, context),
    state: () => JSON.parse(vm.runInContext("JSON.stringify(S)", context)),
    storage,
  };
}

function fillWaste(app, { name = "Gin London Dry", sec = "Bar", q = "1", obs = "Garrafa quebrada" } = {}) {
  app.node("#wi").value = name;
  app.node("#wsec").value = sec;
  app.node("#wq").value = q;
  app.node("#wr").value = "avaria";
  app.node("#wo").value = obs;
}

test("waste accepts new names without creating stock and persists reusable suggestions", () => {
  const app = setup();
  const before = app.state().i;
  fillWaste(app, { name: "  Suco preparado  ", obs: "  Restou no fim do turno  " });
  app.run("A.waste()");
  assert.deepEqual(app.messages, []);
  assert.deepEqual(app.state().i, before);
  assert.equal(app.state().w[0].item, null);
  assert.equal(app.state().w[0].name, "Suco preparado");
  assert.equal(app.state().w[0].obs, "Restou no fim do turno");
  const reloaded = setup({ empty: true, storedData: app.storage.get("zippy-controle-v2") });
  assert.match(reloaded.run('wasteSuggestions("Bar", "name")'), /value="Suco preparado"/);
  assert.match(reloaded.run('wasteSuggestions("Bar", "obs")'), /value="Restou no fim do turno"/);
  assert.match(reloaded.run("V.waste()"), /Suco preparado/);
  assert.doesNotThrow(() => reloaded.run("V.dash()"));
});

test("waste resolves registered items by trimmed case-insensitive name and preserves stock accounting", () => {
  const app = setup();
  fillWaste(app, { name: " gin london dry ", q: "1.5" });
  app.run("A.waste()");
  const state = app.state();
  assert.deepEqual(app.messages, []);
  assert.equal(state.w[0].item, "gin");
  assert.equal(state.w[0].name, "Gin London Dry");
  assert.equal(state.w[0].unit, "garrafa");
  assert.equal(state.i.find((i) => i.id === "gin").stock, 1.5);
  assert.equal(state.i.find((i) => i.id === "gin").lc.waste, 1.5);
  assert.match(app.run("V.waste()"), /1,5 garrafa/);
});

test("waste suggestions deduplicate, escape text and include legacy records", () => {
  const app = setup();
  app.run(`
    S.w.push(
      {item:"gin",sec:"Bar",obs:" Quebrou "},
      {item:"gin",sec:"Bar",obs:"quebrou"},
      {item:null,name:'<Suco & "chá">',sec:"Bar",obs:'<img src=x onerror=alert(1)>'}
    );
  `);
  assert.equal((app.run('wasteSuggestions("Bar", "name")').match(/value="Gin London Dry"/g) || []).length, 1);
  assert.equal((app.run('wasteSuggestions("Bar", "obs")').match(/value="Quebrou"/g) || []).length, 1);
  assert.match(app.run('wasteSuggestions("Bar", "name")'), /&lt;Suco &amp; &quot;chá&quot;&gt;/);
  assert.doesNotMatch(app.run("V.waste()"), /<img src=x/);
  assert.match(app.run("V.waste()"), /Limão/);
});

test("waste filter separates sectors and sector changes refresh suggestions without losing quantity", () => {
  const app = setup();
  app.run('S.sectors.push("Cozinha")');
  fillWaste(app, { name: "Molho", sec: "Cozinha", obs: "Preparo excedente" });
  app.run("A.waste()");
  fillWaste(app);
  app.run("A.waste()");
  app.run('A.filterWaste("Bar")');
  assert.match(app.run("V.waste()"), /Gin London Dry/);
  assert.doesNotMatch(app.run("V.waste()"), /value="Molho"|Preparo excedente/);
  app.run('A.filterWaste("Cozinha")');
  const markup = app.run("V.waste()");
  assert.match(markup, /value="Cozinha" selected/);
  assert.match(markup, /value="Molho"/);
  assert.doesNotMatch(markup, /Garrafa quebrada|Gin London Dry/);
  app.node("#wsec").value = "Bar";
  app.node("#wq").value = "3";
  app.run("A.wasteSector()");
  assert.equal(app.node("#wi").value, "");
  assert.equal(app.node("#wo").value, "");
  assert.equal(app.node("#wq").value, "3");
  assert.match(app.node("#waste-item-options").innerHTML, /Gin London Dry/);
  app.run('A.filterWaste("")');
  assert.match(app.run("V.waste()"), /Molho/);
  assert.match(app.run("V.waste()"), /Gin London Dry/);
});

test("waste history and suggestions respect employee sector even with a stale filter", () => {
  const app = setup();
  app.run('S.uid = "u1"; S.wasteFilter = "Hortifruti"');
  assert.doesNotMatch(app.run("V.waste()"), /Hortifruti|Limão/);
  fillWaste(app, { name: "Limão", sec: "Hortifruti" });
  const before = app.state();
  app.run("A.waste()");
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /setor autorizado/);
  app.run('A.filterWaste("Hortifruti")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[1], /Setor não autorizado/);
  app.run('S.uid = "u2"');
  fillWaste(app);
  app.run("A.waste()");
  assert.match(app.messages[2], /Sem permissão/);
});

test("waste rejects blank names, invalid quantities and inactive items without mutations", () => {
  const app = setup();
  for (const fields of [
    { name: " " }, { q: "" }, { q: "0" }, { q: "-1" }, { q: "Infinity" }, { q: "abc" },
  ]) {
    fillWaste(app, fields);
    const before = app.state();
    app.run("A.waste()");
    assert.deepEqual(app.state(), before);
  }
  app.run('item("gin").on = 0');
  fillWaste(app);
  const before = app.state();
  app.run("A.waste()");
  assert.deepEqual(app.state(), before);
  assert.match(app.messages.at(-1), /inativo/);
  assert.doesNotMatch(app.run('wasteSuggestions("Bar", "name")'), /Gin London Dry/);
});

test("waste storage failure reports the error and does not change stock or history", () => {
  const app = setup();
  fillWaste(app);
  const before = app.state();
  app.context.localStorage.setItem = () => { throw Error("Sem espaço"); };
  app.run("A.waste()");
  assert.deepEqual(app.state(), before);
  assert.deepEqual(app.messages, ["Sem espaço"]);
});

test("new waste names follow sector renaming and deletion", () => {
  const app = setup();
  fillWaste(app, { name: "Suco preparado" });
  app.run('A.waste(); A.filterWaste("Bar")');
  app.node("#sector-0").value = "Bar principal";
  app.run("A.renameSector(0)");
  assert.equal(app.state().wasteFilter, "Bar principal");
  assert.match(app.run('wasteSuggestions("Bar principal", "name")'), /Suco preparado/);
  app.run('A.deleteSector(0, "Bar principal", true)');
  assert.equal(app.state().wasteFilter, "");
  assert.equal(app.state().w.some((w) => w.name === "Suco preparado"), false);
  assert.doesNotMatch(app.run("V.waste()"), /Suco preparado/);
});

test("empty workspace explains why waste registration is disabled", () => {
  const app = setup({ empty: true });
  assert.match(app.run("V.waste()"), /disabled>Registrar/);
  assert.match(app.run("V.waste()"), /Cadastre um setor/);
  fillWaste(app);
  app.run("A.waste()");
  assert.equal(app.state().w.length, 0);
  assert.match(app.messages[0], /setor autorizado/);
});

test("startup clears legacy demo data and leaves an empty administrator workspace", () => {
  const app = setup({ empty: true, legacyData: true });
  const state = app.state();
  assert.deepEqual(state.sectors, []);
  assert.deepEqual(state.s, []);
  assert.deepEqual(state.i, []);
  assert.deepEqual(state.cs, {});
  assert.deepEqual(state.w, []);
  assert.deepEqual(state.qt, []);
  assert.deepEqual(state.o, []);
  assert.deepEqual(state.notes, []);
  assert.deepEqual(state.u, [{ id: "admin", name: "Administrador", role: "admin" }]);
  assert.equal(app.storage.has("zippy-controle-v1"), false);
  assert.match(app.run("cadViews.items()"), /Adicionar itens/);
});

test("cadastros no longer exposes a button to clear all data", () => {
  const app = setup();
  assert.doesNotMatch(app.run("V.cad()"), /Limpar todos os dados cadastrados/);
  assert.equal(app.run("typeof A.reset"), "undefined");
});

test("empty workspace can create a sector, supplier and first item", () => {
  const app = setup({ empty: true });
  app.run("A.openRegistrationBatch('sectors')");
  app.node("#sector-name").value = "Cozinha";
  app.run("A.newSector()");
  app.run("A.saveRegistrationBatch()");
  app.node("#s-name").value = "Fornecedor teste";
  app.node("#s-ct").value = "11999990000";
  app.node("#s-ld").value = "2";
  app.run("A.newSup()");
  app.run("A.saveSupplierBatch()");
  app.run("A.openRegistrationBatch('items')");
  app.node("#n-name").value = "Item teste";
  app.node("#n-sec").value = "Cozinha";
  app.node("#n-cat").value = "Geral";
  app.node("#n-un").value = "unidade";
  app.node("#n-bu").value = "caixa";
  app.node("#n-cv").value = "1";
  app.node("#n-min").value = "0";
  app.node("#n-ide").value = "0";
  app.node("#n-sup").value = app.state().s[0].id;
  app.node("#n-st").value = "0";
  app.run("A.newItem()");
  app.run("A.saveRegistrationBatch()");
  assert.equal(app.state().i.length, 1);
  assert.equal(app.state().i[0].name, "Item teste");
  assert.equal(app.state().i[0].sector, "Cozinha");
  app.run("A.openRegistrationBatch('items')");
  assert.match(app.node("#count-unit-options").innerHTML, /value="unidade"/);
  assert.match(app.node("#buy-unit-options").innerHTML, /value="caixa"/);
});

test("supplier batch queues multiple suppliers without writing until save", () => {
  const app = setup();
  const before = app.state();
  const storedBefore = [...app.storage.entries()];
  app.run("A.openSupplierBatch()");
  assert.equal(app.node("#new-suppliers-dialog").open, true);
  assert.equal(app.node("#supplier-batch-save").disabled, true);
  for (const name of ["Fornecedor A", "Fornecedor B"]) {
    app.node("#s-name").value = name;
    app.node("#s-ct").value = "11999990000";
    app.node("#s-ld").value = "3";
    app.run("A.newSup()");
    assert.equal(app.node("#s-name").value, "");
    assert.equal(app.node("#s-ct").value, "");
    assert.equal(app.node("#s-ld").value, "2");
  }
  assert.deepEqual(app.state(), before);
  assert.deepEqual([...app.storage.entries()], storedBefore);
  assert.equal(app.run("supplierBatch.length"), 2);
  assert.equal(app.node("#supplier-batch-save").disabled, false);
  app.run("A.saveSupplierBatch()");
  const after = app.state();
  assert.deepEqual(after.s.slice(-2).map((supplier) => supplier.name), ["Fornecedor A", "Fornecedor B"]);
  assert.equal(new Set(after.s.map((supplier) => supplier.id)).size, after.s.length);
  assert.ok(after.s.slice(-2).every((supplier) => supplier.contact === "(11) 99999-0000"));
  assert.deepEqual(JSON.parse(app.storage.get("zippy-controle-v2")), after);
  assert.equal(app.node("#new-suppliers-dialog").open, false);
  assert.equal(app.run("supplierBatch.length"), 0);
  for (const key of ["i", "o", "qt", "w", "cs"]) assert.deepEqual(after[key], before[key]);
  assert.deepEqual(app.messages, []);
});

function fillRegistrationItem(app, name) {
  for (const [field, value] of Object.entries({
    name, sec: "Bar", cat: "Bebidas", un: "garrafa", bu: "caixa", cv: "6",
    min: "1", ide: "12", sup: "s1", st: "3",
  })) app.node("#n-" + field).value = value;
}

test("registration screens show buttons instead of inclusion forms", () => {
  const app = setup();
  assert.doesNotMatch(app.run("cadViews.sectors()"), /id="sector-name"/);
  assert.doesNotMatch(app.run("cadViews.items()"), /id="n-name"|id="import-sector"|type="file"/);
  assert.match(app.run("cadViews.items()"), /A\.openItemImport/);
  app.run("A.openItemImport()");
  assert.equal(app.node("#item-import-dialog").open, true);
  assert.match(app.node("#item-import-content").innerHTML, /type="file"/);
  app.run("A.cancelItemImport()");
  assert.equal(app.node("#item-import-dialog").open, false);
});

test("sector modal queues and removes entries without persisting until final save", () => {
  const app = setup();
  const before = app.state();
  const storageBefore = [...app.storage.entries()];
  app.run("A.openRegistrationBatch('sectors')");
  for (const name of ["Cozinha", "Limpeza"]) {
    app.node("#sector-name").value = name;
    app.run("A.addRegistrationEntry()");
    assert.equal(app.node("#sector-name").value, "");
  }
  assert.deepEqual(app.state(), before);
  assert.deepEqual([...app.storage.entries()], storageBefore);
  app.run("A.removeRegistrationEntry(1)");
  app.run("A.saveRegistrationBatch()");
  assert.deepEqual(app.state().sectors, [...before.sectors, "Cozinha"]);
  assert.equal(app.node("#registration-dialog").open, false);
  assert.deepEqual(JSON.parse(app.storage.get("zippy-controle-v2")), app.state());
});

test("sector modal rejects blank and duplicate entries and confirms cancellation", () => {
  const app = setup();
  app.run("A.openRegistrationBatch('sectors')");
  app.run("A.newSector()");
  assert.match(app.messages.pop(), /Informe o nome/);
  app.node("#sector-name").value = " bar ";
  app.run("A.newSector()");
  assert.match(app.messages.pop(), /Já existe/);
  app.node("#sector-name").value = "Cozinha";
  app.run("A.newSector()");
  app.node("#sector-name").value = "COZINHA";
  app.run("A.newSector()");
  assert.match(app.messages.pop(), /já está na lista/);
  app.context.confirm = () => false;
  app.run("A.closeRegistrationBatch()");
  assert.equal(app.run("registrationBatch.length"), 1);
  assert.equal(app.node("#registration-dialog").open, true);
  app.context.confirm = () => true;
  app.run("A.closeRegistrationBatch()");
  assert.equal(app.run("registrationBatch.length"), 0);
  assert.equal(app.state().sectors.length, 3);
});

test("item modal clears fields, saves a batch with unique IDs and preserves history", () => {
  const app = setup();
  const before = app.state();
  app.run("A.openRegistrationBatch('items')");
  for (const name of ["Água", "Suco"]) {
    fillRegistrationItem(app, name);
    app.run("A.addRegistrationEntry()");
    assert.equal(app.node("#n-name").value, "");
    assert.equal(app.node("#n-cv").value, "1");
    assert.equal(app.node("#n-st").value, "0");
  }
  assert.deepEqual(app.state(), before);
  app.run("A.saveRegistrationBatch()");
  const state = app.state();
  assert.deepEqual(state.i.slice(-2).map((item) => item.name), ["Água", "Suco"]);
  assert.equal(state.i.at(-1).conv, 6);
  assert.notEqual(state.i.at(-1).id, state.i.at(-2).id);
  assert.equal(app.run("registrationBatch.length"), 0);
  assert.equal(app.node("#registration-dialog").open, false);
  for (const key of ["o", "qt", "cs", "w"]) assert.deepEqual(state[key], before[key]);
  assert.deepEqual(app.messages, []);
});

test("registration batches preserve drafts on storage failure and reject unsaved fields", () => {
  for (const kind of ["sectors", "items"]) {
    const app = setup();
    app.run(`A.openRegistrationBatch("${kind}")`);
    if (kind == "items") fillRegistrationItem(app, "Novo");
    else app.node("#sector-name").value = "Novo";
    app.run("A.addRegistrationEntry()");
    const nameSelector = kind == "items" ? "#n-name" : "#sector-name";
    app.node(nameSelector).value = "Pendente";
    app.run("A.saveRegistrationBatch()");
    assert.match(app.messages.pop(), /Há dados nos campos/);
    app.node(nameSelector).value = "";
    const before = app.state();
    const originalSet = app.context.localStorage.setItem;
    app.context.localStorage.setItem = () => { throw Error("Sem espaço"); };
    app.run("A.saveRegistrationBatch()");
    assert.match(app.messages.pop(), /Sem espaço/);
    assert.deepEqual(app.state(), before);
    assert.equal(app.run("registrationBatch.length"), 1);
    assert.equal(app.node("#registration-dialog").open, true);
    app.context.localStorage.setItem = originalSet;
    app.run("A.saveRegistrationBatch()");
    assert.equal(app.run("registrationBatch.length"), 0);
  }
});

test("item modal validates numeric values, duplicate items and stale suppliers", () => {
  const app = setup();
  app.run("A.openRegistrationBatch('items')");
  fillRegistrationItem(app, "Novo");
  app.node("#n-st").value = "-1";
  app.run("A.newItem()");
  assert.match(app.messages.pop(), /iguais ou maiores que zero/);
  fillRegistrationItem(app, "Gin London Dry");
  app.run("A.newItem()");
  assert.match(app.messages.pop(), /Já existe um item/);
  fillRegistrationItem(app, "Novo");
  app.run("A.newItem()");
  fillRegistrationItem(app, "Novo");
  app.run("A.newItem()");
  assert.match(app.messages.pop(), /Já existe um item/);
  app.node("#registration-form").reset();
  app.run("S.s[0].on = 0");
  const before = app.state();
  app.run("A.saveRegistrationBatch()");
  assert.match(app.messages.pop(), /fornecedor ativo/);
  assert.deepEqual(app.state(), before);
});

test("registration and import modals require administrator permissions", () => {
  const app = setup();
  app.run('S.uid = "u1"');
  const before = app.state();
  for (const action of [
    "A.openRegistrationBatch('sectors')", "A.openRegistrationBatch('items')",
    "A.newSector()", "A.newItem()", "A.saveRegistrationBatch()", "A.openItemImport()",
  ]) {
    app.run(action);
    assert.match(app.messages.pop(), /Sem permissão/);
  }
  assert.deepEqual(app.state(), before);
});

test("import modal preserves preview on cancellation refusal and storage failure", () => {
  const app = setup();
  app.run("A.openItemImport()");
  app.run(`itemImportDraft = prepareItemImport([["Item"], ["Água"]], "Bar", "")`);
  app.context.confirm = () => false;
  app.run("A.cancelItemImport()");
  assert.equal(app.node("#item-import-dialog").open, true);
  const before = app.state();
  app.context.localStorage.setItem = () => { throw Error("Sem espaço"); };
  app.run("A.applyItemImport()");
  assert.deepEqual(app.state(), before);
  assert.equal(app.run("itemImportDraft.valid.length"), 1);
  assert.equal(app.node("#item-import-dialog").open, true);
  assert.match(app.messages.pop(), /Sem espaço/);
  app.context.confirm = () => true;
  app.run("A.cancelItemImport()");
  assert.equal(app.run("itemImportDraft"), null);
});

test("supplier batch validates fields and prevents existing and queued duplicates", () => {
  const app = setup();
  app.run("A.openSupplierBatch()");
  app.run("A.newSup()");
  assert.match(app.messages.pop(), /Informe o nome/);
  app.node("#s-name").value = "Novo";
  for (const lead of ["", "-1", "1.5", "Infinity"]) {
    app.node("#s-ld").value = lead;
    app.run("A.newSup()");
    assert.match(app.messages.pop(), /prazo habitual/);
  }
  app.node("#s-ld").value = "0";
  app.node("#s-name").value = " adega central (DEMO) ";
  app.run("A.newSup()");
  assert.match(app.messages.pop(), /Já existe/);
  app.node("#s-name").value = "Novo";
  app.node("#s-ct").value = "11999990000";
  app.run("A.newSup()");
  app.node("#s-name").value = " NOVO ";
  app.run("A.newSup()");
  assert.match(app.messages.pop(), /já está na lista/);
  assert.equal(app.run("supplierBatch.length"), 1);
  assert.equal(app.state().s.length, 3);
});

test("supplier batch supports removal and cancellation with discard confirmation", () => {
  const app = setup();
  app.run("A.openSupplierBatch()");
  app.node("#s-name").value = "Novo";
  app.node("#s-ct").value = "11999990000";
  app.run("A.newSup()");
  app.run("A.removeSupplierFromBatch(0)");
  assert.equal(app.run("supplierBatch.length"), 0);
  assert.equal(app.node("#supplier-batch-save").disabled, true);
  app.node("#s-name").value = "Outro";
  app.node("#s-ct").value = "11999990000";
  app.run("A.newSup()");
  app.context.confirm = () => false;
  app.run("A.closeSupplierBatch()");
  assert.equal(app.node("#new-suppliers-dialog").open, true);
  assert.equal(app.run("supplierBatch.length"), 1);
  app.context.confirm = () => true;
  app.run("A.closeSupplierBatch()");
  assert.equal(app.node("#new-suppliers-dialog").open, false);
  assert.equal(app.run("supplierBatch.length"), 0);
  assert.equal(app.state().s.length, 3);
});

test("supplier cellphone mask formats digits, partial input and pasted punctuation", () => {
  const app = setup();
  for (const [input, expected] of [
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["1198765", "(11) 98765"],
    ["11987654", "(11) 98765-4"],
    ["11987654321", "(11) 98765-4321"],
    ["(11) 98765-4321", "(11) 98765-4321"],
  ]) {
    assert.equal(app.run(`formatSupplierPhone(${JSON.stringify(input)})`), expected);
  }
  for (const id of ["s-ct", "edit-supplier-contact"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*type="tel"[^>]*required[^>]*oninput=`));
  }
});

test("supplier creation and editing require a name and a valid cellphone", () => {
  const app = setup();
  const before = app.state();
  app.run("A.openSupplierBatch()");
  app.node("#s-name").value = "Novo";
  app.run('A.editSupplier("s1")');
  app.node("#edit-supplier-lead").value = "2";
  for (const phone of ["", "contato", "1198765", "1187654321", "119876543210", "01987654321"]) {
    app.node("#s-ct").value = phone;
    app.run("A.newSup()");
    assert.match(app.messages.pop(), /celular válido com DDD/);
    app.node("#edit-supplier-contact").value = phone;
    app.run('A.updateSupplier("s1")');
    assert.match(app.messages.pop(), /celular válido com DDD/);
    assert.equal(app.run("supplierBatch.length"), 0);
    assert.deepEqual(app.state(), before);
  }
});

test("supplier save revalidates the entire batch before persisting", () => {
  const app = setup();
  app.run("A.openSupplierBatch()");
  const before = app.state();
  for (const supplier of [
    { name: "", contact: "11987654321" },
    { name: "Novo", contact: "" },
  ]) {
    app.run(`supplierBatch = [${JSON.stringify({ ...supplier, lead: 2 })}]`);
    app.run("A.saveSupplierBatch()");
    assert.match(app.messages.pop(), /Informe o nome|celular válido/);
    assert.deepEqual(app.state(), before);
    assert.equal(app.run("supplierBatch.length"), 1);
  }
});

test("supplier batch preserves state and draft on storage failure and can retry", () => {
  const app = setup();
  app.run("A.openSupplierBatch()");
  app.node("#s-name").value = "Novo";
  app.node("#s-ct").value = "11999990000";
  app.run("A.newSup()");
  const before = app.state();
  const setItem = app.context.localStorage.setItem;
  app.context.localStorage.setItem = () => { throw Error("Armazenamento indisponível"); };
  app.run("A.saveSupplierBatch()");
  assert.deepEqual(app.state(), before);
  assert.equal(app.run("supplierBatch.length"), 1);
  assert.equal(app.node("#new-suppliers-dialog").open, true);
  assert.deepEqual(app.messages, ["Armazenamento indisponível"]);
  app.context.localStorage.setItem = setItem;
  app.run("A.saveSupplierBatch()");
  assert.equal(app.state().s.length, 4);
});

test("supplier batch rejects unsaved fields, empty saves and names registered after queuing", () => {
  const app = setup();
  app.run("A.openSupplierBatch()");
  app.run("A.saveSupplierBatch()");
  assert.match(app.messages.pop(), /pelo menos um/);
  app.node("#s-name").value = "Novo";
  app.node("#s-ct").value = "11999990000";
  app.run("A.newSup()");
  app.node("#s-name").value = "Pendente";
  app.run("A.saveSupplierBatch()");
  assert.match(app.messages.pop(), /Há dados nos campos/);
  app.node("#s-name").value = "";
  app.run('S.s.push({id:"external",name:"Novo",lead:2,on:1})');
  app.run("A.saveSupplierBatch()");
  assert.match(app.messages.pop(), /Já existe/);
  assert.equal(app.run("supplierBatch.length"), 1);
});

test("supplier batch escapes draft markup and enforces administrator permissions", () => {
  const app = setup();
  app.run("A.openSupplierBatch()");
  app.node("#s-name").value = '<img src=x onerror="alert(1)">';
  app.node("#s-ct").value = "11999990000";
  app.run("A.newSup()");
  assert.doesNotMatch(app.node("#supplier-batch-list").innerHTML, /<img/);
  assert.match(app.node("#supplier-batch-list").innerHTML, /&lt;img/);
  app.run('S.uid = "u4"');
  const before = app.state();
  for (const action of ["A.openSupplierBatch()", "A.newSup()", "A.removeSupplierFromBatch(0)", "A.saveSupplierBatch()"]) {
    app.run(action);
    assert.match(app.messages.pop(), /Sem permissão/);
  }
  assert.deepEqual(app.state(), before);
  assert.doesNotMatch(app.run("V.sup()"), /A\.openSupplierBatch/);
  app.run('S.uid = "u5"');
  assert.match(app.run("V.sup()"), /A\.openSupplierBatch/);
  assert.match(app.run("cadViews.suppliers()"), /A\.openSupplierBatch/);
});

test("saved item units are reusable suggestions and duplicates are listed once", () => {
  const app = setup();
  app.run('S.i.push({id:"second",unit:"GARRAFA",bu:"caixa (12)",deleted:true})');
  const form = app.run("itemRegistrationForm()");
  assert.match(form, /<input id="n-un" list="count-unit-options"/);
  assert.match(form, /<input id="n-bu" list="buy-unit-options"/);
  assert.equal((app.run('unitOptions("unit")').match(/value="garrafa"/g) || []).length, 1);
  assert.equal((app.run('unitOptions("bu")').match(/value="caixa \(12\)"/g) || []).length, 1);
});

test("item creation requires an existing supplier", () => {
  const app = setup({ empty: true });
  app.run('S.sectors.push("Cozinha")');
  app.node("#n-name").value = "Item teste";
  app.node("#n-sec").value = "Cozinha";
  app.node("#n-un").value = "unidade";
  app.node("#n-bu").value = "caixa";
  app.node("#n-cv").value = "1";
  for (const field of ["min", "ide", "st"]) app.node("#n-" + field).value = "0";
  app.node("#n-sup").value = "";
  app.run("A.newItem()");
  assert.equal(app.state().i.length, 0);
  assert.match(app.messages[0], /fornecedor ativo/);
});

test("item import parses quoted CSV, Portuguese numbers, duplicate rows and invalid sectors", () => {
  const app = setup();
  const rows = app.run(`parseDelimitedText(
    "\\uFEFFProduto;Setor;Categoria;Unidade de contagem;Saldo inicial;Mínimo;Ideal\\r\\n" +
    "\\"Água; com gás\\";Bar;Bebidas;garrafa;1,5;1;2\\r\\n" +
    "\\"Água; com gás\\";Bar;Bebidas;garrafa;0;0;0\\r\\n" +
    "Gin London Dry;Bar;Destilados;garrafa;1;0;0\\r\\n" +
    "Leite;Setor inexistente;Laticínios;litro;1;0;0\\r\\n" +
    "Farinha;Bar;Mercearia;kg;-1;0;0"
  )`);
  const preview = app.run(`prepareItemImport(${JSON.stringify(rows)}, "", "s1")`);
  assert.equal(preview.valid.length, 1);
  assert.deepEqual(
    { name: preview.valid[0].name, stock: preview.valid[0].stock, unit: preview.valid[0].unit },
    { name: "Água; com gás", stock: 1.5, unit: "garrafa" },
  );
  assert.equal(preview.duplicates.length, 2);
  assert.equal(preview.invalid.length, 2);
  assert.match(preview.invalid[0].reason, /Setor .* não cadastrado/);
  assert.match(preview.invalid[1].reason, /Saldo inválido/);
});

test("CSV upload creates a preview using the selected sector and supplier", async () => {
  const app = setup();
  app.node("#import-sector").value = "Bar";
  app.node("#import-supplier").value = "s1";
  await app.run(`A.readItemImport({
    name: "contagem.csv",
    text: async () => "Produto;Categoria;Unidade\\r\\nÁgua;Bebidas;garrafa"
  })`);
  assert.equal(app.run("itemImportDraft.valid.length"), 1);
  assert.equal(app.run("itemImportDraft.valid[0].name"), "Água");
  assert.equal(app.run("itemImportDraft.valid[0].sector"), "Bar");
  assert.deepEqual(app.messages, []);
});

test("item import uses defaults and commits valid items without duplicate IDs", () => {
  const app = setup();
  app.node("#import-sector").value = "Bar";
  app.node("#import-supplier").value = "";
  app.run(`itemImportRows = [["Item"], ["Água"], ["Farinha"]]`);
  app.run(`itemImportDraft = prepareItemImport(itemImportRows, "Bar", "")`);
  assert.equal(app.run("itemImportDraft.valid.length"), 2);
  app.node("#import-supplier").value = "s1";
  app.run("A.updateItemImportOptions()");
  assert.equal(app.run("itemImportDraft.valid.length"), 2);
  app.run("A.applyItemImport()");
  const added = app.state().i.slice(-2);
  assert.equal(added[0].sector, "Bar");
  assert.equal(added[0].cat, "Geral");
  assert.equal(added[0].unit, "unidade");
  assert.equal(added[0].bu, "unidade");
  assert.equal(added[0].conv, 1);
  assert.equal(added[0].sup, "s1");
  assert.notEqual(added[0].id, added[1].id);
  assert.equal(app.run("itemImportDraft"), null);
  assert.match(app.state().log[0].m, /2 item\(ns\) importado\(s\)/);
});

test("count-sheet imports work without a supplier and imported items remain editable", () => {
  const app = setup();
  app.run("S.s = []");
  const markup = app.run("itemImportForm()");
  assert.match(markup, /Fornecedor principal \(opcional\)/);
  assert.match(markup, /type="file" accept="\.xlsx,\.xls,\.csv,\.tsv"/);
  assert.doesNotMatch(markup, /type="file"[^>]*disabled/);

  app.run(`itemImportDraft = prepareItemImport([["Item"], ["Água"]], "Bar", "")`);
  assert.equal(app.run("itemImportDraft.valid.length"), 1);
  app.run("A.applyItemImport()");
  const imported = app.state().i.at(-1);
  assert.equal(imported.sup, "");
  app.run(`A.editItem("${imported.id}")`);
  assert.match(app.node("#edit-item-supplier").innerHTML, /Sem fornecedor definido/);
  for (const [field, value] of Object.entries({
    "#edit-item-name": imported.name,
    "#edit-item-sector": imported.sector,
    "#edit-item-category": imported.cat,
    "#edit-item-unit": imported.unit,
    "#edit-item-buy-unit": imported.bu,
    "#edit-item-conversion": String(imported.conv),
    "#edit-item-minimum": String(imported.min),
    "#edit-item-ideal": String(imported.ideal),
    "#edit-item-stock": String(imported.stock),
  })) app.node(field).value = value;
  app.run(`A.updateItem("${imported.id}")`);
  assert.equal(app.state().i.at(-1).sup, "");
  assert.deepEqual(app.messages, []);
});

test("item import is restricted to administrators and appears in the item catalog", () => {
  const app = setup();
  const markup = app.run("cadViews.items()");
  assert.match(markup, /Importar planilha de contagem/);
  const form = app.run("itemImportForm()");
  assert.match(form, /accept="\.xlsx,\.xls,\.csv,\.tsv"/);
  assert.match(form, /id="import-supplier" onchange="A\.updateItemImportOptions\(\)"/);
  assert.match(form, /Baixar modelo CSV/);
  app.run(`itemImportDraft = prepareItemImport([["Item"], ["Água"]], "Bar", "s1")`);
  app.run('S.uid = "u1"');
  app.run("A.applyItemImport()");
  assert.equal(app.state().i.length, 4);
  assert.match(app.messages[0], /Sem permissão/);
});

test("supplier management presents active and inactive suppliers as cards", () => {
  const app = setup();
  app.run('S.s[1].on = 0');
  const markup = app.run("cadViews.suppliers()");
  assert.match(markup, /supplier-card/);
  assert.match(markup, /Hortifruti Bom Preço \(demo\).*Inativo/);
  assert.match(markup, /2 ativo\(s\) · 1 inativo\(s\)/);
  assert.match(markup, /A\.editSupplier\('s1'\)/);
});

test("supplier editor closes on backdrop click without a close button", () => {
  const supplierDialog = html.match(/<dialog id="edit-supplier-dialog"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(supplierDialog);
  assert.match(supplierDialog, /onclick="if\(event\.target===this\)this\.close\(\)"/);
  assert.doesNotMatch(supplierDialog, />Fechar<\/button>/);
});

test("supplier edits update name, contact and lead time", () => {
  const app = setup();
  const before = app.state();
  app.run('A.editSupplier("s1")');
  assert.equal(app.node("#edit-supplier-name").value, before.s[0].name);
  assert.equal(app.node("#edit-supplier-contact").value, before.s[0].contact);
  assert.equal(app.node("#edit-supplier-lead").value, before.s[0].lead);
  app.node("#edit-supplier-name").value = "Adega Nova";
  app.node("#edit-supplier-contact").value = "11 99999-0000";
  app.node("#edit-supplier-lead").value = "4";
  app.run('A.updateSupplier("s1")');
  const state = app.state();
  assert.deepEqual(
    { name: state.s[0].name, contact: state.s[0].contact, lead: state.s[0].lead },
    { name: "Adega Nova", contact: "(11) 99999-0000", lead: 4 },
  );
  assert.equal(state.i.find((i) => i.id === "gin").sup, "s1");
  assert.match(state.log[0].m, /Fornecedor atualizado: Adega Central \(demo\) → Adega Nova/);
});

test("invalid supplier edits leave data unchanged", () => {
  const app = setup();
  const before = app.state();
  app.run('A.editSupplier("s1")');
  app.node("#edit-supplier-name").value = "";
  app.run('A.updateSupplier("s1")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /Informe o nome do fornecedor/);

  app.messages.length = 0;
  app.node("#edit-supplier-name").value = "Adega Central (demo)";
  app.node("#edit-supplier-lead").value = "-1";
  app.run('A.updateSupplier("s1")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /prazo habitual/);
});

test("inactive suppliers are unavailable for new items but can be reactivated", () => {
  const app = setup();
  app.run('A.toggleSupplier("s1")');
  let state = app.state();
  assert.equal(state.s.find((supplier) => supplier.id === "s1").on, 0);
  assert.doesNotMatch(app.run("itemRegistrationForm()"), /value="s1"/);
  assert.equal(state.i.find((i) => i.id === "gin").sup, "s1");
  app.run('A.editSupplier("s1")');
  assert.equal(app.node("#edit-supplier-toggle").textContent, "Ativar fornecedor");

  app.run('A.toggleSupplier("s1")');
  state = app.state();
  assert.equal(state.s.find((supplier) => supplier.id === "s1").on, 1);
  assert.match(app.run("itemRegistrationForm()"), /value="s1"/);
});

test("supplier deletion hides it from new registrations and preserves linked history", () => {
  const app = setup();
  const before = app.state();
  app.run('A.deleteSupplier("s1")');
  const state = app.state();
  assert.equal(state.s.find((supplier) => supplier.id === "s1").deleted, true);
  assert.equal(state.i.find((i) => i.id === "gin").sup, "s1");
  assert.deepEqual(state.o, before.o);
  assert.deepEqual(state.qt, before.qt);
  assert.doesNotMatch(app.run("cadViews.suppliers()"), /Adega Central/);
  assert.doesNotMatch(app.run("itemRegistrationForm()"), /value="s1"/);
});

test("only administrators can update or delete suppliers", () => {
  const app = setup();
  app.run('S.uid = "u1"');
  const before = app.state();
  app.run('A.toggleSupplier("s1")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /Sem permissão/);

  app.messages.length = 0;
  app.run('A.deleteSupplier("s1")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /Sem permissão/);
});

test("cancellation and wrong names never delete data", () => {
  for (const response of [null, "", "bar", " Bar "]) {
    const app = setup();
    const before = app.state();
    app.context.prompt = () => response;
    app.run("A.deleteSector(0, prompt(), true)");
    assert.deepEqual(app.state(), before);
    if (response !== null) assert.match(app.messages[0], /não corresponde/);
  }
});

test("final acknowledgement is required", () => {
  const app = setup();
  const before = app.state();
  app.context.confirm = () => false;
  app.run('A.deleteSector(0, "Bar", false)');
  assert.deepEqual(app.state(), before);
});

test("only administrators can delete sectors", () => {
  const app = setup();
  app.run('S.uid = "u1"');
  const before = app.state();
  app.run("A.deleteSector(0)");
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /Sem permissão/);
});

test("sector names autosave on blur and Enter without a save button", () => {
  const app = setup();
  const markup = app.run("cadViews.sectors()");
  assert.doesNotMatch(markup, /Salvar alteração/);
  assert.match(markup, /onblur="setTimeout\(\(\) => A\.renameSector\(0\), 0\)"/);
  assert.match(markup, /event\.key === 'Enter'/);

  app.node("#sector-0").value = "Bar principal";
  app.run("A.renameSector(0)");
  const state = app.state();
  assert.equal(state.sectors[0], "Bar principal");
  assert.equal(state.i.find((i) => i.id === "gin").sector, "Bar principal");
  assert.equal(state.u.find((u) => u.id === "u1").sector, "Bar principal");
  assert.ok(state.cs["Bar principal"]);
  assert.equal(state.cs.Bar, undefined);
});

test("deletion removes linked data, preserving other sectors and mixed orders", () => {
  const app = setup();
  app.run(`
    S.sec = "Bar"; S.f = "Bar"; S.cat = "Destilados";
    S.w.push({item: "gin", sec: "Bar"});
    S.o.push({
      id: "P-004", sup: "s1", st: "rascunho",
      items: [{id: "gin", q: 1, p: 100}, {id: "lim", q: 2, p: 70}], h: []
    });
    S.notes.push("P-001 (Adega): com divergência", "P-004 (Adega): parcial");
    LU = {id: "gin", prev: 3};
    A.deleteSector(0, "Bar", true);
  `);
  const state = app.state();
  assert.deepEqual(state.sectors, ["Hortifruti", "Estoque seco"]);
  assert.deepEqual(
    state.i.map((item) => item.id),
    ["lim", "gua"],
  );
  assert.equal(state.qt.length, 0);
  assert.equal(state.w.length, 1);
  assert.equal(state.w[0].item, "lim");
  assert.equal(state.cs.Bar, undefined);
  assert.equal(state.u.find((user) => user.id === "u1").sector, null);
  assert.equal(state.u.length, 5);
  assert.equal(
    state.o.some((order) => order.id === "P-001"),
    false,
  );
  assert.deepEqual(state.o.find((order) => order.id === "P-004").items, [
    { id: "lim", q: 2, p: 70 },
  ]);
  assert.deepEqual(state.notes, ["P-004 (Adega): parcial"]);
  assert.equal(state.sec, null);
  assert.equal(state.f, "");
  assert.equal(app.run("LU"), null);
  assert.equal(app.run("nextOrderId()"), "P-005");
  assert.equal(app.messages.length, 0);
});

test("storage errors are surfaced without changing the state", () => {
  const app = setup();
  const before = app.state();
  app.context.localStorage.setItem = () => {
    throw Error("Armazenamento indisponível");
  };
  app.run('A.deleteSector(0, "Bar", true)');
  assert.deepEqual(app.state(), before);
  assert.deepEqual(app.messages, ["Armazenamento indisponível"]);
});

test("all sectors can be deleted without leaving broken counting or item creation", () => {
  const app = setup();
  app.context.prompt = () => app.run("S.sectors[0]");
  app.run("while (S.sectors.length) A.deleteSector(0, prompt(), true)");
  assert.deepEqual(app.state().sectors, []);
  assert.equal(app.state().i.length, 0);
  assert.match(app.run("V.count()"), /Nenhum setor cadastrado/);
  app.run('S.uid = "u1"');
  assert.match(app.run("V.count()"), /sem setor/);
});

test("item editing allows deactivation and reactivation without changing historical data", () => {
  const app = setup();
  const before = app.state();
  app.run('A.on("gin")');
  assert.equal(app.run('items().some((i) => i.id === "gin")'), false);
  assert.match(app.run("cadViews.items()"), /Gin London Dry/);
  app.run('A.on("gin")');
  assert.equal(app.run('items().some((i) => i.id === "gin")'), true);
  const after = app.state();
  assert.deepEqual(after.i, before.i);
  for (const key of ["o", "qt", "w", "cs"]) assert.deepEqual(after[key], before[key]);
});

test("item editing loads and saves all catalog fields without changing history", () => {
  const app = setup();
  const before = app.state();
  app.run('A.editItem("gin")');
  assert.equal(app.node("#edit-item-name").value, "Gin London Dry");
  assert.match(app.node("#edit-item-sector").innerHTML, /Hortifruti/);
  assert.equal(app.node("#edit-item-unit").value, "garrafa");
  assert.equal(app.node("#edit-item-buy-unit").value, "caixa (6)");
  assert.equal(app.node("#edit-item-conversion").value, 6);
  assert.equal(app.node("#edit-item-supplier").value, "s1");

  app.node("#edit-item-name").value = "Gin London";
  app.node("#edit-item-sector").value = "Estoque seco";
  app.node("#edit-item-category").value = "Bebidas";
  app.node("#edit-item-unit").value = "unidade";
  app.node("#edit-item-buy-unit").value = "fardo";
  app.node("#edit-item-conversion").value = "8";
  app.node("#edit-item-minimum").value = "5";
  app.node("#edit-item-ideal").value = "15";
  app.node("#edit-item-supplier").value = "s2";
  app.node("#edit-item-stock").value = "7";
  app.run('A.updateItem("gin")');

  const after = app.state();
  assert.deepEqual(after.i.find((i) => i.id === "gin"), {
    ...before.i.find((i) => i.id === "gin"),
    name: "Gin London",
    sector: "Estoque seco",
    cat: "Bebidas",
    unit: "unidade",
    bu: "fardo",
    conv: 8,
    min: 5,
    ideal: 15,
    sup: "s2",
    stock: 7,
  });
  for (const key of ["o", "qt", "w", "cs"]) assert.deepEqual(after[key], before[key]);
  assert.match(after.log[0].m, /Cadastro atualizado: Gin London Dry → Gin London/);
});

test("invalid item edits and persistence failures leave the catalog unchanged", () => {
  const app = setup();
  const before = app.state();
  app.run('A.editItem("gin")');
  app.node("#edit-item-conversion").value = "";
  app.run('A.updateItem("gin")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /conversão deve ser maior que zero/);

  app.messages.length = 0;
  app.node("#edit-item-conversion").value = "6";
  app.node("#edit-item-ideal").value = "2";
  app.run('A.updateItem("gin")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /ideal não pode ser menor que o mínimo/);

  app.messages.length = 0;
  app.node("#edit-item-ideal").value = "12";
  app.context.localStorage.setItem = () => {
    throw Error("Armazenamento indisponível");
  };
  app.run('A.updateItem("gin")');
  assert.deepEqual(app.state(), before);
  assert.deepEqual(app.messages, ["Armazenamento indisponível"]);
});

test("item deletion hides the item but preserves purchases, quotes and past records", () => {
  const app = setup();
  const before = app.state();
  app.run('A.deleteItem("vod")');
  const after = app.state();
  assert.deepEqual(
    after.i.find((i) => i.id === "vod"),
    {
      ...before.i.find((i) => i.id === "vod"),
      deleted: true,
    },
  );
  for (const key of ["o", "qt", "w", "notes"]) assert.deepEqual(after[key], before[key]);
  assert.equal(app.run('nm("vod")'), "Vodka");
  assert.equal(app.run('items().some((i) => i.id === "vod")'), false);
  assert.doesNotMatch(app.run("cadViews.items()"), /Vodka/);
  assert.equal(after.cs.Bar.v.vod, undefined);
  assert.match(app.run("V.orders()"), /Vodka/);
  assert.match(app.run("V.deliv()"), /Vodka/);
  app.run('A.on("vod")');
  assert.match(app.messages[0], /Item não encontrado/);
});

test("item deletion requires administrator permission", () => {
  const app = setup();
  app.run('S.uid = "u1"');
  const before = app.state();
  app.run('A.deleteItem("gin")');
  assert.deepEqual(app.state(), before);
  assert.match(app.messages[0], /Sem permissão/);
});

test("failed item deletion persistence leaves the original state unchanged", () => {
  const app = setup();
  const before = app.state();
  app.context.localStorage.setItem = () => {
    throw Error("Armazenamento indisponível");
  };
  app.run('A.deleteItem("gin")');
  assert.deepEqual(app.state(), before);
  assert.deepEqual(app.messages, ["Armazenamento indisponível"]);
});
