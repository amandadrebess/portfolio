/* =====================================================================
   js/admin.js | Painel da Amanda. JavaScript puro, sem framework.
   Ordem do arquivo:
     1. Conferir a sessão (a PRIMEIRA coisa que acontece)
     2. Ajudantes (datas, dinheiro, erros, janelas, formulários)
     3. Dados (carregar do Supabase, sem quebrar se faltar tabela)
     4. As telas: Portfólio, Marcas, Calendário, Campanhas, Checklist
   ===================================================================== */
"use strict";

/* ---------------------------------------------------------------
   1. PRIMEIRA COISA: conferir a sessão.
   Sem sessão: vai para o login. A página só aparece depois disso.
   --------------------------------------------------------------- */
(async function conferirSessao() {
  if (!window.db) {
    mostrarFalha("Não consegui carregar o sistema do painel. Confira a internet e recarregue a página.");
    return;
  }
  let sessao = null;
  try {
    const r = await db.auth.getSession();
    sessao = r && r.data ? r.data.session : null;
  } catch (e) { sessao = null; }

  if (!sessao) { location.replace("../login/"); return; }

  /* Entrou com outra conta que não é a sua? Sai e volta para o login. */
  if (String(sessao.user.email || "").toLowerCase() !== BANCO.email.toLowerCase()) {
    try { await db.auth.signOut(); } catch (e) {}
    location.replace("../login/?motivo=conta");
    return;
  }
  document.documentElement.classList.remove("checando");
  iniciar(sessao.user);
})();

function mostrarFalha(texto) {
  document.documentElement.classList.remove("checando");
  document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">' + texto + "</p>";
}

/* ---------------------------------------------------------------
   2. AJUDANTES
   --------------------------------------------------------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = t => String(t === null || t === undefined ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const numero = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = v => moedaFmt.format(numero(v));

/* Texto da biblioteca pode ter <b> e <em>: deixo só essas duas marcas e escapo o resto. */
const htmlSeguro = t => esc(t).replace(/&lt;(\/?)(b|em)&gt;/g, "<$1$2>");

/* Ícones de traço (nenhum emoji no menu e nos botões). */
const ICONES = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V5M7 9l5-4 5 4M4 20h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
  link: '<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'
};
const CHEIOS = { grip: 1, star: 0 };
const ic = (nome, cheio) => '<svg class="ic' + (cheio || CHEIOS[nome] ? " cheio" : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONES[nome] + "</svg>";

/* Datas: guardo sempre como texto AAAA-MM-DD para não ter erro de fuso horário. */
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const hojeISO = () => iso(new Date());
const daISO = s => { const p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const diasEntre = (a, b) => Math.round((daISO(a) - daISO(b)) / 86400000);
const fmtData = s => (s && /^\d{4}-\d{2}-\d{2}/.test(s)) ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : "";
const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);

const slug = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pill = (classe, texto) => '<span class="pill p-' + slug(classe) + '">' + esc(texto) + "</span>"; /* prefixo p- evita conflito com outras classes da página */
const etiquetaExemplo = linha => linha && linha.exemplo ? '<span class="pill p-exemplo">exemplo</span>' : "";

/* Aviso rápido no pé da tela. */
let toastTimer = null;
function avisar(texto, tipo) {
  const t = $("#toast");
  t.textContent = texto;
  t.className = "mostra" + (tipo === "erro" ? " erro" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ""; }, tipo === "erro" ? 5000 : 2600);
}

/* Traduz erro do banco para português simples. */
function traduzirErro(err, tabela) {
  const cod = String((err && err.code) || ""), msg = String((err && err.message) || err || "");
  if (cod === "PGRST205" || cod === "42P01" || (/relation|table/i.test(msg) && /does not exist|could not find/i.test(msg)))
    return 'Não encontrei a tabela "' + tabela + '" no banco. Rode o arquivo banco.sql no Supabase (passo 1).';
  if (cod === "PGRST204" || cod === "42703" || (/column/i.test(msg) && /does not exist|could not find/i.test(msg)))
    return 'Falta uma coluna na tabela "' + tabela + '". Rode o banco.sql de novo no Supabase. Detalhe: ' + msg;
  if (cod === "42501" || /row-level security|permission denied/i.test(msg))
    return 'O banco não deixou acessar "' + tabela + '". Você entrou com o e-mail certo? Rode o banco.sql de novo.';
  if (cod === "23514") return "Algum campo tem um valor que o banco não aceita. Confira as opções escolhidas.";
  if (cod === "23502") return "Falta preencher um campo obrigatório.";
  if (/fetch|network|failed to/i.test(msg)) return "Sem conexão com o banco. Confira a internet.";
  return 'Não consegui completar (' + tabela + '): ' + msg;
}

/* ---- Janela (modal) ---- */
function abrirModal(titulo, corpoHtml, opcoes) {
  $("#modalTitulo").textContent = titulo;
  $("#modalCorpo").innerHTML = corpoHtml;
  $("#modal").classList.toggle("largo", !!(opcoes && opcoes.largo));
  $("#fundoModal").classList.add("aberto");
  const primeiro = $("#modalCorpo").querySelector("input:not([type=checkbox]),select,textarea");
  if (primeiro) setTimeout(() => primeiro.focus(), 30);
}
function fecharModal() {
  $("#fundoModal").classList.remove("aberto");
  $("#modalCorpo").innerHTML = "";
}

/* ---- Formulário genérico ----
   cfg.campos: lista de { k, rotulo, tipo, obrigatorio, opcoes, lista, dica, inteira }
   tipos: texto, email, tel, url, numero, data, select, area, caixa */
function campoHtml(c, valor) {
  const id = "f_" + c.k, cl = "campo" + (c.tipo === "caixa" ? " caixa" : "") + (c.inteira || c.tipo === "area" ? " inteira" : "");
  const dica = c.dica ? '<div class="dica-campo">' + esc(c.dica) + "</div>" : "";
  const rot = esc(c.rotulo) + (c.obrigatorio ? " *" : "");
  let campo = "";
  const v = valor === null || valor === undefined ? "" : valor;
  if (c.tipo === "select") {
    campo = '<select id="' + id + '" name="' + c.k + '">' + c.opcoes.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
  } else if (c.tipo === "area") {
    campo = '<textarea id="' + id + '" name="' + c.k + '">' + esc(v) + "</textarea>";
  } else if (c.tipo === "caixa") {
    return '<div class="' + cl + '"><label><input type="checkbox" id="' + id + '" name="' + c.k + '"' + (valor ? " checked" : "") + "> " + esc(c.rotulo) + "</label>" + dica + "</div>";
  } else {
    const tipoInput = { texto: "text", email: "email", tel: "tel", url: "url", numero: "text", data: "date" }[c.tipo] || "text";
    const lista = c.lista && c.lista.length ? ' list="dl_' + c.k + '"' : "";
    campo = '<input id="' + id + '" name="' + c.k + '" type="' + tipoInput + '"' + (c.tipo === "numero" ? ' inputmode="decimal"' : "") + lista + ' value="' + esc(v) + '" autocomplete="off">';
    if (lista) campo += '<datalist id="dl_' + c.k + '">' + c.lista.map(x => '<option value="' + esc(x) + '"></option>').join("") + "</datalist>";
  }
  return '<div class="' + cl + '"><label for="' + id + '">' + rot + "</label>" + campo + dica + "</div>";
}

function abrirForm(cfg) {
  const valores = cfg.valores || {};
  const html = '<form id="formModal" novalidate>' +
    (cfg.aviso ? '<p class="nota">' + esc(cfg.aviso) + "</p>" : "") +
    '<div class="grade-form">' + cfg.campos.map(c => campoHtml(c, valores[c.k])).join("") + "</div>" +
    '<p class="erro-form" id="erroForm" role="alert"></p>' +
    '<div class="rodape-modal">' +
    (cfg.onApagar ? '<button type="button" class="btn perigo" id="btnApagar">Apagar</button>' : "") +
    '<span class="espaco"></span><button type="button" class="btn" id="btnCancelar">Cancelar</button>' +
    '<button type="submit" class="btn amarelo" id="btnSalvar">' + esc(cfg.textoSalvar || "Salvar") + "</button></div></form>";
  abrirModal(cfg.titulo, html);
  const form = $("#formModal"), erro = $("#erroForm");
  $("#btnCancelar").addEventListener("click", fecharModal);
  if (cfg.onApagar) {
    $("#btnApagar").addEventListener("click", async () => {
      if (!confirm("Apagar de verdade? Não dá para desfazer.")) return;
      try { await cfg.onApagar(); fecharModal(); } catch (e) { erro.textContent = e.message; }
    });
  }
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    erro.textContent = "";
    const dados = {};
    for (const c of cfg.campos) {
      const el = form.elements[c.k];
      let v;
      if (c.tipo === "caixa") v = el.checked;
      else if (c.tipo === "numero") { let bruto = String(el.value).trim(); if (bruto.indexOf(",") > -1) bruto = bruto.replace(/\./g, "").replace(",", "."); /* 1.500,50 vira 1500.50; 1500.50 fica como está */ v = bruto === "" ? 0 : Number(bruto); if (!isFinite(v)) { erro.textContent = "Escreva só números em: " + c.rotulo; return; } }
      else { v = String(el.value).trim(); if (v === "") v = null; }
      if (c.obrigatorio && (v === null || v === "")) { erro.textContent = "Preencha: " + c.rotulo; el.focus(); return; }
      if (c.tipo === "url" && v && !/^https?:\/\//i.test(v)) { erro.textContent = "O link precisa começar com http:// ou https://"; el.focus(); return; }
      dados[c.k] = v;
    }
    const botao = $("#btnSalvar"); botao.disabled = true;
    try { await cfg.onSalvar(dados); fecharModal(); }
    catch (e) { erro.textContent = e.message || "Não consegui salvar."; botao.disabled = false; }
  });
}

/* ---- CSV que abre certinho no Excel (com acento): separador ";" e marca de codificação ---- */
function csvCelula(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = " " + s; // evita que o Excel trate texto como fórmula
  return '"' + s.replace(/"/g, '""') + '"';
}
function baixarCSV(nome, cabecalho, linhas) {
  const texto = "﻿" + [cabecalho].concat(linhas).map(l => l.map(csvCelula).join(";")).join("\r\n");
  const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/* ---------------------------------------------------------------
   3. DADOS
   --------------------------------------------------------------- */
const estado = {
  aba: "portfolio", videos: [], marcas: [], cupons: [], calendario: [], campanhas: [], marcados: {}, visitas: [],
  problemas: {} /* tabela -> aviso. Se faltar tabela ou campo, o painel avisa e segue funcionando. */
};
const ui = {
  vBusca: "", cupBusca: "", cupFiltro: "ativos", mBusca: "", mFiltro: "todas", mNicho: "todos", cBusca: "", cFiltro: "todas", cOrdem: { col: "prazo", dir: 1 },
  calFiltro: "todos", cal: { ano: new Date().getFullYear(), mes: new Date().getMonth() },
  cl: { sub: "checklist", abertos: {}, estilo: "todos", aud: "todas" }, revisao: {}
};
const FUNIL = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];
const SITUACOES = [["lead", "Lead"], ["conversando", "Conversando"], ["cliente", "Cliente"], ["parada", "Parada"]];
const TIPOS_CAL = [["gravar", "Gravar"], ["editar", "Editar"], ["postar", "Postar"]];

async function buscar(tabela, consulta) {
  try {
    const r = await consulta;
    if (r.error) { estado.problemas[tabela] = traduzirErro(r.error, tabela); return []; }
    delete estado.problemas[tabela];
    return r.data || [];
  } catch (e) {
    estado.problemas[tabela] = 'Não consegui falar com o banco (' + tabela + "). Confira a internet.";
    return [];
  }
}

async function carregar(quais) {
  const lista = quais || ["videos", "marcas", "cupons", "calendario", "campanhas", "marcados", "visitas"];
  await Promise.all(lista.map(async nome => {
    if (nome === "videos") estado.videos = await buscar("videos", db.from("videos").select("*").order("ordem", { ascending: true }).order("criado_em", { ascending: true }));
    if (nome === "marcas") estado.marcas = await buscar("marcas", db.from("marcas").select("*").order("criado_em", { ascending: false }));
    if (nome === "calendario") estado.calendario = await buscar("calendario", db.from("calendario").select("*").order("data", { ascending: true }));
    if (nome === "campanhas") estado.campanhas = await buscar("campanhas", db.from("campanhas").select("*").order("criado_em", { ascending: false }));
    if (nome === "cupons") estado.cupons = await buscar("cupons", db.from("cupons").select("*").order("criado_em", { ascending: false }));
    if (nome === "marcados") {
      const linhas = await buscar("marcados", db.from("marcados").select("chave,marcado"));
      estado.marcados = {}; linhas.forEach(l => { if (l.marcado) estado.marcados[l.chave] = true; });
    }
    if (nome === "visitas") {
      const h = new Date(); const desde = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 13);
      estado.visitas = await buscar("visitas", db.from("visitas").select("data,pagina,origem").gte("data", desde.toISOString()).order("data", { ascending: false }).limit(5000));
    }
  }));
}

