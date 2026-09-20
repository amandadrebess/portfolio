/* =====================================================================
   js/prospeccao.js | Aba PROSPECÇÃO do painel.
   Manda o seu e-mail de apresentação para várias marcas da aba Marcas,
   chamando cada uma pelo nome. Carregado depois do admin.js e usa as
   mesmas peças dele (estado, ACOES, CAMPOS, abrirModal, etc.).

   IMPORTANTE: aqui NÃO existe chave secreta. O envio é feito pela função
   "enviar-emails" do Supabase, que guarda a chave do Resend como segredo.
   ===================================================================== */
"use strict";
(function () {
  const EMAIL_DONA = "amandadrebes9@gmail.com";
  const CHAVE_LOCAL = "prospeccaoTexto";
  ICONES.envelope = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>';

  /* ---------------------------------------------------------------
     O TEXTO PADRÃO DO E-MAIL. Para mudar, é só editar na própria aba
     (o que você escrever fica guardado neste navegador).
     --------------------------------------------------------------- */
  const PADRAO = {
    modo: "texto",
    assunto: "Uma ideia de conteúdo para a {{marca}}",
    texto: "Oi, {{nome}}, tudo bem?\n\nSou a Amanda Drebes, UGC Creator em Curitiba. Eu crio vídeos com cara de recomendação de amiga, feitos para marcas como a {{marca}}.\n\nDá uma olhada no meu portfólio: https://amandadrebess.github.io/portfolio/\n\nSe fizer sentido, é só responder este e-mail que eu preparo uma proposta para você.\n\nUm abraço,\nAmanda Drebes\n@amandadrebess",
    html: "",
    botaoTxt: "Ver meu portfólio",
    botaoLink: "https://amandadrebess.github.io/portfolio/"
  };
  function lerLocal() { try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "{}") || {}; } catch (e) { return {}; } }
  const P = Object.assign({}, PADRAO, lerLocal(), {
    lista: "selecionadas", envio: "auto", pular: true,
    envios: null, optouts: null, carregadoEm: 0, fila: null, busca: "", enviando: false
  });
  function guardar() {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ modo: P.modo, assunto: P.assunto, texto: P.texto, html: P.html, botaoTxt: P.botaoTxt, botaoLink: P.botaoLink })); } catch (e) { /* sem problema */ }
  }

  /* ---------------------------------------------------------------
     Nomes, troca de {{nome}} e {{marca}}, montagem do e-mail
     --------------------------------------------------------------- */
  const primeiroNome = m => String(m || "").trim().replace(/^@/, "").split(/\s+/)[0] || "";
  const trocar = (t, marca, comoHtml) => {
    const f = comoHtml ? esc : (x => x);
    return String(t).replace(/\{\{\s*nome\s*\}\}/gi, () => f(primeiroNome(marca))).replace(/\{\{\s*marca\s*\}\}/gi, () => f(String(marca || "").trim()));
  };
  const linkSeguro = u => { u = String(u || "").trim(); return /^(https?:\/\/|mailto:)/i.test(u) ? u : ""; };

  function comLinks(t) {
    return t.replace(/(https?:\/\/[^\s<]+)/g, u => {
      let fim = ""; const m = u.match(/[.,;:!?)]+$/);
      if (m) { fim = m[0]; u = u.slice(0, -fim.length); }
      return '<a href="' + u + '" style="color:#1160b8">' + u + "</a>" + fim;
    });
  }
  const RODAPE_TEXTO = "Se você não quiser receber mais e-mails meus, é só responder este e-mail com a palavra SAIR.";

  /* MODO 1: pega o texto simples e monta um e-mail limpo. */
  function htmlSimples() {
    const partes = esc(String(P.texto).replace(/\r/g, "")).split(/\n{2,}/).map(x => x.trim()).filter(Boolean)
      .map(x => '<p style="margin:0 0 16px 0">' + comLinks(x).replace(/\n/g, "<br>") + "</p>").join("");
    const link = linkSeguro(P.botaoLink), txt = String(P.botaoTxt || "").trim();
    const botao = txt && link ? '<p style="margin:24px 0"><a href="' + esc(link) + '" style="display:inline-block;background:#1160b8;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">' + esc(txt) + "</a></p>" : "";
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body style="margin:0;padding:0;background:#ffffff"><div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1f2a44">' +
      partes + botao + '<p style="margin:28px 0 0 0;font-size:12px;line-height:1.5;color:#7a8096">' + RODAPE_TEXTO + "</p></div></body></html>";
  }
  const htmlAtual = () => P.modo === "html" ? P.html : htmlSimples();

  function htmlParaTexto(h) {
    const doc = new DOMParser().parseFromString(String(h), "text/html");
    doc.querySelectorAll("style,script").forEach(n => n.remove());
    doc.querySelectorAll("a").forEach(a => { const href = a.getAttribute("href"); if (href && a.textContent.trim() !== href) a.textContent = a.textContent.trim() + " (" + href + ")"; });
    doc.querySelectorAll("br").forEach(b => b.replaceWith("\n"));
    doc.querySelectorAll("p,div,h1,h2,h3,li,tr").forEach(n => n.append("\n"));
    return (doc.body.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function textoPlano(marca) {
    if (P.modo === "texto") {
      let t = String(P.texto).replace(/\r/g, "").trim();
      if (String(P.botaoTxt).trim() && linkSeguro(P.botaoLink)) t += "\n\n" + P.botaoTxt.trim() + ": " + P.botaoLink.trim();
      return trocar(t + "\n\n" + RODAPE_TEXTO, marca, false);
    }
    return trocar(htmlParaTexto(P.html), marca, false);
  }
  const marcaExemplo = () => { const m = estado.marcas.find(x => emailDe(x.email)); return m ? m.nome : "Marca Exemplo"; };

  /* ---------------------------------------------------------------
     Para quem vai: sempre a tabela de marcas que já existe
     --------------------------------------------------------------- */
  const optoutSet = () => new Set((P.optouts || []).map(o => String(o.email).toLowerCase()));
  const ROTULO_SIT = { lead: "Só os leads", conversando: "Só quem está conversando", cliente: "Só quem já é cliente", parada: "Só as paradas" };
  function situacoesExistentes() {
    const v = []; estado.marcas.forEach(m => { if (m.situacao && v.indexOf(m.situacao) < 0) v.push(m.situacao); });
    const ordem = SITUACOES.map(s => s[0]);
    return v.sort((a, b) => { const ia = ordem.indexOf(a), ib = ordem.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  }
  function opcoesLista() {
    const o = [["selecionadas", "Só as marcas selecionadas"], ["teste", "Só para mim (teste)"], ["todas", "Todas as marcas que têm e-mail"]];
    situacoesExistentes().forEach(s => o.push(["sit:" + s, ROTULO_SIT[s] || ("Situação: " + s)]));
    return o;
  }
  const rotuloLista = () => { const o = opcoesLista().find(x => x[0] === P.lista); return o ? o[1] : P.lista; };

  function calcularDestino() {
    if (P.lista === "teste") return { lista: [{ email: EMAIL_DONA, marca: "Marca Exemplo", id: null }], semEmail: 0, repetidos: 0, descad: 0 };
    let base;
    if (P.lista === "selecionadas") base = estado.marcas.filter(m => m.selecionada);
    else if (P.lista.indexOf("sit:") === 0) base = estado.marcas.filter(m => m.situacao === P.lista.slice(4));
    else base = estado.marcas;
    const fora = optoutSet(), vistos = new Set(), lista = [];
    let semEmail = 0, repetidos = 0, descad = 0;
    base.forEach(m => {
      const e = emailDe(m.email);
      if (!e) { semEmail++; return; }
      if (fora.has(e)) { descad++; return; }
      if (vistos.has(e)) { repetidos++; return; }
      vistos.add(e); lista.push({ email: e, marca: m.nome, id: m.id });
    });
    return { lista, semEmail, repetidos, descad };
  }

  /* ---------------------------------------------------------------
     Dados desta aba (registro de envios e descadastro)
     --------------------------------------------------------------- */
  const msgTabela = (e, t) => {
    const c = String((e && e.code) || "");
    return (c === "PGRST205" || c === "42P01") ? 'Não encontrei a tabela "' + t + '". Rode o arquivo disparo.sql no Supabase (passo 2 do guia da Prospecção).' : traduzirErro(e, t);
  };
  async function carregarProsp() {
    try {
      const a = await db.from("email_envios").select("id,email,assunto,status,erro,resend_id,criado_em").order("criado_em", { ascending: false }).limit(5000);
      if (a.error) { P.envios = null; estado.problemas.email_envios = msgTabela(a.error, "email_envios"); }
      else {
        /* Se o mesmo envio do Resend foi gravado duas vezes, conto uma só. */
        const vistosResend = new Set();
        P.envios = (a.data || []).filter(e => {
          if (!e.resend_id || e.resend_id === "rascunho") return true;
          if (vistosResend.has(e.resend_id)) return false;
          vistosResend.add(e.resend_id); return true;
        });
        delete estado.problemas.email_envios;
      }
      const b = await db.from("email_optout").select("email,motivo,criado_em").order("criado_em", { ascending: false }).limit(5000);
      if (b.error) { P.optouts = null; estado.problemas.email_optout = msgTabela(b.error, "email_optout"); } else { P.optouts = b.data || []; delete estado.problemas.email_optout; }
    } catch (e) { P.envios = P.envios || null; }
    P.carregadoEm = Date.now();
    if (typeof desenharAvisos === "function") desenharAvisos();
  }

  /* ---------------------------------------------------------------
     A TELA
     --------------------------------------------------------------- */
  const fmtNum = n => n === null || n === undefined ? "-" : Number(n).toLocaleString("pt-BR");
  const emailsUnicos = (lista, status) => new Set(lista.filter(e => e.status === status).map(e => String(e.email).toLowerCase())).size;

  function htmlCartoes() {
    const d = calcularDestino();
    const comEmail = estado.marcas.filter(m => emailDe(m.email)).length;
    const receberam = P.envios ? emailsUnicos(P.envios, "ok") : null;
    const falhas = P.envios ? emailsUnicos(P.envios, "erro") : null;
    const cartao = (cor, num, nome, ctx, acao) => '<div class="p-cartao" style="--cor:' + cor + '">' +
      (acao ? '<button type="button" data-acao="' + acao + '">' : "") + "<strong>" + fmtNum(num) + "</strong><b>" + nome + "</b>" + (ctx ? "<small>" + ctx + "</small>" : "") + (acao ? "</button>" : "") + "</div>";
    return cartao("#1160b8", comEmail, "Marcas com e-mail", "na sua base") +
      cartao("#2f9e6b", d.lista.length, "A enviar", esc(rotuloLista()).toLowerCase()) +
      cartao("#d29a00", receberam, "Já receberam", "pessoas diferentes") +
      cartao("#2a8fd8", falhas, "Falhas", "veja no histórico") +
      cartao("#e0616b", P.optouts ? P.optouts.length : null, "Descadastrados", "toque para ver ou adicionar", "pDescad");
  }
  function redesenharNumeros() {
    const c = $("#pCartoes"); if (c) c.innerHTML = htmlCartoes();
    const t = $("#pTotal"); if (t) { const n = P.envios ? P.envios.filter(e => e.status === "ok").length : 0; t.textContent = n ? fmtNum(n) : "-"; }
    desenharHistorico();
  }

  function htmlCapa() {
    const n = P.envios ? P.envios.filter(e => e.status === "ok").length : 0;
    return '<section class="p-capa"><div class="p-cab"><div class="p-icone">' + ic("envelope") + '</div><div><h2>Prospecção</h2>' +
      '<p class="sub">Envie o seu e-mail de apresentação para várias marcas de uma vez, chamando cada uma pelo nome.</p></div></div>' +
      '<div class="p-total"><strong id="pTotal">' + (n ? fmtNum(n) : "-") + "</strong><span>enviados até agora</span></div>" +
      '<div class="p-etqs"><span>Teste antes, sempre</span><span>A chave vive no Supabase</span><span>Quem responde SAIR sai da lista</span></div></section>';
  }

  function htmlListaDest() {
    return '<div class="cartao p-form"><div class="cab"><h2>1. Para quem vai</h2></div>' +
      '<p class="nota" style="margin-bottom:10px">Os e-mails vêm da sua aba <b>Marcas</b>. Não existe outro cadastro.</p>' +
      '<div class="campo"><label for="pLista">Lista de destinatários</label><select id="pLista" data-campo="pLista" data-evento="change">' +
      opcoesLista().map(o => '<option value="' + esc(o[0]) + '"' + (P.lista === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select></div>" +
      '<div class="p-dest" id="pDest"></div>' +
      '<div class="campo caixa" style="margin-top:12px"><label><input type="checkbox" data-campo="pPular" data-evento="change"' + (P.pular ? " checked" : "") + "> Pular quem já recebeu este mesmo assunto</label>" +
      '<div class="dica-campo">Serve para continuar um disparo que parou no meio, sem mandar duas vezes para a mesma pessoa.</div></div></div>';
  }

  function htmlEditor() {
    const modoTexto = P.modo === "texto";
    return '<div class="cartao p-form"><div class="cab"><h2>2. Escreva o e-mail</h2></div>' +
      '<div class="p-modos" role="group" aria-label="Modo de escrever"><button type="button" data-acao="pModo" data-modo="texto" class="' + (modoTexto ? "ativo" : "") + '">Texto fácil</button>' +
      '<button type="button" data-acao="pModo" data-modo="html" class="' + (modoTexto ? "" : "ativo") + '">HTML</button></div>' +
      '<div class="campo"><label for="pAssunto">Assunto</label><input id="pAssunto" data-campo="pAssunto" value="' + esc(P.assunto) + '" autocomplete="off"></div>' +
      (modoTexto
        ? '<div class="campo"><label for="pTexto">Texto do e-mail</label><textarea id="pTexto" class="texto" data-campo="pTexto">' + esc(P.texto) + "</textarea>" +
          '<div class="dica-campo">Escreva normalmente. Use {{nome}} (primeiro nome da marca) e {{marca}} (nome completo). Links viram clicáveis sozinhos.</div></div>' +
          '<div class="grade-form"><div class="campo"><label for="pBotaoTxt">Texto do botão (opcional)</label><input id="pBotaoTxt" data-campo="pBotaoTxt" value="' + esc(P.botaoTxt) + '"></div>' +
          '<div class="campo"><label for="pBotaoLink">Link do botão</label><input id="pBotaoLink" data-campo="pBotaoLink" value="' + esc(P.botaoLink) + '" placeholder="https://"></div></div>'
        : '<div class="campo"><label for="pHtml">HTML do e-mail</label><textarea id="pHtml" class="codigo" data-campo="pHtml" spellcheck="false">' + esc(P.html) + "</textarea>" +
          '<div class="dica-campo">Nesse modo sai exatamente o que você colar aqui. {{nome}} e {{marca}} continuam funcionando. O rodapé do SAIR precisa estar no HTML.</div></div>' +
          '<button type="button" class="btn" data-acao="pModelo">Começar do modelo pronto</button>') +
      "</div>";
  }

  function htmlEnviar() {
    const auto = P.envio === "auto";
    return '<div class="cartao p-form"><div class="cab"><h2>3. Enviar</h2></div>' +
      '<div class="p-modos" role="group" aria-label="Jeito de enviar"><button type="button" data-acao="pEnvio" data-envio="auto" class="' + (auto ? "ativo" : "") + '">Automático (Resend)</button>' +
      '<button type="button" data-acao="pEnvio" data-envio="rascunho" class="' + (auto ? "" : "ativo") + '">Rascunho (Gmail)</button></div>' +
      (auto
        ? '<p class="dica" style="margin-top:0">Primeiro mande o teste para você mesma. O disparo real pede confirmação antes de sair.</p>' +
          '<div class="ferram"><button type="button" class="btn" data-acao="pTeste">' + ic("envelope") + 'Enviar teste pra mim</button>' +
          '<button type="button" class="btn amarelo" data-acao="pDisparar">Disparar para as marcas</button></div><div id="pProg"></div>'
        : '<p class="dica" style="margin-top:0">Funciona sem Resend. Eu monto o e-mail de cada marca e você envia pelo seu Gmail, uma por vez.</p>' +
          '<div class="ferram"><button type="button" class="btn amarelo" data-acao="pFila">Montar fila de rascunhos</button></div>') +
      "</div>";
  }

  function htmlPrevia() {
    return '<aside class="p-previa"><div class="p-previa-topo"><h3>Como vai chegar</h3><button type="button" class="btn pequeno" data-acao="pTelaCheia">Ver em tela cheia</button></div>' +
      '<div class="p-palco"><div class="p-janela"><div class="p-jcab"><div class="p-avatar">A</div><div><b class="assunto" id="pvAssunto"></b>' +
      "<small>Amanda Drebes &lt;" + EMAIL_DONA + "&gt;</small><small>para você</small></div></div>" +
      '<iframe class="p-corpo" id="pvCorpo" sandbox="allow-same-origin" title="Prévia do e-mail"></iframe></div></div>' +
      '<p class="p-lembrete">Antes de disparar, mande o teste para você mesma e abra no celular.</p></aside>';
  }

  function htmlHistorico() {
    return '<div class="cartao"><div class="cab"><h2>Histórico de envios</h2>' +
      '<label class="campo-busca">' + ic("search") + '<input type="search" placeholder="Buscar por e-mail" data-campo="pBusca" value="' + esc(P.busca) + '" aria-label="Buscar no histórico"></label></div>' +
      '<div id="pHist"></div></div>';
  }

  function telaProspeccao() {
    if (P.enviando) return; /* não mexo na tela no meio de um disparo */
    const temEmail = estado.marcas.some(m => emailDe(m.email));
    $("#tela").innerHTML = '<div class="prosp">' + htmlCapa() + '<div class="p-cartoes" id="pCartoes">' + htmlCartoes() + "</div>" +
      (temEmail
        ? '<div class="p-grade"><div>' + htmlListaDest() + htmlEditor() + htmlEnviar() + '<div id="pFila"></div></div>' + htmlPrevia() + "</div>"
        : '<div class="cartao"><p class="vazio"><b>A sua base ainda está sem e-mail.</b> Cadastre ou importe a sua planilha na aba Marcas para começar a prospectar.</p>' +
          '<button type="button" class="btn amarelo" data-acao="irMarcas">Ir para a aba Marcas</button></div>') +
      htmlHistorico() + "</div>";
    if (temEmail) { atualizarPrevia(); desenharDest(); desenharFila(); }
    desenharHistorico();
    if (Date.now() - P.carregadoEm > 15000) {
      carregarProsp().then(() => { if (estado.aba === "prospeccao" && !P.enviando) { redesenharNumeros(); desenharDest(); } });
    }
  }
  TELAS.prospeccao = telaProspeccao;

  function atualizarPrevia() {
    const f = $("#pvCorpo"), a = $("#pvAssunto"); if (!f || !a) return;
    const marca = marcaExemplo();
    a.textContent = trocar(P.assunto || "(sem assunto)", marca, false);
    f.onload = () => { try { f.style.height = Math.max(320, f.contentDocument.documentElement.scrollHeight) + "px"; } catch (e) { /* segue */ } };
    f.srcdoc = trocar(htmlAtual() || "<p></p>", marca, true);
  }

  function desenharDest() {
    const el = $("#pDest"); if (!el) return;
    const d = calcularDestino(); el.className = "p-dest";
    let h = "";
    if (P.lista === "selecionadas") {
      if (!temColunaSel()) { el.classList.add("alerta"); h = "<b>Falta um passo no banco.</b> Rode o arquivo disparo.sql no Supabase para a seleção ficar salva."; }
      else if (!d.lista.length) { el.classList.add("alerta"); h = '<b>Nenhuma marca selecionada.</b> Escolha na aba Marcas quem vai receber. <button type="button" class="btn pequeno amarelo" data-acao="irMarcas" style="margin-left:6px">Ir para Marcas</button>'; }
    }
    if (!h) {
      h = "<b>" + plural(d.lista.length, "marca vai receber", "marcas vão receber") + "</b>" + (P.lista === "teste" ? " (só o seu e-mail)" : "") +
        (d.semEmail ? " · " + plural(d.semEmail, "ficou de fora por não ter e-mail", "ficaram de fora por não ter e-mail") : "") +
        (d.repetidos ? " · " + plural(d.repetidos, "repetida (mesmo e-mail, conta uma vez)", "repetidas (mesmo e-mail, contam uma vez)") : "") +
        (d.descad ? " · " + plural(d.descad, "descadastrada", "descadastradas") : "");
    }
    el.innerHTML = h;
  }

  function desenharHistorico() {
    const el = $("#pHist"); if (!el) return;
    if (P.envios === null) { el.innerHTML = '<p class="vazio">Ainda não consigo ler o registro de envios. Rode o arquivo disparo.sql no Supabase.</p>'; return; }
    const q = P.busca.trim().toLowerCase();
    const lista = P.envios.filter(e => !q || String(e.email).toLowerCase().indexOf(q) > -1);
    if (!lista.length) { el.innerHTML = '<p class="vazio">' + (P.envios.length ? "Nenhum envio com essa busca." : "Nenhum e-mail enviado ainda. Quando você enviar, tudo aparece aqui.") + "</p>"; return; }
    el.innerHTML = '<div class="rolagem"><table class="tabela"><thead><tr><th>Para quem</th><th>Assunto</th><th>Quando</th><th>Situação</th></tr></thead><tbody>' +
      lista.slice(0, 200).map(e => "<tr><td>" + esc(e.email) + '</td><td class="corta" title="' + esc(e.assunto) + '">' + esc(e.assunto) + "</td><td>" +
        esc(new Date(e.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })) + "</td><td>" +
        (e.status === "ok" ? pill("aprovado", "Enviado") : pill("atraso", "Erro") + (e.erro ? '<div class="dica" style="margin:2px 0 0">' + esc(e.erro) + "</div>" : "")) + "</td></tr>").join("") +
      "</tbody></table></div>" + (lista.length > 200 ? '<p class="dica">Mostrando os 200 mais recentes. Use a busca para achar os outros.</p>' : "");
  }

  /* ---------------------------------------------------------------
     Campos e botões
     --------------------------------------------------------------- */
  CAMPOS.pAssunto = el => { P.assunto = el.value; guardar(); atualizarPrevia(); };
  CAMPOS.pTexto = el => { P.texto = el.value; guardar(); atualizarPrevia(); };
  CAMPOS.pHtml = el => { P.html = el.value; guardar(); atualizarPrevia(); };
  CAMPOS.pBotaoTxt = el => { P.botaoTxt = el.value; guardar(); atualizarPrevia(); };
  CAMPOS.pBotaoLink = el => { P.botaoLink = el.value; guardar(); atualizarPrevia(); };
  CAMPOS.pLista = el => { P.lista = el.value; desenharDest(); redesenharNumeros(); };
  CAMPOS.pPular = el => { P.pular = el.checked; };
  CAMPOS.pBusca = el => { P.busca = el.value; desenharHistorico(); };

  ACOES.pModo = el => { P.modo = el.dataset.modo; guardar(); telaProspeccao(); };
  ACOES.pEnvio = el => { P.envio = el.dataset.envio; telaProspeccao(); };
  ACOES.pModelo = () => {
    if (String(P.html).trim() && !confirm("Isto troca o HTML que está no campo pelo modelo pronto. Continuar?")) return;
    P.html = htmlSimples(); guardar(); telaProspeccao();
  };
  ACOES.irMarcas = () => { fecharModal(); location.hash = "marcas"; };
  ACOES.pFecharModal = () => fecharModal();
  ACOES.pTelaCheia = () => {
    abrirModal("Prévia do e-mail", '<iframe class="p-tela-cheia" id="pvGrande" sandbox="allow-same-origin" title="Prévia em tela cheia"></iframe>', { largo: true });
    $("#pvGrande").srcdoc = trocar(htmlAtual() || "<p></p>", marcaExemplo(), true);
  };

  /* Janela de confirmação. Fechar no X ou no Esc conta como "não". */
  function confirmar(titulo, corpoHtml, sim, nao) {
    return new Promise(res => {
      abrirModal(titulo, corpoHtml + '<div class="rodape-modal"><span class="espaco"></span><button type="button" class="btn" id="cfNao">' + esc(nao) + '</button><button type="button" class="btn amarelo" id="cfSim">' + esc(sim) + "</button></div>");
      const fundo = $("#fundoModal");
      const obs = new MutationObserver(() => { if (!fundo.classList.contains("aberto")) { obs.disconnect(); res(false); } });
      obs.observe(fundo, { attributes: true, attributeFilter: ["class"] });
      $("#cfNao").onclick = () => { fecharModal(); res(false); };
      $("#cfSim").onclick = () => { fecharModal(); res(true); };
    });
  }
  function semSelecao() {
    abrirModal("Nenhuma marca selecionada",
      '<p>Você escolheu "só as marcas selecionadas", mas ainda não marcou nenhuma. Vá na aba Marcas, marque as caixinhas de quem vai receber e volte aqui.</p>' +
      '<div class="rodape-modal"><span class="espaco"></span><button type="button" class="btn" data-acao="pFecharModal">Fechar</button><button type="button" class="btn amarelo" data-acao="irMarcas">Ir para Marcas</button></div>');
  }

  /* ---------------------------------------------------------------
     Falar com o carteiro (função enviar-emails do Supabase)
     --------------------------------------------------------------- */
  async function pedirEnvio(corpo) {
    let r;
    try { r = await db.functions.invoke("enviar-emails", { body: corpo }); }
    catch (e) { throw new Error("Não consegui falar com o carteiro. Confira a internet."); }
    if (r.error) {
      let info = null, status = 0;
      try { status = r.error.context && r.error.context.status; info = r.error.context && r.error.context.json ? await r.error.context.json() : null; } catch (e) { /* sem detalhe */ }
      const cod = info && info.codigo;
      if (cod === "sem_chave") throw new Error("A chave do Resend ainda não foi guardada no Supabase. Faça o passo 3 do guia (segredo RESEND_API_KEY).");
      if (cod === "tabelas") throw new Error("Falta rodar o disparo.sql no Supabase (passo 2 do guia).");
      if (cod === "recusado" || cod === "nao_logada") throw new Error("O carteiro recusou. Entre no painel com o e-mail " + EMAIL_DONA + ".");
      if (status === 404 || !status) throw new Error("O carteiro (função enviar-emails) ainda não foi criado no Supabase. Faça o passo 4 do guia. Enquanto isso, use o modo Rascunho (Gmail).");
      throw new Error((info && info.erro) || r.error.message || "O carteiro devolveu um erro.");
    }
    return r.data || {};
  }

  function caixaResumo(tipo, html) { const el = $("#pProg"); if (el) el.innerHTML = '<div class="p-resumo ' + tipo + '">' + html + "</div>"; }

  ACOES.pTeste = async el => {
    if (P.enviando) return;
    if (!P.assunto.trim() || !htmlAtual().trim()) { avisar("Escreva o assunto e o texto do e-mail", "erro"); return; }
    el.disabled = true; caixaResumo("aviso", "Enviando o teste...");
    try {
      const r = await pedirEnvio({ teste: true, assunto: P.assunto, html: htmlAtual() });
      const falha = (r.resultados || []).find(x => x.status === "erro");
      if (r.enviados) caixaResumo("", "<b>Teste enviado para " + EMAIL_DONA + ".</b> Abra a caixa de entrada (olhe o spam também) e confira o nome no lugar certo. Depois abra no celular.");
      else caixaResumo("erro", "<b>O teste não saiu.</b> " + esc(falha && falha.erro ? falha.erro : "Confira o Resend."));
      carregarProsp().then(redesenharNumeros);
    } catch (e) { caixaResumo("erro", "<b>O teste não saiu.</b> " + esc(e.message)); }
    el.disabled = false;
  };

  async function marcarEnviadas(ids) {
    if (!ids.length) return;
    const agora = new Date().toISOString();
    for (let i = 0; i < ids.length; i += 100) {
      const r = await db.from("marcas").update({ email_enviado_em: agora, ultimo_contato: hojeISO() }).in("id", ids.slice(i, i + 100));
      if (r.error) { avisar("Enviei, mas não consegui marcar as marcas como enviadas: " + traduzirErro(r.error, "marcas"), "erro"); break; }
    }
    await carregar(["marcas"]);
  }

  ACOES.pDisparar = async () => {
    if (P.enviando) return;
    if (P.lista === "teste") { avisar('Para o teste use o botão "Enviar teste pra mim"', "erro"); return; }
    const d = calcularDestino();
    if (P.lista === "selecionadas" && !d.lista.length) { semSelecao(); return; }
    if (!d.lista.length) { avisar("Não há ninguém nesta lista com e-mail", "erro"); return; }
    if (!P.assunto.trim() || !htmlAtual().trim()) { avisar("Escreva o assunto e o texto do e-mail", "erro"); return; }
    if (P.modo === "html" && !/sair/i.test(P.html)) {
      const seguir = await confirmar("Falta o rodapé do SAIR", "<p>O HTML que você colou não tem a palavra <b>SAIR</b>. Sem ela, a marca não sabe como pedir para não receber mais. Quer enviar mesmo assim?</p>", "Enviar mesmo assim", "Voltar e corrigir");
      if (!seguir) return;
    }
    const ok = await confirmar("Confirmar o disparo", "<p>Vai para <b>" + plural(d.lista.length, "marca", "marcas") + "</b>, da lista <b>" + esc(rotuloLista()) + "</b>, e não dá pra desfazer.</p>" +
      '<p class="dica">Você já mandou o teste para você mesma e abriu no celular?</p>', "Enviar agora", "Cancelar");
    if (!ok) return;

    P.enviando = true;
    const total = d.lista.length, tam = 100;
    let env = 0, fal = 0, pul = 0, feitos = 0, parou = null;
    const idsOk = [];
    const barra = () => caixaResumo("aviso", "<b>Enviando... " + feitos + " de " + total + "</b>" + '<div class="p-barra"><i style="width:' + Math.round(feitos / total * 100) + '%"></i></div><span class="dica" style="margin:0">Não feche esta aba até terminar.</span>');
    barra();
    for (let i = 0; i < total; i += tam) {
      const lote = d.lista.slice(i, i + tam);
      let r;
      try { r = await pedirEnvio({ destinatarios: lote, assunto: P.assunto, html: htmlAtual(), pular_ja_enviados: P.pular }); }
      catch (e) { parou = { tipo: "erro", msg: e.message }; break; }
      env += r.enviados || 0; fal += r.falhas || 0; pul += r.pulados || 0;
      (r.resultados || []).forEach(x => { if (x.status === "ok" && x.id) idsOk.push(x.id); });
      feitos = i + lote.length - (r.restantes || 0);
      barra();
      if (r.cota_acabou) { parou = { tipo: "cota", faltam: (r.restantes || 0) + Math.max(0, total - (i + lote.length)) }; break; }
      if (r.sem_dominio) { parou = { tipo: "dominio" }; break; }
    }
    P.enviando = false;
    await marcarEnviadas(idsOk);
    await carregarProsp();

    const linha = "<br>Enviados: <b>" + env + "</b> · Falhas: <b>" + fal + "</b> · Pulados: <b>" + pul + "</b>";
    if (parou && parou.tipo === "cota") {
      caixaResumo("aviso", "<b>A cota diária do Resend acabou.</b> Foram enviados " + env + " e ficaram faltando " + parou.faltam + "." + linha +
        "<br><br>Volte amanhã, cole o mesmo assunto e o mesmo texto (eles ficam salvos neste navegador), deixe marcada a caixinha <b>Pular quem já recebeu este mesmo assunto</b> e dispare de novo. Ele manda só para os que faltaram.");
    } else if (parou && parou.tipo === "dominio") {
      caixaResumo("erro", "<b>O Resend só entrega e-mails para você mesma enquanto não houver um domínio seu verificado.</b> Nenhum e-mail saiu para as marcas." +
        "<br>Use o modo <b>Rascunho (Gmail)</b> por enquanto, ou verifique um domínio no Resend (veja o guia).");
    } else if (parou) {
      caixaResumo("erro", "<b>O disparo parou.</b> " + esc(parou.msg) + linha);
    } else {
      caixaResumo("", "<b>Disparo terminado.</b>" + linha);
    }
    redesenharNumeros(); desenharDest();

    if (P.lista === "selecionadas" && estado.marcas.some(m => m.selecionada)) {
      const limpar = await confirmar("Limpar a seleção?", "<p>Quer desmarcar as marcas selecionadas? Se for mandar a mesma lista de novo, deixe como está.</p>", "Limpar seleção", "Manter selecionadas");
      if (limpar) { await ACOES.limparSelecao(); redesenharNumeros(); desenharDest(); }
    }
  };

  /* ---------------------------------------------------------------
     MODO RASCUNHO (plano B): fila para enviar pelo Gmail, sem Resend
     --------------------------------------------------------------- */
  function jaRecebeu(email, assunto) {
    return !!(P.envios && P.envios.some(e => e.status === "ok" && String(e.email).toLowerCase() === email && e.assunto === assunto));
  }
  ACOES.pFila = () => {
    const d = calcularDestino();
    if (P.lista === "selecionadas" && !d.lista.length) { semSelecao(); return; }
    let itens = d.lista;
    if (P.pular && P.lista !== "teste") itens = itens.filter(x => !jaRecebeu(x.email, trocar(P.assunto, x.marca, false)));
    if (!itens.length) { avisar("Ninguém na fila: todas já receberam este assunto ou a lista está vazia", "erro"); return; }
    P.fila = { itens, i: 0, enviadas: 0 };
    desenharFila();
    const el = $("#pFila"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  ACOES.pFilaFechar = () => { P.fila = null; desenharFila(); };
  ACOES.pFilaPular = () => { if (!P.fila) return; P.fila.i++; desenharFila(); };
  ACOES.pFilaCopiar = async () => {
    const a = $("#pFilaTexto"); if (!a) return;
    const ok = await copiarTexto(a.value);
    avisar(ok ? "Texto copiado" : "Não consegui copiar. Selecione o texto e use Ctrl+C.", ok ? "" : "erro");
  };
  ACOES.pFilaEnviada = async () => {
    const f = P.fila; if (!f || f.i >= f.itens.length) return;
    const x = f.itens[f.i], assunto = trocar(P.assunto, x.marca, false);
    if (P.lista !== "teste") {
      const r = await db.from("email_envios").insert({ email: x.email, assunto, status: "ok", erro: null, resend_id: "rascunho", marca_id: x.id || null });
      if (r.error) avisar("Marquei aqui, mas não consegui gravar no histórico: " + msgTabela(r.error, "email_envios"), "erro");
      if (x.id) await marcarEnviadas([x.id]);
      carregarProsp().then(redesenharNumeros);
    }
    f.enviadas++; f.i++; desenharFila();
  };

  function desenharFila() {
    const el = $("#pFila"); if (!el) return;
    const f = P.fila;
    if (!f) { el.innerHTML = ""; return; }
    if (f.i >= f.itens.length) {
      el.innerHTML = '<div class="cartao p-fila"><div class="cab"><h2>Fila terminada</h2><button type="button" class="btn pequeno" data-acao="pFilaFechar">Fechar</button></div><p>Você marcou <b>' + f.enviadas + "</b> como enviadas. Elas já aparecem no histórico e nas suas marcas.</p></div>";
      return;
    }
    const x = f.itens[f.i], assunto = trocar(P.assunto, x.marca, false), texto = textoPlano(x.marca);
    let corpoUrl = texto, cortado = false;
    while (encodeURIComponent(corpoUrl).length > 1800 && corpoUrl.length > 100) { corpoUrl = corpoUrl.slice(0, Math.floor(corpoUrl.length * 0.85)); cortado = true; }
    const gmail = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(x.email) + "&su=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(corpoUrl);
    el.innerHTML = '<div class="cartao p-fila"><div class="cab"><h2>Fila de rascunhos</h2><span class="dica" style="margin:0">' + (f.i + 1) + " de " + f.itens.length + '</span><button type="button" class="btn pequeno" data-acao="pFilaFechar">Fechar fila</button></div>' +
      '<div class="p-barra"><i style="width:' + Math.round(f.i / f.itens.length * 100) + '%"></i></div>' +
      '<div class="linha-info"><span>Marca</span><b>' + esc(x.marca) + "</b><span>Para</span><b>" + esc(x.email) + "</b><span>Assunto</span><b>" + esc(assunto) + "</b></div>" +
      '<textarea id="pFilaTexto" readonly>' + esc(texto) + "</textarea>" +
      (cortado ? '<p class="dica">O texto é longo: no Gmail vai só a primeira parte. Use "Copiar texto" para colar o e-mail inteiro.</p>' : "") +
      '<div class="ferram" style="margin-top:10px"><button type="button" class="btn" data-acao="pFilaCopiar">' + ic("copy") + 'Copiar texto</button>' +
      '<a class="btn" href="' + esc(gmail) + '" target="_blank" rel="noopener">' + ic("link") + 'Abrir no Gmail</a><span class="espaco"></span>' +
      '<button type="button" class="btn" data-acao="pFilaPular">Pular</button><button type="button" class="btn amarelo" data-acao="pFilaEnviada">Marcar como enviada</button></div>' +
      '<p class="dica">Abra no Gmail, clique em enviar lá e depois volte aqui para marcar como enviada. Ela sai da fila e vira enviada na sua base.</p></div>';
  }

  /* ---------------------------------------------------------------
     Descadastro (quem respondeu SAIR)
     --------------------------------------------------------------- */
  function abrirDescad() {
    const lista = P.optouts;
    abrirModal("Descadastrados",
      '<p class="nota">Quem responder SAIR entra aqui e nunca mais recebe e-mail seu, em nenhum disparo. Cole abaixo o e-mail de quem pediu para sair.</p>' +
      '<div class="ferram"><input id="optNovo" type="email" placeholder="email@marca.com" style="flex:1;min-width:200px;border:1px solid var(--linha);border-radius:12px;padding:8px 11px" autocomplete="off">' +
      '<button type="button" class="btn amarelo" data-acao="pAddOptout">Adicionar</button></div>' +
      (lista === null ? '<p class="vazio">Rode o arquivo disparo.sql no Supabase para usar o descadastro.</p>'
        : lista.length ? '<div class="rolagem"><table class="tabela"><thead><tr><th>E-mail</th><th>Desde</th></tr></thead><tbody>' + lista.map(o => "<tr><td>" + esc(o.email) + "</td><td>" + esc(fmtData(String(o.criado_em).slice(0, 10))) + "</td></tr>").join("") + "</tbody></table></div>"
          : '<p class="vazio">Ninguém pediu para sair ainda.</p>'), { largo: false });
  }
  ACOES.pDescad = () => abrirDescad();
  ACOES.pAddOptout = async () => {
    const email = emailDe($("#optNovo").value);
    if (!email) { avisar("Escreva um e-mail válido", "erro"); return; }
    const r = await db.from("email_optout").insert({ email, motivo: "Pediu SAIR" });
    if (r.error && String(r.error.code) !== "23505") { avisar(msgTabela(r.error, "email_optout"), "erro"); return; }
    await carregarProsp(); abrirDescad(); redesenharNumeros(); desenharDest();
    avisar(r.error ? "Esse e-mail já estava descadastrado" : "Descadastrado. Ele não recebe mais nada.");
  };
})();
