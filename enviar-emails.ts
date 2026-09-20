// =====================================================================
// enviar-emails | o "carteiro" da aba Prospecção.
//
// ONDE COLAR: no Supabase, menu "Edge Functions", botão "Deploy a new function"
// (ou "Via Editor"), com o nome exato:  enviar-emails
// Apague o exemplo que vem e cole ESTE arquivo inteiro. Depois clique em Deploy.
//
// A CHAVE DO RESEND NÃO FICA AQUI. Ela é guardada como segredo, no painel:
//   Edge Functions > Secrets > nome: RESEND_API_KEY
// (Opcional) segredo EMAIL_REMETENTE, ex: Amanda Drebes <oi@seudominio.com.br>
// Enquanto você não tiver domínio verificado, o remetente é o de teste do Resend.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_DA_DONA = "amandadrebes9@gmail.com"; // só este login pode usar o carteiro
const EMAIL_DE_RESPOSTA = "amandadrebes9@gmail.com"; // para onde as marcas respondem
const REMETENTE_PADRAO = "Amanda Drebes <onboarding@resend.dev>";
const MAX_POR_CHAMADA = 250;
const PAUSA_MS = 200; // 5 envios por segundo, o ritmo seguro do Resend

const CORS = {
  "Access-Control-Allow-Origin": "https://amandadrebess.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const escapar = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const primeiroNome = (marca: string) => String(marca || "").trim().replace(/^@/, "").split(/\s+/)[0] || "";

/* Troca {{nome}} pelo primeiro nome e {{marca}} pelo nome completo. */
function personalizar(texto: string, marca: string, comoHtml: boolean) {
  const nome = primeiroNome(marca), completo = String(marca || "").trim();
  const f = comoHtml ? escapar : (t: string) => t;
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, () => f(nome))
    .replace(/\{\{\s*marca\s*\}\}/gi, () => f(completo));
}

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ erro: "Use POST." }, 405);

  // ---- 1. Quem é você? Só a dona do painel passa.
  const cabecalho = req.headers.get("Authorization") ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "");
  if (!token) return responder({ erro: "Você precisa estar logada.", codigo: "nao_logada" }, 401);

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: cabecalho } },
  });
  const { data: dadosUsuario, error: erroUsuario } = await supa.auth.getUser(token);
  const emailLogado = String(dadosUsuario?.user?.email ?? "").toLowerCase();
  if (erroUsuario || emailLogado !== EMAIL_DA_DONA) {
    return responder({ erro: "Este login não tem permissão.", codigo: "recusado" }, 403);
  }

  // ---- 2. O que veio no pedido
  let pedido: any;
  try { pedido = await req.json(); } catch { return responder({ erro: "Pedido inválido." }, 400); }

  const chaveResend = Deno.env.get("RESEND_API_KEY");
  if (!chaveResend) {
    return responder({
      erro: "A chave do Resend ainda não foi guardada no Supabase (segredo RESEND_API_KEY).",
      codigo: "sem_chave",
    }, 500);
  }

  const teste = pedido?.teste === true;
  let assuntoModelo = String(pedido?.assunto ?? "").trim();
  const htmlModelo = String(pedido?.html ?? "");
  if (!assuntoModelo || !htmlModelo) return responder({ erro: "Faltou assunto ou texto do e-mail." }, 400);

  // No teste, só vai para o seu e-mail e o assunto ganha [TESTE].
  let destinatarios: { email: string; marca: string; id?: string | null }[] = [];
  if (teste) {
    destinatarios = [{ email: EMAIL_DA_DONA, marca: "Marca Exemplo", id: null }];
    assuntoModelo = "[TESTE] " + assuntoModelo;
  } else {
    if (!Array.isArray(pedido?.destinatarios) || !pedido.destinatarios.length) {
      return responder({ erro: "A lista de destinatários está vazia." }, 400);
    }
    if (pedido.destinatarios.length > MAX_POR_CHAMADA) {
      return responder({ erro: `No máximo ${MAX_POR_CHAMADA} destinatários por vez.`, codigo: "muitos" }, 400);
    }
    destinatarios = pedido.destinatarios.map((d: any) => ({
      email: String(d?.email ?? "").trim().toLowerCase(),
      marca: String(d?.marca ?? "").trim(),
      id: d?.id ?? null,
    }));
  }

  // ---- 3. Trava: nunca mandar duas vezes para o mesmo e-mail no mesmo disparo
  const vistos = new Set<string>();
  const unicos: typeof destinatarios = [];
  let pulados = 0;
  const resultados: { email: string; id: string | null; status: string; erro?: string }[] = [];
  for (const d of destinatarios) {
    if (!emailValido(d.email) || vistos.has(d.email)) { pulados++; resultados.push({ email: d.email, id: d.id ?? null, status: "pulado", erro: "repetido ou inválido" }); continue; }
    vistos.add(d.email);
    unicos.push(d);
  }

  // ---- 4. Trava: quem pediu SAIR nunca mais recebe (no teste não precisa)
  let descadastrados = new Set<string>();
  if (!teste) {
    const { data: fora, error: erroFora } = await supa.from("email_optout").select("email").in("email", unicos.map((d) => d.email));
    if (erroFora) {
      return responder({ erro: "Não consegui conferir a lista de descadastro. Rode o disparo.sql no Supabase.", codigo: "tabelas", detalhe: erroFora.message }, 500);
    }
    descadastrados = new Set((fora ?? []).map((l: any) => String(l.email).toLowerCase()));
  }

  // ---- 5. Opcional: pular quem já recebeu este mesmo assunto (para continuar um disparo)
  const jaRecebeu = new Set<string>();
  if (!teste && pedido?.pular_ja_enviados !== false) {
    const { data: enviados } = await supa.from("email_envios").select("email,assunto")
      .eq("status", "ok").in("email", unicos.map((d) => d.email)).limit(5000);
    for (const l of enviados ?? []) jaRecebeu.add(String(l.email).toLowerCase() + "||" + l.assunto);
  }

  // ---- 6. O envio, um por vez, no ritmo seguro
  let enviados = 0, falhas = 0, cotaAcabou = false, semDominio = false, semRegistro = 0;
  const remetente = Deno.env.get("EMAIL_REMETENTE") || REMETENTE_PADRAO;

  const registrar = async (d: { email: string; id?: string | null }, assunto: string, ok: boolean, erro: string | null, idResend: string | null) => {
    const { error } = await supa.from("email_envios").insert({
      email: d.email, assunto, status: ok ? "ok" : "erro", erro, resend_id: idResend, marca_id: d.id ?? null,
    });
    if (error) semRegistro++;
  };

  for (let i = 0; i < unicos.length; i++) {
    const d = unicos[i];
    const assunto = personalizar(assuntoModelo, d.marca, false);

    if (descadastrados.has(d.email)) { pulados++; resultados.push({ email: d.email, id: d.id ?? null, status: "pulado", erro: "descadastrado" }); continue; }
    if (jaRecebeu.has(d.email + "||" + assunto)) { pulados++; resultados.push({ email: d.email, id: d.id ?? null, status: "pulado", erro: "já recebeu este assunto" }); continue; }

    const html = personalizar(htmlModelo, d.marca, true);
    let tentativas = 0, feito = false;
    while (!feito && tentativas < 3) {
      tentativas++;
      let resp: Response, corpo: any = {};
      try {
        resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${chaveResend}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: remetente,
            to: [d.email],
            reply_to: EMAIL_DE_RESPOSTA,
            subject: assunto,
            html,
            headers: { "List-Unsubscribe": `<mailto:${EMAIL_DE_RESPOSTA}?subject=SAIR>` },
          }),
        });
        corpo = await resp.json().catch(() => ({}));
      } catch (e) {
        falhas++; feito = true;
        const msg = "Sem conexão com o Resend: " + String((e as Error).message);
        await registrar(d, assunto, false, msg, null);
        resultados.push({ email: d.email, id: d.id ?? null, status: "erro", erro: msg });
        break;
      }

      if (resp.ok) {
        enviados++; feito = true;
        await registrar(d, assunto, true, null, corpo?.id ?? null);
        resultados.push({ email: d.email, id: d.id ?? null, status: "ok" });
      } else if (corpo?.name === "rate_limit_exceeded" && tentativas < 3) {
        await dormir(1100); // respira e tenta de novo
      } else if (/quota_exceeded/.test(String(corpo?.name))) {
        cotaAcabou = true; feito = true; // PARA na hora, sem tentar de novo
      } else {
        falhas++; feito = true;
        const msg = String(corpo?.message ?? corpo?.name ?? ("erro " + resp.status));
        if (/only send testing emails|verify a domain|own email address/i.test(msg)) semDominio = true;
        await registrar(d, assunto, false, msg, null);
        resultados.push({ email: d.email, id: d.id ?? null, status: "erro", erro: msg });
      }
    }

    if (cotaAcabou || semDominio) {
      const restantes = unicos.slice(i + (cotaAcabou ? 0 : 1)).filter((x) => !descadastrados.has(x.email)).length;
      return responder({ enviados, falhas, pulados, cota_acabou: cotaAcabou, sem_dominio: semDominio, restantes, sem_registro: semRegistro, resultados });
    }
    await dormir(PAUSA_MS);
  }

  return responder({ enviados, falhas, pulados, cota_acabou: false, sem_dominio: false, restantes: 0, sem_registro: semRegistro, resultados });
});