/* Grava (cria ou edita) e devolve erro em português se algo der errado. */
async function gravar(tabela, id, valores) {
  const dados = Object.assign({}, valores, { exemplo: false }); // ao editar, deixa de ser "exemplo"
  if (tabela === "marcas" && !dados.nicho && estado.marcas.length && !("nicho" in estado.marcas[0])) delete dados.nicho; // banco ainda sem a coluna nicho: segue salvando
  if (tabela === "campanhas" && "qtd" in dados) dados.qtd = Math.max(0, Math.round(numero(dados.qtd))); // quantidade sempre inteira
  let r;
  try {
    r = id ? await db.from(tabela).update(dados).eq("id", id) : await db.from(tabela).insert(dados);
  } catch (e) { throw new Error(traduzirErro(e, tabela)); }
  if (r.error) throw new Error(traduzirErro(r.error, tabela));
}
async function remover(tabela, id) {
  let r;
  try { r = await db.from(tabela).delete().eq("id", id); } catch (e) { throw new Error(traduzirErro(e, tabela)); }
  if (r.error) throw new Error(traduzirErro(r.error, tabela));
}
async function atualizarCampo(tabela, id, valores) {
  let r;
  try { r = await db.from(tabela).update(valores).eq("id", id); } catch (e) { avisar(traduzirErro(e, tabela), "erro"); return false; }
  if (r.error) { avisar(traduzirErro(r.error, tabela), "erro"); return false; }
  return true;
}

/* ---------------------------------------------------------------
   INÍCIO DO PAINEL: menu, rotas e eventos
   --------------------------------------------------------------- */
const TITULOS = { portfolio: "Portfólio", marcas: "Marcas", cupons: "Cupons", calendario: "Calendário", campanhas: "Campanhas", checklist: "Checklist portfólio" };
const TELAS = {}; // preenchido mais abaixo: TELAS.portfolio = telaPortfolio ...

async function iniciar(usuario) {
  $("#emailLogada").textContent = usuario.email;
  ligarEventos();
  db.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") location.replace("../login/"); });
  $("#tela").innerHTML = '<p class="vazio">Carregando os seus dados...</p>';
  await carregar();
  irPara(location.hash.slice(1) || "portfolio");
}

function irPara(aba) {
  if (!TELAS[aba]) aba = "portfolio";
  estado.aba = aba;
  $$(".item[data-aba]").forEach(a => a.classList.toggle("ativo", a.dataset.aba === aba));
  $("#tituloAba").textContent = TITULOS[aba];
  document.title = TITULOS[aba] + " | Painel Amanda Drebes";
  fecharGaveta();
  desenhar();
}

function desenharAvisos() {
  const chaves = Object.keys(estado.problemas);
  $("#avisos").innerHTML = chaves.length
    ? '<div class="aviso-banco" role="alert"><b>Atenção: faltou alguma coisa no banco.</b> O resto do painel continua funcionando.<ul>' +
      chaves.map(k => "<li>" + esc(estado.problemas[k]) + "</li>").join("") + "</ul></div>"
    : "";
}

/* Se uma tela der erro, ela avisa e as outras continuam abrindo. Nunca fica em branco. */
function desenhar() {
  desenharAvisos();
  try { TELAS[estado.aba](); }
  catch (e) {
    console.error(e);
    $("#tela").innerHTML = '<div class="cartao"><p class="vazio">Esta tela encontrou um problema e não abriu (' + esc(e.message) + "). As outras telas continuam funcionando.</p></div>";
  }
}

/* Recarrega os dados do banco. No modo silencioso, não mexe na tela se você estiver digitando ou com uma janela aberta. */
let atualizando = false;
async function atualizarTudo(silencioso) {
  if (atualizando) return;
  atualizando = true;
  try {
    await carregar();
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
    const janelaAberta = $("#fundoModal").classList.contains("aberto");
    if (!silencioso || (!digitando && !janelaAberta)) desenhar();
    if (!silencioso) avisar("Dados atualizados");
  } finally { atualizando = false; }
}

function abrirGaveta() { $("#lateral").classList.add("aberta"); $("#fundoGaveta").classList.add("aberta"); }
function fecharGaveta() { $("#lateral").classList.remove("aberta"); $("#fundoGaveta").classList.remove("aberta"); }

const ACOES = {}; // ações dos botões (data-acao)
const CAMPOS = {}; // reação aos campos de busca e filtros (data-campo)

function ligarEventos() {
  window.addEventListener("hashchange", () => irPara(location.hash.slice(1)));
  $("#btnMenu").addEventListener("click", abrirGaveta);
  $("#fundoGaveta").addEventListener("click", fecharGaveta);
  $("#btnSair").addEventListener("click", async () => { try { await db.auth.signOut(); } catch (e) {} location.replace("../login/"); });
  $("#modalFechar").addEventListener("click", fecharModal);
  $("#fundoModal").addEventListener("click", e => { if (e.target.id === "fundoModal") fecharModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { fecharModal(); fecharGaveta(); } });

  /* Atualização: botão, ao voltar para a aba e a cada 30 segundos. */
  $("#btnAtualizar").addEventListener("click", () => atualizarTudo(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizarTudo(true); });
  setInterval(() => { if (!document.hidden) atualizarTudo(true); }, 30000);

  const tela = $("#tela");
  tela.addEventListener("click", tratarClique);
  $("#modalCorpo").addEventListener("click", tratarClique);
  ["input", "change"].forEach(ev => {
    tela.addEventListener(ev, e => {
      const el = e.target.closest("[data-campo]");
      if (!el) return;
      const tipo = el.dataset.evento || "input";
      if (ev !== tipo && !(tipo === "input" && ev === "change" && el.tagName === "SELECT")) return;
      if (CAMPOS[el.dataset.campo]) CAMPOS[el.dataset.campo](el);
    });
  });
  /* Sanfonas (details): lembro quais estão abertas. O evento "toggle" não sobe, então uso a fase de captura. */
  tela.addEventListener("toggle", e => {
    const d = e.target;
    if (d.tagName === "DETAILS" && d.dataset.id) ui.cl.abertos[d.dataset.id] = d.open;
  }, true);
}

function tratarClique(e) {
  const el = e.target.closest("[data-acao]");
  if (!el || !ACOES[el.dataset.acao]) return;
  const inter = e.target.closest("a,button,input,select,label");
  if (inter && inter !== el && !inter.dataset.acao) return; // clicou num link ou botão dentro da linha
  ACOES[el.dataset.acao](el, e);
}

/* ===================================================================
   4A. PORTFÓLIO
   =================================================================== */
function ultimosDias(n) {
  const h = new Date(), r = [];
  for (let i = n - 1; i >= 0; i--) r.push(iso(new Date(h.getFullYear(), h.getMonth(), h.getDate() - i)));
  return r;
}
function maiorChave(obj) {
  let m = null;
  Object.keys(obj).forEach(k => { if (!m || obj[k] > m.n) m = { chave: k, n: obj[k] }; });
  return m;
}

function telaPortfolio() {
  const dias = ultimosDias(14), hoje = hojeISO();
  const cont = {}; dias.forEach(d => { cont[d] = 0; });
  const origens = {}; let total = 0, suas = 0, suasHoje = 0;
  estado.visitas.forEach(v => {
    const d = iso(new Date(v.data));
    if (!(d in cont)) return;
    cont[d]++; total++;
    const o = v.origem || "Direto";
    if (o === "Você (logada)") { suas++; if (d === hoje) suasHoje++; }
    if (o !== "Interno" && o !== "Você (logada)") origens[o] = (origens[o] || 0) + 1;
  });
  const noAr = estado.videos.filter(v => v.visivel).length;
  const porNicho = {};
  estado.videos.filter(v => v.visivel && v.nicho).forEach(v => { porNicho[v.nicho] = (porNicho[v.nicho] || 0) + 1; });
  const nichoTop = maiorChave(porNicho), origemTop = maiorChave(origens);
  const maximo = Math.max(1, ...dias.map(d => cont[d]));
  const totalOrigens = Object.keys(origens).reduce((s, k) => s + origens[k], 0);

  const grafico = total === 0
    ? '<p class="vazio">Ainda não há visitas. Quando as pessoas começarem a entrar no seu portfólio, aqui vai aparecer um gráfico com quantas visitas chegaram em cada um dos últimos 14 dias.</p>'
    : '<div class="grafico" role="img" aria-label="Visitas por dia nos últimos 14 dias">' + dias.map(d => {
        const n = cont[d], h = Math.round(n / maximo * 100);
        return '<div class="col" title="' + fmtData(d) + ": " + plural(n, "visita", "visitas") + '"><span class="num">' + (n || "") + '</span><div class="area"><div class="barra' + (d === hoje ? " hoje" : "") + '" style="height:' + h + '%"></div></div><span class="dia">' + d.slice(8) + "</span></div>";
      }).join("") + "</div>";

  const listaOrigens = totalOrigens === 0
    ? '<p class="vazio">Quando alguém chegar ao seu portfólio pelo Instagram, pelo Google ou por um link direto, você vai ver aqui de onde cada pessoa veio.</p>'
    : '<div class="origens">' + Object.keys(origens).sort((a, b) => origens[b] - origens[a]).slice(0, 8).map(k =>
        '<div class="origem"><span>' + esc(k) + '</span><b>' + origens[k] + '</b><div class="trilho"><i style="width:' + Math.round(origens[k] / totalOrigens * 100) + '%"></i></div></div>').join("") + "</div>";

  const linhas = estado.videos.map(v =>
    '<tr data-id="' + esc(v.id) + '" class="' + (v.visivel ? "" : "escondido") + '">' +
    '<td class="alca" title="Arraste para mudar a ordem">' + ic("grip") + "</td>" +
    "<td><b>" + esc(v.titulo) + "</b>" + etiquetaExemplo(v) + (v.link ? ' <a class="discreto" href="' + esc(v.link) + '" target="_blank" rel="noopener" aria-label="Abrir o vídeo">' + ic("link") + "</a>" : "") + "</td>" +
    "<td>" + esc(v.nicho || "") + "</td><td>" + esc(v.formato || "") + "</td><td>" + esc(v.marca || "") + "</td><td>" + esc(v.destaque || "") + "</td>" +
    '<td class="num">' + numero(v.ordem) + "</td>" +
    '<td class="acoes"><button class="icone-btn" data-acao="alternarVideo" data-id="' + esc(v.id) + '" title="' + (v.visivel ? "Esconder do site" : "Mostrar no site") + '" aria-label="' + (v.visivel ? "Esconder do site" : "Mostrar no site") + '">' + ic(v.visivel ? "eye" : "eyeoff") + "</button>" +
    '<button class="icone-btn" data-acao="editarVideo" data-id="' + esc(v.id) + '" title="Editar" aria-label="Editar">' + ic("edit") + "</button>" +
    '<button class="icone-btn perigo" data-acao="apagarVideo" data-id="' + esc(v.id) + '" title="Apagar" aria-label="Apagar">' + ic("trash") + "</button></td></tr>").join("");

  $("#tela").innerHTML =
    '<div class="faixa-num">' +
    "<div><small>Visitas em 14 dias</small><strong>" + total + "</strong>" + (suas ? "<em>inclui " + suas + " suas</em>" : "") + "</div>" +
    "<div><small>Visitas hoje</small><strong>" + (cont[hoje] || 0) + "</strong>" + (suasHoje ? "<em>inclui " + suasHoje + " suas</em>" : "") + "</div>" +
    "<div><small>Vídeos no ar</small><strong>" + noAr + "</strong></div>" +
    "<div><small>Nicho mais forte</small><strong>" + esc(nichoTop ? nichoTop.chave : "nenhum ainda") + "</strong>" + (nichoTop ? "<em>" + plural(nichoTop.n, "vídeo", "vídeos") + "</em>" : "") + "</div>" +
    "<div><small>De onde mais vêm</small><strong>" + esc(origemTop ? origemTop.chave : "nenhuma ainda") + "</strong>" + (origemTop ? "<em>" + plural(origemTop.n, "visita", "visitas") + "</em>" : "") + "</div>" +
    "</div>" +
    '<div class="grade-2"><div class="cartao"><div class="cab"><h2>Visitas nos últimos 14 dias</h2></div>' + grafico + '<p class="dica">As suas próprias visitas (com você logada neste navegador) também são contadas e ficam marcadas como "Você (logada)". Atualizar a mesma aba não conta de novo: abra uma aba nova para testar.</p></div>' +
    '<div class="cartao"><div class="cab"><h2>Por onde chegaram</h2></div>' + listaOrigens + "</div></div>" +
    '<div class="cartao"><div class="cab"><h2>Meus vídeos</h2><button class="btn amarelo" data-acao="novoVideo">' + ic("plus") + "Adicionar vídeo</button></div>" +
    (estado.videos.some(v => !v.exemplo) ? "" : '<p class="nota">Os vídeos que estão no seu portfólio ainda não foram trazidos para cá. <button class="btn pequeno amarelo" data-acao="importarVideos">Importar os meus 10 vídeos</button></p>') +
    (estado.videos.length
      ? '<div class="rolagem"><table class="tabela" id="tabVideos"><thead><tr><th></th><th>Título</th><th>Nicho</th><th>Formato</th><th>Marca</th><th>Destaque</th><th class="num">Ordem</th><th></th></tr></thead><tbody id="corpoVideos">' + linhas + "</tbody></table></div>"
      : '<p class="vazio">Nenhum vídeo ainda. Clique em "Adicionar vídeo" para começar.</p>') +
    '<p class="dica">Arraste pela alça para mudar a ordem. O olho mostra ou esconde o vídeo no site. Mudou aqui, muda no site sozinho.</p></div>' +
    '<div class="cartao"><div class="cab"><h2>Segurança do banco</h2><button class="btn" data-acao="testarTranca">' + ic("shield") + 'Testar a tranca</button></div>' +
    '<div class="testes" id="resultadoTranca"><p class="vazio">Clique em "Testar a tranca" para conferir que ninguém deslogado consegue ler os seus dados.</p></div></div>';

  ligarArrastar();
}

