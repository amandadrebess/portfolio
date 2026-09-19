/* =====================================================================
   js/banco.js
   As informações do seu Supabase ficam SÓ AQUI. Todas as páginas usam
   este arquivo. Se um dia mudar o projeto, troque só as duas linhas abaixo.

   A chave abaixo é a chave PÚBLICA (publishable). Ela pode ficar no site.
   Quem protege os seus dados é a tranca (RLS) criada pelo banco.sql.
   NUNCA coloque aqui a chave secreta (service_role / secret).
   ===================================================================== */
(function () {
  var URL_DO_PROJETO = "https://vbsqxoafrdbviwgyulus.supabase.co";
  var CHAVE_PUBLICA = "sb_publishable_5p2czdlpXS7CaSnbEXatSg_C2nSa5dC";
  var EMAIL_DA_DONA = "amandadrebes9@gmail.com";

  var BANCO = { url: URL_DO_PROJETO, chave: CHAVE_PUBLICA, email: EMAIL_DA_DONA };

  /* Cliente completo do Supabase. Só existe nas páginas que carregam a
     biblioteca do Supabase por CDN (login e admin). */
  BANCO.criarCliente = function (opcoes) {
    if (!window.supabase || !window.supabase.createClient) return null;
    return window.supabase.createClient(URL_DO_PROJETO, CHAVE_PUBLICA, opcoes);
  };
  window.db = BANCO.criarCliente();

  /* ---------------------------------------------------------------
     Versão leve para o portfólio (sem carregar biblioteca nenhuma).
     Serve para: ler os vídeos, enviar contato e registrar visita.
     --------------------------------------------------------------- */
  BANCO.rest = function (caminho, opcoes) {
    opcoes = opcoes || {};
    var cabecalhos = { apikey: CHAVE_PUBLICA, "Content-Type": "application/json" };
    if (opcoes.headers) for (var k in opcoes.headers) cabecalhos[k] = opcoes.headers[k];
    return fetch(URL_DO_PROJETO + "/rest/v1/" + caminho, {
      method: opcoes.method || "GET",
      headers: cabecalhos,
      body: opcoes.body,
      keepalive: !!opcoes.keepalive
    });
  };

  /* Vídeos visíveis, pela "janelinha" segura criada no banco.sql. */
  BANCO.videosDoSite = function () {
    return BANCO.rest("rpc/videos_do_site", { method: "POST", body: "{}" }).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      return r.json();
    });
  };

  /* Formulário de contato: entra na tabela "marcas" como lead. */
  BANCO.enviarContato = function (dados) {
    return BANCO.rest("marcas", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(dados)
    }).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      return true;
    });
  };

  /* De onde a pessoa veio: link com ?utm_source=, ou o site anterior. */
  function descobrirOrigem() {
    try {
      var p = new URLSearchParams(location.search);
      var marcado = p.get("utm_source") || p.get("origem");
      if (marcado) return marcado.slice(0, 60);
      if (!document.referrer) return "Direto";
      var host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host === location.hostname) return "Interno";
      var conhecidos = [["instagram", "Instagram"], ["google", "Google"], ["facebook", "Facebook"],
        ["youtube", "YouTube"], ["wa.me", "WhatsApp"], ["whatsapp", "WhatsApp"], ["tiktok", "TikTok"],
        ["linkedin", "LinkedIn"], ["t.co", "Twitter"], ["twitter", "Twitter"], ["bing", "Bing"]];
      for (var i = 0; i < conhecidos.length; i++) {
        if (host.indexOf(conhecidos[i][0]) > -1) return conhecidos[i][1];
      }
      return host.slice(0, 60);
    } catch (e) { return "Direto"; }
  }

  /* Registro simples de visita: uma linha na tabela "visitas".
     Não usa serviço de fora, não usa cookie e não pede nada ao visitante.
     Não conta quando você mesma está logada no painel neste navegador,
     e conta só uma vez por aba aberta. */
  BANCO.registrarVisita = function () {
    try {
      var logada = Object.keys(localStorage).some(function (k) {
        return k.indexOf("sb-") === 0 && k.slice(-11) === "-auth-token";
      });
      if (logada) return;
      var pagina = (location.pathname || "/").slice(0, 200);
      var marca = "visita:" + pagina;
      if (sessionStorage.getItem(marca)) return;
      sessionStorage.setItem(marca, "1");
      BANCO.rest("visitas", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ pagina: pagina, origem: descobrirOrigem() }),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* visita não registrada, sem problema */ }
  };

  window.BANCO = BANCO;
})();