function camposVideo() {
  const nichos = Array.from(new Set(estado.videos.map(v => v.nicho).filter(Boolean)));
  return [
    { k: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, inteira: true },
    { k: "link", rotulo: "Link do vídeo (YouTube Shorts)", tipo: "url", obrigatorio: true, inteira: true, dica: "Cole o endereço do vídeo, por exemplo https://youtube.com/shorts/..." },
    { k: "nicho", rotulo: "Nicho", tipo: "texto", lista: nichos },
    { k: "formato", rotulo: "Formato", tipo: "texto", lista: ["vídeo 9:16", "Reels", "Shorts", "TikTok", "foto 4:5"] },
    { k: "marca", rotulo: "Marca", tipo: "texto" },
    { k: "destaque", rotulo: "Destaque (ex: 2,4M views)", tipo: "texto", dica: "Se preencher, o vídeo pode aparecer nos cards de destaque do site." },
    { k: "visivel", rotulo: "Mostrar no site", tipo: "caixa", inteira: true }
  ];
}

/* Os 10 vídeos que já estavam no portfólio, para importar com um clique. */
const VIDEOS_ATUAIS = [
  ["Vídeo de skincare", "https://youtube.com/shorts/ZZoSb8IljPw", "skincare", "", "+1.000 views"],
  ["Vídeo de casa e decoração", "https://youtube.com/shorts/TX4IBQr0ZE4", "casa e decoração", "", "+1.000 views"],
  ["Vídeo de moda", "https://youtube.com/shorts/JOZyCMSgrLg", "moda", "", "+1.000 views"],
  ["Vídeo de moda", "https://youtube.com/shorts/-_1NY4habg0", "moda", "", ""],
  ["Vídeo de casa e decoração", "https://youtube.com/shorts/5ooUE9kIQ88", "casa e decoração", "", ""],
  ["Vídeo de aplicativo", "https://youtube.com/shorts/N_6Ys6f2R34", "app", "", ""],
  ["Vídeo de cabelos", "https://youtube.com/shorts/t49i1IJJZ68", "cabelos", "", ""],
  ["Vídeo de acessórios", "https://youtube.com/shorts/f-olPvZghdQ", "acessórios", "", ""],
  ["Novo lançamento babado de Vichy", "https://youtube.com/shorts/gZfgKa4RVZQ", "skincare", "Vichy", ""],
  ["Seca em minutos", "https://youtube.com/shorts/O8kRgkeMjYU", "cabelos", "", ""]
];
ACOES.importarVideos = async () => {
  if (estado.videos.some(v => v.link === VIDEOS_ATUAIS[0][1])) { avisar("Esses vídeos já estão aqui", "erro"); return; }
  if (!confirm("Trazer para o painel os 10 vídeos que já estão no seu portfólio?")) return;
  const base = estado.videos.reduce((m, v) => Math.max(m, numero(v.ordem)), 0);
  const linhas = VIDEOS_ATUAIS.map((v, i) => ({ titulo: v[0], link: v[1], nicho: v[2], formato: "vídeo 9:16", marca: v[3] || null, destaque: v[4] || null, ordem: base + i + 1, visivel: true, exemplo: false }));
  let r;
  try { r = await db.from("videos").insert(linhas); } catch (e) { r = { error: e }; }
  if (r.error) { avisar(traduzirErro(r.error, "videos"), "erro"); return; }
  await carregar(["videos"]); desenhar(); avisar("10 vídeos importados");
};
ACOES.novoVideo = () => {
  const proxima = estado.videos.reduce((m, v) => Math.max(m, numero(v.ordem)), 0) + 1;
  abrirForm({
    titulo: "Adicionar vídeo", campos: camposVideo(), valores: { visivel: true },
    onSalvar: async d => { await gravar("videos", null, Object.assign(d, { ordem: proxima })); await carregar(["videos"]); desenhar(); avisar("Vídeo adicionado"); }
  });
};
ACOES.editarVideo = el => {
  const v = estado.videos.find(x => String(x.id) === el.dataset.id); if (!v) return;
  abrirForm({
    titulo: "Editar vídeo", campos: camposVideo(), valores: v,
    aviso: v.exemplo ? "Este é um vídeo de exemplo. Ao salvar com os seus dados, ele deixa de ser exemplo." : "",
    onSalvar: async d => { await gravar("videos", v.id, d); await carregar(["videos"]); desenhar(); avisar("Vídeo salvo"); },
    onApagar: async () => { await remover("videos", v.id); await carregar(["videos"]); desenhar(); avisar("Vídeo apagado"); }
  });
};
ACOES.apagarVideo = async el => {
  const v = estado.videos.find(x => String(x.id) === el.dataset.id); if (!v) return;
  if (!confirm('Apagar o vídeo "' + v.titulo + '"? Não dá para desfazer.')) return;
  try { await remover("videos", v.id); await carregar(["videos"]); desenhar(); avisar("Vídeo apagado"); }
  catch (e) { avisar(e.message, "erro"); }
};
ACOES.alternarVideo = async el => {
  const v = estado.videos.find(x => String(x.id) === el.dataset.id); if (!v) return;
  if (await atualizarCampo("videos", v.id, { visivel: !v.visivel })) {
    await carregar(["videos"]); desenhar(); avisar(v.visivel ? "Vídeo escondido do site" : "Vídeo aparecendo no site");
  }
};

/* Arrastar pela alça: funciona com mouse e com o dedo no celular. */
function ligarArrastar() {
  const corpo = $("#corpoVideos"); if (!corpo) return;
  corpo.addEventListener("pointerdown", e => {
    const alca = e.target.closest(".alca"); if (!alca) return;
    const linha = alca.closest("tr"); e.preventDefault();
    linha.classList.add("arrastando");
    try { alca.setPointerCapture(e.pointerId); } catch (x) {}
    const mover = ev => {
      const sob = document.elementFromPoint(ev.clientX, ev.clientY);
      const alvo = sob && sob.closest ? sob.closest("tr[data-id]") : null;
      if (alvo && alvo !== linha && alvo.parentNode === corpo) {
        const r = alvo.getBoundingClientRect();
        corpo.insertBefore(linha, ev.clientY < r.top + r.height / 2 ? alvo : alvo.nextSibling);
      }
    };
    const fim = () => {
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", fim);
      alca.removeEventListener("pointercancel", fim);
      linha.classList.remove("arrastando");
      salvarOrdem();
    };
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", fim);
    alca.addEventListener("pointercancel", fim);
  });
}
async function salvarOrdem() {
  const ids = $$("#corpoVideos tr[data-id]").map(tr => tr.dataset.id);
  const mudancas = [];
  ids.forEach((id, i) => {
    const v = estado.videos.find(x => String(x.id) === id);
    if (v && numero(v.ordem) !== i + 1) mudancas.push(atualizarCampo("videos", v.id, { ordem: i + 1 }));
  });
  if (!mudancas.length) return;
  const resultados = await Promise.all(mudancas);
  await carregar(["videos"]); desenhar();
  if (resultados.every(Boolean)) avisar("Ordem salva");
}

/* Teste da tranca: tenta ler cada tabela SEM estar logada e mostra o resultado. */
ACOES.testarTranca = async () => {
  const alvo = $("#resultadoTranca"); alvo.innerHTML = '<p class="vazio">Testando...</p>';
  const anonimo = BANCO.criarCliente({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "teste-sem-login" } });
  if (!anonimo) { alvo.innerHTML = '<p class="vazio">Não consegui montar o teste agora.</p>'; return; }
  const linhas = [];
  for (const nome of ["videos", "marcas", "cupons", "calendario", "campanhas", "marcados", "visitas"]) {
    let logada = 0, erroLogada = null, lidas = 0, erroAnon = null;
    try { const r = await db.from(nome).select("*", { count: "exact", head: true }); if (r.error) erroLogada = r.error; else logada = r.count || 0; } catch (e) { erroLogada = e; }
    try { const r = await anonimo.from(nome).select("*").limit(5); erroAnon = r.error; lidas = r.data ? r.data.length : 0; } catch (e) { erroAnon = e; }
    let texto, classe;
    if (erroLogada) { texto = "Não consegui testar: " + traduzirErro(erroLogada, nome); classe = "pendente"; }
    else if (lidas > 0) { texto = "ABERTA: alguém deslogado conseguiu ler " + lidas + " linha(s). Rode o banco.sql de novo agora."; classe = "atraso"; }
    else if (erroAnon) { texto = "Trancada. Quem está deslogado é barrado."; classe = "pago"; }
    else if (logada > 0) { texto = "Trancada. Você vê " + logada + " linha(s) e quem está deslogado vê 0."; classe = "pago"; }
    else { texto = "Sem dados nesta tabela, então não dá para provar ainda. Adicione uma linha e teste de novo."; classe = "pendente"; }
    linhas.push('<div class="linha"><span>' + nome + '</span><span class="pill p-' + classe + '" style="white-space:normal">' + esc(texto) + "</span></div>");
  }
  try {
    const r = await anonimo.rpc("videos_do_site");
    linhas.push('<div class="linha"><span>janelinha do site</span><span class="pill p-pago" style="white-space:normal">' + (r.error ? esc("Não respondeu: " + r.error.message) : "Responde para o site e devolve só os vídeos visíveis (" + (r.data || []).length + " agora).") + "</span></div>");
  } catch (e) {}
  alvo.innerHTML = linhas.join("");
};

TELAS.portfolio = telaPortfolio;

/* ===================================================================
   4B. MARCAS
   =================================================================== */
const soDigitos = t => String(t || "").replace(/\D/g, "");
function linkWhats(tel) {
  let d = soDigitos(tel); if (d.length < 8) return "";
  if (d.length <= 11) d = "55" + d;
  return "https://wa.me/" + d;
}
function usuarioInsta(t) {
  const s = String(t || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return s;
}

/* ---- NICHOS DAS MARCAS: lista de sugestões e palpite pelo nome (palavras-chave) ---- */
const NICHOS_MARCA = ["Skincare", "Maquiagem", "Cabelos", "Perfumaria", "Moda", "Acessórios", "Casa e decoração", "Alimentos e bebidas", "Fitness e saúde", "Suplementos", "Pet", "Infantil", "Tecnologia e apps", "Serviços e finanças", "Outros"];
const PALAVRAS_NICHO = [
  ["Skincare", /skin|derm|vichy|serum|hidrat|cosmet|facial|bioderma|la roche|cerave|sabonete|solar|protetor/],
  ["Maquiagem", /make|maquiag|batom|beauty|beleza|cilios|sobrancelha|boticario|natura|eudora|vult|ruby/],
  ["Cabelos", /cabel|hair|shampoo|keune|pantene|garnier|loreal|l oreal|salao|escova|capilar|wella|tresemme|elseve|monange|desincha/],
  ["Perfumaria", /perfum|parfum|fragranc|essenc|colonia|aroma/],
  ["Moda", /moda|fashion|roupa|jeans|vestid|boutique|lingerie|calcad|sapato|tenis|shoes|wear/],
  ["Acessórios", /joia|bijou|semijoia|acessor|relogio|oculos|otica|bolsa|carcaca|gocase/],
  ["Casa e decoração", /casa|deco|home|movel|mesa|cama|banho|cozinha|utilid|camicado|tapete|colch/],
  ["Alimentos e bebidas", /aliment|food|cafe|chocolate|snack|doce|bebida|suco|vinho|cerveja|restaurante|padaria|gourmet|sabor/],
  ["Fitness e saúde", /fitness|gym|academia|treino|esporte|sport|yoga|saude|bem estar|clinic/],
  ["Suplementos", /suplement|whey|creatina|vitamina|colageno|nutri|protein/],
  ["Pet", /pet|dog|gato|racao|vet/],
  ["Infantil", /baby|bebe|infantil|kids|crianca|materni|fralda/],
  ["Tecnologia e apps", /app|tech|tecno|digital|software|plataforma|eletro|celular|gadget|smart|oster|philips/],
  ["Serviços e finanças", /banco|credit|financ|seguro|cartao|pagament|consult|servic|curso|escola|agencia/]
];
function nichoDoTexto(txt) {
  const n = " " + norm(txt) + " ";
  for (const par of PALAVRAS_NICHO) if (par[1].test(n)) return par[0];
  return null;
}
function nichosUsados() {
  const v = new Map(); NICHOS_MARCA.forEach(n => v.set(norm(n), n)); estado.marcas.forEach(m => { if (m.nicho && !v.has(norm(m.nicho))) v.set(norm(m.nicho), m.nicho); });
  const cont = {}; estado.marcas.forEach(m => { if (m.nicho) cont[norm(m.nicho)] = 1; });
  return Array.from(v.entries()).filter(e => cont[e[0]]).map(e => e[1]);
}
CAMPOS.mNicho = el => { ui.mNicho = el.value; desenharListaMarcas(); };
function marcasFiltradas() {
  const q = ui.mBusca.trim().toLowerCase();
  return estado.marcas.filter(m => {
    if (ui.mFiltro !== "todas" && m.situacao !== ui.mFiltro) return false;
    if (ui.mNicho !== "todos" && (ui.mNicho === "sem" ? !!m.nicho : norm(m.nicho) !== norm(ui.mNicho))) return false;
    if (!q) return true;
    return [m.nome, m.instagram, m.email].some(x => String(x || "").toLowerCase().indexOf(q) > -1);
  });
}

function desenharListaMarcas() {
  const lista = marcasFiltradas();
  $("#contaMarcas").textContent = plural(lista.length, "marca", "marcas");
  if (!estado.marcas.length) { $("#listaMarcas").innerHTML = '<p class="vazio">Nenhuma marca ainda. Clique em "Adicionar marca" ou espere chegar um contato pelo formulário do site.</p>'; return; }
  if (!lista.length) { $("#listaMarcas").innerHTML = '<p class="vazio">Nenhuma marca encontrada com esse filtro.</p>'; return; }
  $("#listaMarcas").innerHTML = '<div class="rolagem"><table class="tabela"><thead><tr><th>Marca</th><th>Nicho</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th>Observação</th><th>Último contato</th></tr></thead><tbody>' +
    lista.map(m => {
      const insta = usuarioInsta(m.instagram), zap = linkWhats(m.telefone);
      const sit = (SITUACOES.find(s => s[0] === m.situacao) || [m.situacao, m.situacao || ""])[1];
      return '<tr class="clicavel" data-acao="editarMarca" data-id="' + esc(m.id) + '">' +
        "<td><b>" + esc(m.nome) + "</b>" + etiquetaExemplo(m) + "</td>" +
        "<td>" + (m.nicho ? pill("nicho", m.nicho) : "") + "</td>" +
        "<td>" + (insta ? '<a class="discreto" href="https://instagram.com/' + esc(insta) + '" target="_blank" rel="noopener">@' + esc(insta) + "</a>" : "") + "</td>" +
        "<td>" + (m.email ? '<a class="discreto" href="mailto:' + esc(m.email) + '">' + esc(m.email) + "</a>" : "") + "</td>" +
        "<td>" + esc(m.telefone || "") + (zap ? ' <a class="icone-btn" href="' + esc(zap) + '" target="_blank" rel="noopener" title="Abrir o WhatsApp" aria-label="Abrir o WhatsApp">' + ic("chat") + "</a>" : "") + "</td>" +
        "<td>" + pill(m.situacao, sit) + "</td>" +
        '<td class="corta" title="' + esc(m.obs || "") + '">' + esc(m.obs || "") + "</td>" +
        "<td>" + esc(fmtData(m.ultimo_contato)) + "</td></tr>";
    }).join("") + "</tbody></table></div>";
}

function telaMarcas() {
  $("#tela").innerHTML =
    '<div class="cartao"><div class="ferram">' +
    '<label class="campo-busca">' + ic("search") + '<input type="search" placeholder="Buscar por nome, @ ou e-mail" data-campo="mBusca" value="' + esc(ui.mBusca) + '" aria-label="Buscar marca"></label>' +
    '<select class="sel" data-campo="mFiltro" data-evento="change" aria-label="Filtrar por situação"><option value="todas">Todas as situações</option>' +
    SITUACOES.map(s => '<option value="' + s[0] + '"' + (ui.mFiltro === s[0] ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select>" +
    '<select class="sel" data-campo="mNicho" data-evento="change" aria-label="Filtrar por nicho"><option value="todos">Todos os nichos</option><option value="sem"' + (ui.mNicho === "sem" ? " selected" : "") + '>Sem nicho</option>' + nichosUsados().map(n => '<option value="' + esc(n) + '"' + (norm(ui.mNicho) === norm(n) ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select>" +
    '<span class="dica" id="contaMarcas" style="margin:0"></span><span class="espaco"></span>' +
    '<button class="btn" data-acao="importarMarcas">' + ic("upload") + "Importar planilha</button>" +
    '<button class="btn" data-acao="baixarMarcas">' + ic("download") + "Baixar CSV</button>" +
    '<button class="btn amarelo" data-acao="novaMarca">' + ic("plus") + "Adicionar marca</button></div>" +
    '<div id="listaMarcas"></div></div>';
  desenharListaMarcas();
}
CAMPOS.mBusca = el => { ui.mBusca = el.value; desenharListaMarcas(); };
CAMPOS.mFiltro = el => { ui.mFiltro = el.value; desenharListaMarcas(); };

function camposMarca() {
  return [
    { k: "nome", rotulo: "Marca", tipo: "texto", obrigatorio: true, inteira: true },
    { k: "nicho", rotulo: "Nicho", tipo: "texto", lista: NICHOS_MARCA, dica: "Escolha da lista ou escreva o seu" },
    { k: "instagram", rotulo: "Instagram (@)", tipo: "texto" },
    { k: "email", rotulo: "E-mail", tipo: "email" },
    { k: "telefone", rotulo: "Telefone / WhatsApp", tipo: "tel", dica: "Com DDD. Ex: (51) 99999-9999" },
    { k: "situacao", rotulo: "Situação", tipo: "select", opcoes: SITUACOES },
    { k: "ultimo_contato", rotulo: "Último contato", tipo: "data" },
    { k: "obs", rotulo: "Observação", tipo: "area" }
  ];
}
ACOES.novaMarca = () => abrirForm({
  titulo: "Adicionar marca", campos: camposMarca(), valores: { situacao: "lead", ultimo_contato: hojeISO() },
  onSalvar: async d => { await gravar("marcas", null, d); await carregar(["marcas"]); desenhar(); avisar("Marca adicionada"); }
});
ACOES.editarMarca = el => {
  const m = estado.marcas.find(x => String(x.id) === el.dataset.id); if (!m) return;
  abrirForm({
    titulo: "Editar marca", campos: camposMarca(), valores: m,
    aviso: m.exemplo ? "Esta é uma marca de exemplo. Ao salvar com os seus dados, ela deixa de ser exemplo." : "",
    onSalvar: async d => { await gravar("marcas", m.id, d); await carregar(["marcas"]); desenhar(); avisar("Marca salva"); },
    onApagar: async () => { await remover("marcas", m.id); await carregar(["marcas"]); desenhar(); avisar("Marca apagada"); }
  });
};
ACOES.baixarMarcas = () => {
  const lista = marcasFiltradas();
  if (!lista.length) { avisar("Não há marcas para baixar", "erro"); return; }
  baixarCSV("marcas-" + hojeISO() + ".csv",
    ["Marca", "Nicho", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"],
    lista.map(m => [m.nome, m.nicho, m.instagram, m.email, m.telefone, (SITUACOES.find(s => s[0] === m.situacao) || ["", m.situacao])[1], m.obs, fmtData(m.ultimo_contato)]));
};
/* ---- IMPORTAR PLANILHA (CSV) PARA A ABA MARCAS ---- */
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@ ]/g, " ").replace(/\s+/g, " ").trim();
const CAMPOS_IMPORTAR = [
  { k: "nome", rotulo: "Marca", dicas: ["marca", "nome", "empresa", "cliente", "brand", "razao social", "nome da marca", "nome fantasia"] },
  { k: "nicho", rotulo: "Nicho", dicas: ["nicho", "segmento", "categoria", "area", "ramo", "setor", "tipo", "mercado"] },
  { k: "instagram", rotulo: "Instagram", dicas: ["instagram", "insta", "ig", "@", "perfil", "arroba", "usuario"] },
  { k: "email", rotulo: "E-mail", dicas: ["email", "e mail", "mail", "e-mail", "contato email", "correio"] },
  { k: "telefone", rotulo: "Telefone / WhatsApp", dicas: ["telefone", "whatsapp", "whats", "zap", "celular", "fone", "tel", "contato telefone", "numero"] },
  { k: "situacao", rotulo: "Situação", dicas: ["situacao", "status", "etapa", "fase", "estagio"] },
  { k: "obs", rotulo: "Observação", dicas: ["observacao", "observacoes", "obs", "notas", "nota", "anotacoes", "comentarios", "detalhes", "proposta"] },
  { k: "ultimo_contato", rotulo: "Último contato", dicas: ["ultimo contato", "data", "data contato", "data do contato", "contato em", "enviado em", "data proposta", "data envio"] }
];
function lerTextoArquivo(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder("windows-1252").decode(buf); } // planilhas antigas do Excel
}
function lerCSV(texto) {
  texto = texto.replace(/^﻿/, "");
  const primeira = texto.split(/\r?\n/, 1)[0] || "";
  const cont = ch => primeira.split(ch).length - 1;
  const sep = [";", ",", "\t"].sort((a, b) => cont(b) - cont(a))[0];
  const linhas = []; let linha = [], cel = "", asp = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (asp) {
      if (c === '"') { if (texto[i + 1] === '"') { cel += '"'; i++; } else asp = false; } else cel += c;
    } else if (c === '"' && cel === "") asp = true;
    else if (c === sep) { linha.push(cel); cel = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texto[i + 1] === "\n") i++; linha.push(cel); cel = ""; linhas.push(linha); linha = []; }
    else cel += c;
  }
  if (cel !== "" || linha.length) { linha.push(cel); linhas.push(linha); }
  return linhas.filter(l => l.some(x => String(x).trim() !== ""));
}
function adivinharColuna(cabecalhos, campo) {
  const ns = cabecalhos.map(norm);
  for (const d of campo.dicas) { const i = ns.indexOf(norm(d)); if (i > -1) return i; }
  for (const d of campo.dicas) { const nd = norm(d); if (nd.length < 3) continue; const i = ns.findIndex(h => h.indexOf(nd) > -1); if (i > -1) return i; }
  return -1;
}
function situacaoDoTexto(v, padrao) {
  const n = norm(v); if (!n) return padrao;
  if (/cliente|fechad|fechou|aprovad|ativo|parceir/.test(n) && !/inativ/.test(n)) return "cliente";
  if (/parad|inativ|perdid|sem retorno|recus|nao (tem|houve)|arquivad|frio/.test(n)) return "parada";
  if (/convers|negoci|proposta|enviad|respond|retorn|andamento|aguard|contato feito|em contato/.test(n)) return "conversando";
  return padrao;
}
function dataDoTexto(v) {
  const s = String(v || "").trim(); if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { let a = +m[3]; if (a < 100) a += 2000; const d = new Date(a, +m[2] - 1, +m[1]); return d.getMonth() === +m[2] - 1 && a > 1990 && a < 2100 ? iso(d) : null; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null;
}
/* Lê .xlsx/.xls: carrega a biblioteca de leitura só quando precisa (primeira aba). */
function carregarLeitorExcel() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = ok; s.onerror = () => falha(new Error("sem leitor")); document.head.appendChild(s);
  });
}
async function lerExcel(buf) {
  await carregarLeitorExcel();
  const livro = XLSX.read(buf, { type: "array", cellDates: true });
  const aba = livro.Sheets[livro.SheetNames[0]];
  const l = XLSX.utils.sheet_to_json(aba, { header: 1, raw: false, defval: "", dateNF: "dd/mm/yyyy" });
  return l.map(x => x.map(c => String(c === null || c === undefined ? "" : c))).filter(x => x.some(c => c.trim() !== ""));
}ACOES.importarMarcas = () => {
  let linhas = [], cab = [];
  abrirModal("Importar planilha de marcas",
    '<p class="nota">Escolha a sua planilha do <b>Excel (.xlsx)</b> ou um arquivo <b>CSV</b>. Se for do Excel, uso a primeira aba, e a primeira linha precisa ter os títulos das colunas. Eu descubro sozinha quais colunas são nome, Instagram, e-mail e telefone. Marcas que já existem (mesmo e-mail ou mesmo nome) não são repetidas.</p>' +
    '<div class="campo inteira"><label for="arqImp">Arquivo da planilha (Excel ou CSV)</label><input id="arqImp" type="file" accept=".xlsx,.xls,.csv,.txt,text/csv"></div>' +
    '<div id="impCorpo"></div>', { largo: true });
  $("#arqImp").addEventListener("change", async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const corpo = $("#impCorpo");
    if (/\.xls[xmb]?$/i.test(f.name)) {
      corpo.innerHTML = '<p class="dica">Lendo a planilha do Excel...</p>';
      try { linhas = await lerExcel(await f.arrayBuffer()); }
      catch (e) { corpo.innerHTML = '<p class="erro-form">Não consegui abrir esse arquivo do Excel. Se ele tiver senha, tire a senha, ou salve como CSV e tente de novo.</p>'; return; }
    } else linhas = lerCSV(lerTextoArquivo(await f.arrayBuffer()));
    if (linhas.length < 2) { corpo.innerHTML = '<p class="erro-form">Não encontrei linhas nessa planilha. A primeira linha precisa ter os títulos das colunas.</p>'; return; }
    cab = linhas.shift().map(x => String(x).trim());
    const chute = CAMPOS_IMPORTAR.map(c => adivinharColuna(cab, c));
    const opcoesCol = sel => '<option value="-1">(não usar)</option>' + cab.map((h, i) => '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">" + esc(h || "Coluna " + (i + 1)) + "</option>").join("");
    corpo.innerHTML = '<p class="dica" style="margin:8px 0">' + plural(linhas.length, "linha encontrada", "linhas encontradas") + '. Confira se cada informação está ligada à coluna certa:</p>' +
      '<div class="grade-form">' + CAMPOS_IMPORTAR.map((c, i) => '<div class="campo"><label for="mp_' + c.k + '">' + esc(c.rotulo) + '</label><select id="mp_' + c.k + '" data-i="' + i + '">' + opcoesCol(chute[i]) + "</select></div>").join("") +
      '<div class="campo"><label for="mpPadrao">Situação para quem não tiver</label><select id="mpPadrao">' + SITUACOES.map(s => '<option value="' + s[0] + '">' + s[1] + "</option>").join("") + "</select></div>" +
      '<div class="campo inteira caixa"><label><input type="checkbox" id="mpAdivinha" checked> Descobrir o nicho pelo nome da marca quando a planilha não tiver essa informação (você pode corrigir depois)</label></div></div>' +
      '<div id="impPrevia"></div><p class="erro-form" id="impErro" role="alert"></p>' +
      '<div class="rodape-modal"><span class="espaco"></span><button type="button" class="btn" id="impCancelar">Cancelar</button><button type="button" class="btn amarelo" id="impGo">Importar</button></div>';
    const montar = () => {
      const col = {}; CAMPOS_IMPORTAR.forEach(c => { col[c.k] = +$("#mp_" + c.k).value; });
      const padrao = $("#mpPadrao").value, adivinha = $("#mpAdivinha").checked;
      const pega = (l, k) => col[k] > -1 ? String(l[col[k]] === undefined ? "" : l[col[k]]).trim() : "";
      const existentes = new Set(); const nomes = new Set();
      estado.marcas.forEach(m => { if (m.email) existentes.add(norm(m.email)); nomes.add(norm(m.nome)); });
      const novas = []; let repetidas = 0, vazias = 0;
      linhas.forEach(l => {
        let nome = pega(l, "nome"), insta = usuarioInsta(pega(l, "instagram")), email = pega(l, "email").toLowerCase(), obs = pega(l, "obs");
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { obs = (obs ? obs + " | " : "") + "E-mail informado: " + email; email = ""; }
        if (!nome) nome = insta ? "@" + insta : (email ? email.split("@")[0] : "");
        if (!nome) { vazias++; return; }
        const chave = email ? norm(email) : "";
        if ((chave && existentes.has(chave)) || (!chave && nomes.has(norm(nome)))) { repetidas++; return; }
        if (chave) existentes.add(chave); else nomes.add(norm(nome));
        novas.push({ nome: nome.slice(0, 200), instagram: insta ? insta.slice(0, 100) : null, email: email ? email.slice(0, 200) : null, telefone: pega(l, "telefone").slice(0, 60) || null,
          nicho: (pega(l, "nicho") || (adivinha ? nichoDoTexto(nome + " " + insta + " " + obs) : "") || "").slice(0, 60) || null, situacao: situacaoDoTexto(pega(l, "situacao"), padrao), obs: obs ? obs.slice(0, 2000) : null, ultimo_contato: dataDoTexto(pega(l, "ultimo_contato")), exemplo: false });
      });
      $("#impPrevia").innerHTML = '<p class="nota" style="margin-top:10px"><b>' + plural(novas.length, "marca será importada", "marcas serão importadas") + "</b>" +
        (repetidas ? ", " + plural(repetidas, "já existe e será pulada", "já existem e serão puladas") : "") + (vazias ? ", " + plural(vazias, "linha sem nome será ignorada", "linhas sem nome serão ignoradas") : "") + ".</p>" +
        (novas.length ? '<div class="rolagem"><table class="tabela"><thead><tr><th>Marca</th><th>Nicho</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th></tr></thead><tbody>' +
          novas.slice(0, 5).map(n => "<tr><td>" + esc(n.nome) + "</td><td>" + esc(n.nicho || "") + "</td><td>" + esc(n.instagram ? "@" + n.instagram : "") + "</td><td>" + esc(n.email || "") + "</td><td>" + esc(n.telefone || "") + "</td><td>" + esc((SITUACOES.find(s => s[0] === n.situacao) || ["", ""])[1]) + "</td></tr>").join("") + "</tbody></table></div>" +
          (novas.length > 5 ? '<p class="dica">Mostrando as 5 primeiras.</p>' : "") : "");
      return novas;
    };
    let prontas = montar();
    corpo.querySelectorAll("select,#mpAdivinha").forEach(s => s.addEventListener("change", () => { prontas = montar(); }));
    $("#impCancelar").addEventListener("click", fecharModal);
    $("#impGo").addEventListener("click", async () => {
      if (!prontas.length) { $("#impErro").textContent = "Não há nada novo para importar."; return; }
      const botao = $("#impGo"); botao.disabled = true; botao.textContent = "Importando...";
      try {
        for (let i = 0; i < prontas.length; i += 200) {
          const semColuna = estado.marcas.length && !("nicho" in estado.marcas[0]);
          const r = await db.from("marcas").insert(prontas.slice(i, i + 200).map(n => { if (semColuna && !n.nicho) { const c = Object.assign({}, n); delete c.nicho; return c; } return n; }));
          if (r.error) throw new Error(traduzirErro(r.error, "marcas"));
        }
        const total = prontas.length;
        fecharModal(); await carregar(["marcas"]); desenhar(); avisar(plural(total, "marca importada", "marcas importadas"));
      } catch (e) { $("#impErro").textContent = (e.message || "Não consegui importar.") + " Se algumas já entraram, atualize a página para conferir."; botao.disabled = false; botao.textContent = "Importar"; }
    });
  });
};TELAS.marcas = telaMarcas;

/* ===================================================================
   4F. CUPONS (cupons ativos das marcas, com o nome do cupom e o link)
   =================================================================== */
async function copiarTexto(texto) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch (e) {
    try {
      const a = document.createElement("textarea");
      a.value = texto; a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a); a.select();
      const ok = document.execCommand("copy"); a.remove(); return ok;
    } catch (x) { return false; }
  }
}
const hostDoLink = l => { try { return new URL(l).hostname.replace(/^www\./, ""); } catch (e) { return l; } };
const diasParaVencer = c => c.validade ? diasEntre(String(c.validade).slice(0, 10), hojeISO()) : null;
function avisoValidade(c) {
  if (!c.ativo) return "";
  const d = diasParaVencer(c); if (d === null) return "";
  if (d < 0) return '<span class="etq atraso">venceu há ' + plural(-d, "dia", "dias") + "</span>";
  if (d <= 7) return '<span class="etq perto">' + (d === 0 ? "vence hoje" : "vence em " + plural(d, "dia", "dias")) + "</span>";
  return "";
}
function cuponsFiltrados() {
  const q = ui.cupBusca.trim().toLowerCase();
  return estado.cupons.filter(c => {
    if (ui.cupFiltro === "ativos" && !c.ativo) return false;
    if (ui.cupFiltro === "inativos" && c.ativo) return false;
    if (!q) return true;
    return [c.marca, c.cupom, c.link].some(x => String(x || "").toLowerCase().indexOf(q) > -1);
  });
}
function desenharListaCupons() {
  const lista = cuponsFiltrados();
  $("#contaCupons").textContent = plural(lista.length, "cupom", "cupons");
  if (!estado.cupons.length) { $("#listaCupons").innerHTML = '<p class="vazio">Nenhum cupom ainda. Clique em "Adicionar cupom" para cadastrar o primeiro.</p>'; return; }
  if (!lista.length) { $("#listaCupons").innerHTML = '<p class="vazio">Nenhum cupom encontrado com esse filtro.</p>'; return; }
  $("#listaCupons").innerHTML = '<div class="rolagem"><table class="tabela"><thead><tr><th>Marca</th><th>Cupom</th><th>Link</th><th>Desconto</th><th>Validade</th><th>Situação</th></tr></thead><tbody>' +
    lista.map(c =>
      '<tr class="clicavel' + (c.ativo ? "" : " escondido") + '" data-acao="editarCupom" data-id="' + esc(c.id) + '">' +
      "<td><b>" + esc(c.marca) + "</b>" + etiquetaExemplo(c) + "</td>" +
      '<td><code class="cupom">' + esc(c.cupom) + '</code><button class="icone-btn" data-acao="copiarCupom" data-id="' + esc(c.id) + '" title="Copiar o cupom" aria-label="Copiar o cupom">' + ic("copy") + "</button></td>" +
      "<td>" + (c.link ? '<a class="discreto" href="' + esc(c.link) + '" target="_blank" rel="noopener" title="' + esc(c.link) + '">' + esc(hostDoLink(c.link)) + '</a><button class="icone-btn" data-acao="copiarLink" data-id="' + esc(c.id) + '" title="Copiar o link" aria-label="Copiar o link">' + ic("copy") + "</button>" : "") + "</td>" +
      "<td>" + esc(c.desconto || "") + "</td>" +
      "<td>" + esc(fmtData(c.validade)) + avisoValidade(c) + "</td>" +
      '<td><button class="icone-btn" data-acao="alternarCupom" data-id="' + esc(c.id) + '" title="Clique para ativar ou desativar" aria-label="Ativar ou desativar">' + pill(c.ativo ? "pago" : "parada", c.ativo ? "Ativo" : "Inativo") + "</button></td></tr>").join("") +
    "</tbody></table></div>";
}
function telaCupons() {
  const ativos = estado.cupons.filter(c => c.ativo);
  const vencendo = ativos.filter(c => { const d = diasParaVencer(c); return d !== null && d >= 0 && d <= 7; }).length;
  const vencidos = ativos.filter(c => { const d = diasParaVencer(c); return d !== null && d < 0; }).length;
  $("#tela").innerHTML =
    '<div class="faixa-num">' +
    "<div><small>Cupons ativos</small><strong>" + ativos.length + "</strong></div>" +
    "<div><small>Vencem em 7 dias</small><strong>" + vencendo + "</strong></div>" +
    "<div><small>Ativos já vencidos</small><strong>" + vencidos + "</strong></div>" +
    "<div><small>Total cadastrados</small><strong>" + estado.cupons.length + "</strong></div></div>" +
    '<div class="cartao"><div class="ferram">' +
    '<div class="chips" role="group" aria-label="Filtrar cupons">' + [["ativos", "Ativos"], ["todos", "Todos"], ["inativos", "Inativos"]].map(f => '<button class="' + (ui.cupFiltro === f[0] ? "ativo" : "") + '" data-acao="filtroCup" data-tipo="' + f[0] + '">' + f[1] + "</button>").join("") + "</div>" +
    '<label class="campo-busca">' + ic("search") + '<input type="search" placeholder="Buscar marca, cupom ou link" data-campo="cupBusca" value="' + esc(ui.cupBusca) + '" aria-label="Buscar cupom"></label>' +
    '<span class="dica" id="contaCupons" style="margin:0"></span><span class="espaco"></span>' +
    '<button class="btn" data-acao="baixarCupons">' + ic("download") + "Baixar CSV</button>" +
    '<button class="btn amarelo" data-acao="novoCupom">' + ic("plus") + "Adicionar cupom</button></div>" +
    '<div id="listaCupons"></div>' +
    '<p class="dica">Clique numa linha para editar. Os ícones de cópia copiam o cupom ou o link. Clique em "Ativo" para desativar sem apagar.</p></div>';
  desenharListaCupons();
}
CAMPOS.cupBusca = el => { ui.cupBusca = el.value; desenharListaCupons(); };
ACOES.filtroCup = el => { ui.cupFiltro = el.dataset.tipo; desenhar(); };
function camposCupom() {
  return [
    { k: "marca", rotulo: "Marca", tipo: "texto", obrigatorio: true, lista: Array.from(new Set(estado.marcas.map(m => m.nome).concat(estado.cupons.map(c => c.marca)).filter(Boolean))) },
    { k: "cupom", rotulo: "Nome do cupom", tipo: "texto", obrigatorio: true, dica: "Exatamente como a pessoa digita. Ex: AMANDA10" },
    { k: "link", rotulo: "Link do cupom", tipo: "url", inteira: true, dica: "O link que leva para a loja, se tiver." },
    { k: "desconto", rotulo: "Desconto", tipo: "texto", dica: "Ex: 10% ou R$ 20" },
    { k: "validade", rotulo: "Vale até", tipo: "data" },
    { k: "obs", rotulo: "Observação", tipo: "area" },
    { k: "ativo", rotulo: "Cupom ativo", tipo: "caixa", inteira: true }
  ];
}
ACOES.novoCupom = () => abrirForm({
  titulo: "Adicionar cupom", campos: camposCupom(), valores: { ativo: true },
  onSalvar: async d => { await gravar("cupons", null, d); await carregar(["cupons"]); desenhar(); avisar("Cupom adicionado"); }
});
ACOES.editarCupom = el => {
  const c = estado.cupons.find(x => String(x.id) === el.dataset.id); if (!c) return;
  abrirForm({
    titulo: "Editar cupom", campos: camposCupom(), valores: c,
    aviso: c.exemplo ? "Este é um cupom de exemplo. Ao salvar com os seus dados, ele deixa de ser exemplo." : "",
    onSalvar: async d => { await gravar("cupons", c.id, d); await carregar(["cupons"]); desenhar(); avisar("Cupom salvo"); },
    onApagar: async () => { await remover("cupons", c.id); await carregar(["cupons"]); desenhar(); avisar("Cupom apagado"); }
  });
};
ACOES.copiarCupom = async el => {
  const c = estado.cupons.find(x => String(x.id) === el.dataset.id); if (!c) return;
  avisar(await copiarTexto(c.cupom) ? "Cupom copiado: " + c.cupom : "Não consegui copiar. Selecione e copie à mão.", "");
};
ACOES.copiarLink = async el => {
  const c = estado.cupons.find(x => String(x.id) === el.dataset.id); if (!c || !c.link) return;
  avisar(await copiarTexto(c.link) ? "Link copiado" : "Não consegui copiar. Selecione e copie à mão.", "");
};
ACOES.alternarCupom = async el => {
  const c = estado.cupons.find(x => String(x.id) === el.dataset.id); if (!c) return;
  if (await atualizarCampo("cupons", c.id, { ativo: !c.ativo })) { await carregar(["cupons"]); desenhar(); avisar(c.ativo ? "Cupom desativado" : "Cupom ativado"); }
};
ACOES.baixarCupons = () => {
  const lista = cuponsFiltrados();
  if (!lista.length) { avisar("Não há cupons para baixar", "erro"); return; }
  baixarCSV("cupons-" + hojeISO() + ".csv", ["Marca", "Cupom", "Link", "Desconto", "Validade", "Ativo", "Observação"],
    lista.map(c => [c.marca, c.cupom, c.link, c.desconto, fmtData(c.validade), c.ativo ? "Sim" : "Não", c.obs]));
};
TELAS.cupons = telaCupons;
/* ===================================================================
   4C. CALENDÁRIO
   =================================================================== */
function itensDoCalendario() {
  const mapa = {};
  const add = (dia, item) => { (mapa[dia] = mapa[dia] || []).push(item); };
  const f = ui.calFiltro;
  estado.calendario.forEach(c => {
    if (!c.data) return;
    if (f !== "todos" && f !== c.tipo) return;
    add(String(c.data).slice(0, 10), { tipo: c.tipo, id: c.id, titulo: c.titulo, marca: c.marca, feito: c.status === "feito" });
  });
  /* Prazos das campanhas entram sozinhos (vêm da tabela campanhas). */
  if (f === "todos" || f === "prazo") {
    estado.campanhas.forEach(c => {
      if (!c.prazo) return;
      add(String(c.prazo).slice(0, 10), { tipo: "prazo", id: c.id, titulo: c.campanha, marca: c.cliente, feito: c.status === "Entregue" });
    });
  }
  const ordem = { gravar: 0, editar: 1, postar: 2, prazo: 3 };
  Object.keys(mapa).forEach(k => mapa[k].sort((a, b) => (ordem[a.tipo] - ordem[b.tipo]) || String(a.titulo).localeCompare(String(b.titulo), "pt-BR")));
  return mapa;
}
const rotuloItem = i => (i.tipo === "prazo" ? "Prazo: " : "") + i.titulo;

function telaCalendario() {
  const { ano, mes } = ui.cal, hoje = hojeISO();
  const primeiro = new Date(ano, mes, 1), ultimo = new Date(ano, mes + 1, 0);
  const desloc = (primeiro.getDay() + 6) % 7; // segunda = 0
  const semanas = Math.ceil((desloc + ultimo.getDate()) / 7);
  const inicio = new Date(ano, mes, 1 - desloc);
  const itens = itensDoCalendario();

  let celulas = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(n => '<div class="cab-dia">' + n + "</div>").join("");
  for (let i = 0; i < semanas * 7; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i), k = iso(d);
    const lista = itens[k] || [];
    celulas += '<div class="dia' + (d.getMonth() !== mes ? " fora" : "") + (k === hoje ? " hoje" : "") + '" data-acao="diaNovo" data-data="' + k + '">' +
      '<span class="n">' + d.getDate() + "</span>" +
      '<button class="mais-dia" data-acao="diaNovo" data-data="' + k + '" aria-label="Adicionar em ' + fmtData(k) + '" title="Adicionar neste dia">' + ic("plus") + "</button>" +
      lista.slice(0, 3).map(it => '<button class="it ' + it.tipo + (it.feito ? " feito" : "") + '" data-acao="itemCal" data-tipo="' + it.tipo + '" data-id="' + esc(it.id) + '" title="' + esc(rotuloItem(it) + (it.marca ? " | " + it.marca : "")) + '">' + esc(rotuloItem(it)) + "</button>").join("") +
      (lista.length > 3 ? '<button class="mais-n" data-acao="diaVer" data-data="' + k + '">+' + (lista.length - 3) + " mais</button>" : "") + "</div>";
  }

  /* "Ficou pra trás": o que passou do dia e não foi feito. */
  const atrasados = [];
  estado.calendario.forEach(c => { if (c.data && c.status !== "feito" && String(c.data).slice(0, 10) < hoje) atrasados.push({ tipo: c.tipo, id: c.id, titulo: c.titulo, marca: c.marca, data: String(c.data).slice(0, 10) }); });
  estado.campanhas.forEach(c => { if (c.prazo && c.status !== "Entregue" && String(c.prazo).slice(0, 10) < hoje) atrasados.push({ tipo: "prazo", id: c.id, titulo: c.campanha, marca: c.cliente, data: String(c.prazo).slice(0, 10) }); });
  atrasados.sort((a, b) => a.data.localeCompare(b.data));

  const filtros = [["todos", "Todos"], ["gravar", "Gravar"], ["editar", "Editar"], ["postar", "Postar"], ["prazo", "Prazos"]];
  $("#tela").innerHTML =
    '<div class="cartao"><div class="cal-topo">' +
    '<button class="btn pequeno" data-acao="mesAnterior" aria-label="Mês anterior">' + ic("chevL") + "</button>" +
    "<h2>" + esc(primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })) + "</h2>" +
    '<button class="btn pequeno" data-acao="mesSeguinte" aria-label="Próximo mês">' + ic("chevR") + "</button>" +
    '<button class="btn pequeno" data-acao="esteMes">Este mês</button><span style="flex:1"></span>' +
    '<div class="chips" role="group" aria-label="Filtrar por tipo">' + filtros.map(f => '<button class="' + (ui.calFiltro === f[0] ? "ativo" : "") + '" data-acao="filtroCal" data-tipo="' + f[0] + '">' + f[1] + "</button>").join("") + "</div>" +
    '<button class="btn amarelo" data-acao="diaNovo" data-data="' + hoje + '">' + ic("plus") + "Adicionar</button></div>" +
    '<div class="cal">' + celulas + "</div>" +
    '<p class="dica">Passe o mouse num dia e clique no "+" para adicionar. Os prazos das campanhas aparecem sozinhos aqui.</p></div>' +
    '<div class="cartao lista-atraso"><div class="cab"><h2>Ficou pra trás</h2></div>' +
    (atrasados.length
      ? atrasados.map(a => {
          const dias = diasEntre(hoje, a.data);
          return '<div class="linha">' + pill(a.tipo, a.tipo === "prazo" ? "Prazo" : (TIPOS_CAL.find(t => t[0] === a.tipo) || ["", a.tipo])[1]) +
            '<div class="grande"><b>' + esc(a.titulo) + "</b><small>" + esc(a.marca || "") + (a.marca ? " | " : "") + "era para " + fmtData(a.data) + "</small></div>" +
            '<span class="etq atraso">há ' + plural(dias, "dia", "dias") + "</span>" +
            (a.tipo === "prazo"
              ? '<button class="btn pequeno" data-acao="itemCal" data-tipo="prazo" data-id="' + esc(a.id) + '">Abrir</button>'
              : '<button class="btn pequeno" data-acao="marcarFeito" data-id="' + esc(a.id) + '">Marcar feito</button>') + "</div>";
        }).join("")
      : '<p class="vazio">Nada atrasado. Está tudo em dia.</p>') + "</div>";
}
ACOES.mesAnterior = () => { ui.cal.mes--; if (ui.cal.mes < 0) { ui.cal.mes = 11; ui.cal.ano--; } desenhar(); };
ACOES.mesSeguinte = () => { ui.cal.mes++; if (ui.cal.mes > 11) { ui.cal.mes = 0; ui.cal.ano++; } desenhar(); };
ACOES.esteMes = () => { const h = new Date(); ui.cal = { ano: h.getFullYear(), mes: h.getMonth() }; desenhar(); };
ACOES.filtroCal = el => { ui.calFiltro = el.dataset.tipo; desenhar(); };

function camposCalendario() {
  return [
    { k: "titulo", rotulo: "O que fazer", tipo: "texto", obrigatorio: true, inteira: true },
    { k: "marca", rotulo: "Marca", tipo: "texto", lista: Array.from(new Set(estado.marcas.map(m => m.nome).filter(Boolean))) },
    { k: "tipo", rotulo: "Tipo", tipo: "select", opcoes: TIPOS_CAL },
    { k: "data", rotulo: "Data", tipo: "data", obrigatorio: true },
    { k: "status", rotulo: "Situação", tipo: "select", opcoes: [["a fazer", "A fazer"], ["feito", "Feito"]] }
  ];
}
ACOES.diaNovo = (el, e) => {
  if (e) e.stopPropagation();
  abrirForm({
    titulo: "Adicionar no calendário", campos: camposCalendario(), valores: { tipo: "gravar", status: "a fazer", data: el.dataset.data || hojeISO() },
    onSalvar: async d => { await gravar("calendario", null, d); await carregar(["calendario"]); desenhar(); avisar("Adicionado ao calendário"); }
  });
};
function editarCalendario(id) {
  const c = estado.calendario.find(x => String(x.id) === String(id)); if (!c) return;
  abrirForm({
    titulo: "Editar item", campos: camposCalendario(), valores: c,
    aviso: c.exemplo ? "Este é um item de exemplo. Ao salvar com os seus dados, ele deixa de ser exemplo." : "",
    onSalvar: async d => { await gravar("calendario", c.id, d); await carregar(["calendario"]); desenhar(); avisar("Item salvo"); },
    onApagar: async () => { await remover("calendario", c.id); await carregar(["calendario"]); desenhar(); avisar("Item apagado"); }
  });
}
ACOES.itemCal = (el, e) => {
  if (e) e.stopPropagation();
  if (el.dataset.tipo === "prazo") editarCampanha(el.dataset.id); else editarCalendario(el.dataset.id);
};
ACOES.marcarFeito = async el => {
  if (await atualizarCampo("calendario", el.dataset.id, { status: "feito" })) { await carregar(["calendario"]); desenhar(); avisar("Marcado como feito"); }
};
ACOES.diaVer = (el, e) => {
  if (e) e.stopPropagation();
  const dia = el.dataset.data, lista = (itensDoCalendario()[dia] || []);
  abrirModal(fmtData(dia),
    '<div class="lista-atraso">' + lista.map(it =>
      '<div class="linha">' + pill(it.tipo, it.tipo === "prazo" ? "Prazo" : (TIPOS_CAL.find(t => t[0] === it.tipo) || ["", it.tipo])[1]) +
      '<div class="grande"><b' + (it.feito ? ' style="text-decoration:line-through"' : "") + ">" + esc(it.titulo) + "</b><small>" + esc(it.marca || "") + "</small></div>" +
      '<button class="btn pequeno" data-acao="itemCal" data-tipo="' + it.tipo + '" data-id="' + esc(it.id) + '">Abrir</button></div>').join("") + "</div>" +
    '<div class="rodape-modal"><span class="espaco"></span><button class="btn amarelo" data-acao="diaNovo" data-data="' + dia + '">' + ic("plus") + "Adicionar neste dia</button></div>");
};
TELAS.calendario = telaCalendario;

/* ===================================================================
   4D. CAMPANHAS
   =================================================================== */
const dirInicial = col => (col === "favorita" || col === "valor" || col === "qtd") ? -1 : 1;
function valorOrdem(c, col) {
  switch (col) {
    case "favorita": return c.favorita ? 1 : 0;
    case "status": return FUNIL.indexOf(c.status);        /* segue o funil, nunca o alfabeto */
    case "qtd": case "valor": return numero(c[col]);
    case "prazo": return c.prazo ? String(c.prazo).slice(0, 10) : "";
    case "pagamento": return c.pagamento === "pago" ? 1 : 0;
    default: return String(c[col] || "").toLocaleLowerCase("pt-BR");
  }
}
function campanhasFiltradas() {
  const q = ui.cBusca.trim().toLowerCase();
  let l = estado.campanhas.filter(c => {
    if (ui.cFiltro === "ativas" && !c.ativa) return false;
    if (ui.cFiltro === "finalizadas" && c.ativa) return false;
    if (!q) return true;
    return [c.campanha, c.cliente].some(x => String(x || "").toLowerCase().indexOf(q) > -1);
  });
  const { col, dir } = ui.cOrdem;
  l = l.slice().sort((a, b) => {
    const va = valorOrdem(a, col), vb = valorOrdem(b, col);
    if (col === "prazo") { if (!va && !vb) return 0; if (!va) return 1; if (!vb) return -1; } // sem prazo vai sempre para o fim
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return l;
}
function avisoPrazo(c) {
  if (!c.prazo || c.status === "Entregue") return ""; // entregue não recebe aviso
  const dias = diasEntre(String(c.prazo).slice(0, 10), hojeISO());
  if (dias < 0) return '<span class="etq atraso">' + plural(-dias, "dia", "dias") + " de atraso</span>";
  if (dias <= 3) return '<span class="etq perto">' + (dias === 0 ? "vence hoje" : "vence em " + plural(dias, "dia", "dias")) + "</span>";
  return "";
}
function desenharListaCampanhas() {
  const lista = campanhasFiltradas();
  const cabecalho = [["favorita", ""], ["campanha", "Campanha"], ["cliente", "Cliente"], ["tipo", "Tipo"], ["status", "Status"], ["qtd", "Qtd"], ["valor", "Valor"], ["prazo", "Prazo"], ["pagamento", "Pagamento"]];
  if (!estado.campanhas.length) { $("#listaCampanhas").innerHTML = '<p class="vazio">Nenhuma campanha ainda. Clique em "Adicionar campanha" para começar.</p>'; return; }
  $("#listaCampanhas").innerHTML = '<div class="rolagem"><table class="tabela"><thead><tr>' +
    cabecalho.map(h => {
      const ativo = ui.cOrdem.col === h[0];
      const seta = ativo ? (ui.cOrdem.dir === 1 ? "↑" : "↓") : "↕";
      return '<th class="' + (h[0] === "qtd" || h[0] === "valor" ? "num" : "") + '"><button class="' + (ativo ? "ativo" : "") + '" data-acao="ordenar" data-col="' + h[0] + '" aria-label="Ordenar por ' + (h[1] || "favorita") + '">' + esc(h[1] || "★") + ' <span class="seta">' + seta + "</span></button></th>";
    }).join("") + "</tr></thead><tbody>" +
    (lista.length ? lista.map(c =>
      '<tr class="clicavel' + (c.favorita ? " favorita" : "") + '" data-acao="editarCampanha" data-id="' + esc(c.id) + '">' +
      '<td><button class="icone-btn" data-acao="favoritar" data-id="' + esc(c.id) + '" aria-label="' + (c.favorita ? "Tirar dos destaques" : "Destacar") + '" style="color:' + (c.favorita ? "#d29a00" : "") + '">' + ic("star", !!c.favorita) + "</button></td>" +
      "<td><b>" + esc(c.campanha) + "</b>" + etiquetaExemplo(c) + "</td><td>" + esc(c.cliente || "") + "</td>" +
      "<td>" + pill(c.tipo, c.tipo) + "</td><td>" + pill(c.status, c.status) + "</td>" +
      '<td class="num">' + numero(c.qtd) + '</td><td class="num">' + moeda(c.valor) + "</td>" +
      "<td>" + esc(fmtData(c.prazo)) + avisoPrazo(c) + "</td><td>" + pill(c.pagamento, c.pagamento === "pago" ? "Pago" : "Pendente") + "</td></tr>").join("")
      : '<tr><td colspan="9" class="vazio">Nenhuma campanha encontrada com esse filtro.</td></tr>') +
    "</tbody></table></div>";
}

function telaCampanhas() {
  const todas = estado.campanhas;
  const total = todas.length, ativas = todas.filter(c => c.ativa).length;
  const valorTotal = todas.reduce((s, c) => s + numero(c.valor), 0);
  const videos = todas.reduce((s, c) => s + numero(c.qtd), 0);
  const ticket = videos > 0 ? valorTotal / videos : 0; // nunca divide por zero
  const receber = todas.filter(c => c.pagamento !== "pago").reduce((s, c) => s + numero(c.valor), 0);
  const recebido = todas.filter(c => c.pagamento === "pago").reduce((s, c) => s + numero(c.valor), 0);

  $("#tela").innerHTML =
    '<div class="faixa-num">' +
    "<div><small>Total de campanhas</small><strong>" + total + "</strong></div>" +
    "<div><small>Ativas</small><strong>" + ativas + "</strong></div>" +
    "<div><small>Valor total</small><strong>" + moeda(valorTotal) + "</strong><em>ticket médio " + moeda(ticket) + " por vídeo</em></div>" +
    "<div><small>A receber</small><strong>" + moeda(receber) + "</strong><em>já recebido " + moeda(recebido) + "</em></div></div>" +
    '<div class="cartao"><div class="ferram">' +
    '<div class="chips" role="group" aria-label="Filtrar campanhas">' + [["todas", "Todas"], ["ativas", "Ativas"], ["finalizadas", "Finalizadas"]].map(f => '<button class="' + (ui.cFiltro === f[0] ? "ativo" : "") + '" data-acao="filtroCamp" data-tipo="' + f[0] + '">' + f[1] + "</button>").join("") + "</div>" +
    '<label class="campo-busca">' + ic("search") + '<input type="search" placeholder="Buscar campanha ou cliente" data-campo="cBusca" value="' + esc(ui.cBusca) + '" aria-label="Buscar campanha"></label><span class="espaco"></span>' +
    '<button class="btn" data-acao="baixarCampanhas">' + ic("download") + "Baixar CSV</button>" +
    '<button class="btn amarelo" data-acao="novaCampanha">' + ic("plus") + "Adicionar campanha</button></div>" +
    '<div id="listaCampanhas"></div></div>';
  desenharListaCampanhas();
}
CAMPOS.cBusca = el => { ui.cBusca = el.value; desenharListaCampanhas(); };
ACOES.filtroCamp = el => { ui.cFiltro = el.dataset.tipo; desenhar(); };
ACOES.ordenar = el => {
  const col = el.dataset.col;
  if (ui.cOrdem.col === col) ui.cOrdem.dir *= -1; else ui.cOrdem = { col: col, dir: dirInicial(col) };
  desenharListaCampanhas();
};
ACOES.favoritar = async el => {
  const c = estado.campanhas.find(x => String(x.id) === el.dataset.id); if (!c) return;
  if (await atualizarCampo("campanhas", c.id, { favorita: !c.favorita })) { await carregar(["campanhas"]); desenhar(); }
};

function camposCampanha() {
  return [
    { k: "campanha", rotulo: "Campanha", tipo: "texto", obrigatorio: true, inteira: true },
    { k: "cliente", rotulo: "Cliente", tipo: "texto", lista: Array.from(new Set(estado.marcas.map(m => m.nome).filter(Boolean))) },
    { k: "tipo", rotulo: "Tipo", tipo: "select", opcoes: [["Conteúdo", "Conteúdo"], ["Publicidade", "Publicidade"]] },
    { k: "status", rotulo: "Status", tipo: "select", opcoes: FUNIL.map(s => [s, s]) },
    { k: "qtd", rotulo: "Quantidade de vídeos", tipo: "numero" },
    { k: "valor", rotulo: "Valor (R$)", tipo: "numero", dica: "Ex: 1500 ou 1500,50" },
    { k: "prazo", rotulo: "Prazo de entrega", tipo: "data" },
    { k: "pagamento", rotulo: "Pagamento", tipo: "select", opcoes: [["pendente", "Pendente"], ["pago", "Pago"]] },
    { k: "ativa", rotulo: "Campanha ativa", tipo: "caixa" },
    { k: "favorita", rotulo: "Destacar com estrela", tipo: "caixa" }
  ];
}
ACOES.novaCampanha = () => abrirForm({
  titulo: "Adicionar campanha", campos: camposCampanha(), valores: { tipo: "Conteúdo", status: "Briefing", qtd: 1, valor: 0, pagamento: "pendente", ativa: true, favorita: false },
  onSalvar: async d => { await gravar("campanhas", null, d); await carregar(["campanhas"]); desenhar(); avisar("Campanha adicionada"); }
});
function editarCampanha(id) {
  const c = estado.campanhas.find(x => String(x.id) === String(id)); if (!c) return;
  abrirForm({
    titulo: "Editar campanha", campos: camposCampanha(), valores: c,
    aviso: c.exemplo ? "Esta é uma campanha de exemplo. Ao salvar com os seus dados, ela deixa de ser exemplo." : "",
    onSalvar: async d => { await gravar("campanhas", c.id, d); await carregar(["campanhas"]); desenhar(); avisar("Campanha salva"); },
    onApagar: async () => { await remover("campanhas", c.id); await carregar(["campanhas"]); desenhar(); avisar("Campanha apagada"); }
  });
}
ACOES.editarCampanha = el => editarCampanha(el.dataset.id);
ACOES.baixarCampanhas = () => {
  const lista = campanhasFiltradas();
  if (!lista.length) { avisar("Não há campanhas para baixar", "erro"); return; }
  baixarCSV("campanhas-" + hojeISO() + ".csv",
    ["Campanha", "Cliente", "Tipo", "Status", "Qtd", "Valor", "Prazo", "Pagamento", "Ativa", "Favorita"],
    lista.map(c => [c.campanha, c.cliente, c.tipo, c.status, numero(c.qtd), numero(c.valor).toFixed(2).replace(".", ","), fmtData(c.prazo), c.pagamento === "pago" ? "Pago" : "Pendente", c.ativa ? "Sim" : "Não", c.favorita ? "Sim" : "Não"]));
};
TELAS.campanhas = telaCampanhas;

/* ===================================================================
   4E. CHECKLIST PORTFÓLIO (conteúdo vem de js/biblioteca.js, sem alterar nada)
   =================================================================== */
const CORES_REF = { coral: "#f9b79a", rosa: "#f7b8d8", mostarda: "#f2d27a", terra: "#d9b08c", oliva: "#c9d59a", areia: "#efe0c0" };
const idYoutube = url => ((String(url || "").match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/)) || [])[1];

function telaChecklist() {
  const B = window.Biblioteca;
  const subs = [["checklist", "Checklist do portfólio"], ["refs", "Referências de vídeo"], ["roteiros", "Roteiros"], ["ideias", "Ideias por nicho"], ["revisar", "Revisar meu roteiro"]];
  const barra = '<div class="subabas" role="tablist">' + subs.map(s => '<button role="tab" class="' + (ui.cl.sub === s[0] ? "ativo" : "") + '" aria-selected="' + (ui.cl.sub === s[0]) + '" data-acao="subaba" data-sub="' + s[0] + '">' + s[1] + "</button>").join("") + "</div>";
  if (!B) {
    $("#tela").innerHTML = barra + '<div class="cartao"><p class="vazio">Não achei o arquivo js/biblioteca.js. Confira se ele foi publicado junto com o painel. O resto do painel continua funcionando.</p></div>';
    return;
  }
  const corpo = { checklist: subChecklist, refs: subRefs, roteiros: subRoteiros, ideias: subIdeias, revisar: subRevisar }[ui.cl.sub](B);
  $("#tela").innerHTML = barra + corpo;
  if (ui.cl.sub === "revisar") ligarRevisao();
}
ACOES.subaba = el => { ui.cl.sub = el.dataset.sub; desenhar(); };

/* --- Sub-aba 1: checklist do portfólio --- */
function subChecklist(B) {
  let totalItens = 0, feitos = 0;
  B.CHECKLIST.forEach(s => s.itens.forEach((_, i) => { totalItens++; if (estado.marcados[s.id + ":" + i]) feitos++; }));
  const pct = totalItens ? Math.round(feitos / totalItens * 100) : 0;
  return '<div class="cartao"><div class="cab"><h2>Pronto no geral</h2><span>' + feitos + " de " + totalItens + " (" + pct + '%)</span></div><div class="prog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div></div>' +
    B.CHECKLIST.map(s => {
      const f = s.itens.filter((_, i) => estado.marcados[s.id + ":" + i]).length, p = s.itens.length ? Math.round(f / s.itens.length * 100) : 0;
      return '<details class="sanfona" data-id="ck-' + esc(s.id) + '"' + (ui.cl.abertos["ck-" + s.id] ? " open" : "") + '><summary><span style="font-size:20px">' + esc(s.emoji) + '</span><span class="tit"><b>' + esc(s.nome) + "</b><small>" + esc(s.resumo) + '</small></span><span class="mini-prog"><span>' + f + "/" + s.itens.length + '</span><span class="prog"><i style="width:' + p + '%"></i></span></span></summary>' +
        '<div class="miolo"><p class="porque">' + esc(s.porque) + "</p>" +
        s.itens.map((it, i) => '<label class="item-check"><input type="checkbox" data-campo="marcar" data-evento="change" data-chave="' + esc(s.id + ":" + i) + '"' + (estado.marcados[s.id + ":" + i] ? " checked" : "") + '><span><b>' + esc(it.t) + "</b><small>" + esc(it.d) + "</small></span></label>").join("") + "</div></details>";
    }).join("");
}
CAMPOS.marcar = async el => {
  const chave = el.dataset.chave, marcar = el.checked, antes = !!estado.marcados[chave];
  if (marcar) estado.marcados[chave] = true; else delete estado.marcados[chave];
  desenhar();
  let r;
  try { r = marcar ? await db.from("marcados").upsert({ chave: chave, marcado: true, atualizado_em: new Date().toISOString() }) : await db.from("marcados").delete().eq("chave", chave); }
  catch (e) { r = { error: e }; }
  if (r.error) {
    if (antes) estado.marcados[chave] = true; else delete estado.marcados[chave];
    estado.problemas.marcados = traduzirErro(r.error, "marcados");
    desenhar(); avisar("Não consegui salvar essa marcação. " + traduzirErro(r.error, "marcados"), "erro");
  }
};

/* --- Sub-aba 2: referências de vídeo --- */
function subRefs(B) {
  const lista = B.REFERENCIAS.filter(r => (ui.cl.estilo === "todos" || r.estilo === ui.cl.estilo) && (ui.cl.aud === "todas" || r.audiencia === ui.cl.aud));
  return '<div class="ferram"><div class="chips" role="group" aria-label="Filtrar por estilo">' + ["todos"].concat(B.ESTILOS || []).map(e => '<button class="' + (ui.cl.estilo === e ? "ativo" : "") + '" data-acao="filtroEstilo" data-estilo="' + esc(e) + '">' + (e === "todos" ? "Todos os estilos" : esc(e)) + "</button>").join("") + "</div>" +
    '<select class="sel" data-campo="refAud" data-evento="change" aria-label="Filtrar por público"><option value="todas">Todos os públicos</option>' + (B.AUDIENCIAS || []).map(a => '<option value="' + esc(a.v) + '"' + (ui.cl.aud === a.v ? " selected" : "") + ">" + esc(a.t) + "</option>").join("") + "</select></div>" +
    (lista.length ? '<div class="grade-refs">' + lista.map(r => {
      const id = idYoutube(r.youtube);
      return '<button class="ref" data-acao="abrirRef" data-id="' + esc(r.id) + '"><div class="capa" style="--c:' + (CORES_REF[r.cor] || "#ffe680") + '">' + (id ? '<img loading="lazy" src="https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg" alt="Capa do vídeo ' + esc(r.titulo) + '">' : "") + '<span class="emoji">' + esc(r.emoji) + '</span><span class="dur">' + esc(r.duracao) + '</span></div><div class="nome">' + esc(r.titulo) + '</div><div class="meta">' + esc(r.estilo) + " | " + esc(r.marca) + "</div></button>";
    }).join("") + "</div>" : '<div class="cartao"><p class="vazio">Nenhuma referência com esse filtro.</p></div>');
}
ACOES.filtroEstilo = el => { ui.cl.estilo = el.dataset.estilo; desenhar(); };
CAMPOS.refAud = el => { ui.cl.aud = el.value; desenhar(); };
ACOES.abrirRef = el => {
  const r = (window.Biblioteca.REFERENCIAS || []).find(x => x.id === el.dataset.id); if (!r) return;
  abrirModal(r.emoji + " " + r.titulo,
    '<div class="ficha"><p>' + pill("conversando", r.estilo) + " " + pill("lead", r.duracao) + " " + pill("cliente", r.marca) + " " + pill("parada", r.audiencia) + "</p>" +
    "<h3>O gancho</h3><blockquote>" + esc(r.gancho) + "</blockquote>" +
    "<h3>Por que funciona</h3><p>" + esc(r.porque) + "</p>" +
    "<h3>O diferencial</h3><p>" + esc(r.diferencial) + "</p>" +
    "<h3>O erro comum</h3><p>" + esc(r.erro) + "</p>" +
    "<h3>O roteiro em blocos de tempo</h3>" + (r.roteiro || []).map(b => '<div class="bloco-tempo"><span class="t">' + esc(b.t) + "</span><span>" + htmlSeguro(b.o) + "</span></div>").join("") +
    '<div class="rodape-modal"><span class="espaco"></span><a class="btn amarelo" href="' + esc(r.youtube) + '" target="_blank" rel="noopener">' + ic("link") + "Assistir o vídeo</a></div></div>", { largo: true });
};

/* --- Sub-aba 3: roteiros (tipos) --- */
function subRoteiros(B) {
  return B.TIPOS.map(t =>
    '<details class="sanfona" data-id="rt-' + esc(t.id) + '"' + (ui.cl.abertos["rt-" + t.id] ? " open" : "") + '><summary><span style="font-size:20px">' + esc(t.emoji) + '</span><span class="tit"><b>' + esc(t.nome) + "</b><small>" + esc(t.duracao) + "</small></span></summary>" +
    '<div class="miolo ficha"><h3>Quando usar</h3><p class="porque">' + esc(t.porque) + "</p><h3>Blocos de tempo</h3>" +
    (t.beats || []).map(b => '<div class="bloco-tempo"><span class="t">' + esc(b.t) + "</span><span>" + htmlSeguro(b.o) + "</span></div>").join("") +
    ((t.erros && t.erros.length) ? "<h3>Erros comuns</h3><ul class=\"dicas\">" + t.erros.map(e => "<li>" + esc(e) + "</li>").join("") + "</ul>" : "") + "</div></details>").join("");
}

/* --- Sub-aba 4: ideias por nicho --- */
function subIdeias(B) {
  return ((B.COMO_USAR && B.COMO_USAR.length) ? '<div class="cartao"><div class="cab"><h2>Como usar</h2></div><ul class="dicas">' + B.COMO_USAR.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul></div>" : "") +
    B.NICHOS.map(n =>
      '<details class="sanfona" data-id="ni-' + esc(n.id) + '"' + (ui.cl.abertos["ni-" + n.id] ? " open" : "") + '><summary><span style="font-size:20px">' + esc(n.emoji) + '</span><span class="tit"><b>' + esc(n.nome) + "</b><small>" + n.ideias.length + " ideias</small></span></summary>" +
      '<div class="miolo">' + n.ideias.map(i => '<div class="ideia"><b>' + esc(i.t) + "</b><p>" + esc(i.gancho) + "</p></div>").join("") + "</div></details>").join("");
}

/* --- Sub-aba 5: revisar meu roteiro --- */
function subRevisar(B) {
  let rascunho = ""; try { rascunho = localStorage.getItem("rascunhoRoteiro") || ""; } catch (e) {}
  return '<div class="cartao"><div class="cab"><h2>Cole o seu roteiro aqui</h2><span class="dica" id="contaRoteiro" style="margin:0"></span></div>' +
    '<textarea class="roteiro" id="campoRoteiro" placeholder="Cole ou escreva o seu roteiro para conferir com os blocos abaixo" aria-label="Seu roteiro">' + esc(rascunho) + "</textarea>" +
    '<p class="dica">O texto fica só neste navegador. Não é enviado para o banco.</p></div>' +
    B.REVISAO.map((bl, bi) => {
      const f = bl.itens.filter((_, ii) => ui.revisao[bi + ":" + ii]).length;
      return '<div class="cartao"><div class="cab"><h2>' + esc(bl.emoji) + " " + esc(bl.bloco) + '</h2><span class="mini-prog"><span>' + f + "/" + bl.itens.length + "</span></span></div>" +
        bl.itens.map((it, ii) => '<label class="item-check"><input type="checkbox" data-campo="revisar" data-evento="change" data-chave="' + bi + ":" + ii + '"' + (ui.revisao[bi + ":" + ii] ? " checked" : "") + "><span><b>" + esc(it.t) + "</b><small>" + esc(it.d) + "</small></span></label>").join("") + "</div>";
    }).join("") +
    '<div class="ferram"><button class="btn" data-acao="limparRevisao">Limpar as marcações</button></div>';
}
function ligarRevisao() {
  const campo = $("#campoRoteiro"); if (!campo) return;
  const conta = () => {
    const n = (campo.value.trim().match(/\S+/g) || []).length;
    $("#contaRoteiro").textContent = plural(n, "palavra", "palavras") + (n ? ", cerca de " + Math.max(1, Math.round(n / 2.5)) + " segundos falando" : "");
  };
  campo.addEventListener("input", () => { conta(); try { localStorage.setItem("rascunhoRoteiro", campo.value); } catch (e) {} });
  conta();
}
CAMPOS.revisar = el => { ui.revisao[el.dataset.chave] = el.checked; const y = window.scrollY; desenhar(); window.scrollTo(0, y); };
ACOES.limparRevisao = () => { ui.revisao = {}; desenhar(); };

TELAS.checklist = telaChecklist;
