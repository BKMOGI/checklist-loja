// Envio dos check-lists finalizados para o painel da gerência (planilha Google
// via Apps Script — ver gerencia/Codigo.gs) e leitura do painel.
// Se não houver conexão, o registro fica na fila e é reenviado depois.
const Sync = (() => {
  let cfg = () => ({});

  function iniciar(lerCfg) { cfg = lerCfg; }
  const configurado = () => !!(cfg().syncUrl && cfg().syncChave);

  function paraBase64(blob) {
    return Foto.paraDataUrl(blob).then((url) => url.split(",")[1]);
  }

  function meta(reg) {
    const def = CHECKLISTS[reg.tipo];
    const m = {
      id: reg.id, tipo: reg.tipo, titulo: def.titulo, codigo: def.codigo, categoria: def.categoria,
      loja: reg.loja, responsavel: reg.responsavel, inicio: reg.inicio, fim: reg.fim,
      avisoGrupoEm: reg.avisoGrupoEm || null,
    };
    if (def.categoria === "loja" || def.categoria === "caixa" || def.categoria === "atividade") {
      const a = Relatorio.analisar(reg);
      Object.assign(m, {
        total: a.total, ok: a.ok, pendencias: a.pendencias.length, alertas: a.alertas.length,
        detalhe: [...a.pendencias.map((p) => `PENDENTE: ${p.texto} — ${p.obs}`), ...a.alertas.map((p) => `ALERTA: ${p.texto}${p.obs ? " — " + p.obs : ""}`)].join("\n"),
      });
      if (a.caixa) m.caixa = a.caixa;
    }
    if (def.categoria === "ocorrencia") {
      Object.assign(m, { ocorrencia: reg.ocorrencia, detalhe: reg.ocorrencia.descricao });
    }
    if (def.categoria === "compras") {
      m.detalhe = reg.compras.itens.map((i) => `${i.qtd} — ${i.desc}`).join("\n");
    }
    return m;
  }

  async function enviar(reg, pdfBlob) {
    if (!configurado()) return false;
    const body = {
      acao: "salvar",
      chave: cfg().syncChave,
      registro: meta(reg),
      resumo: Relatorio.textoResumo(reg),
      nomePdf: Relatorio.nomeArquivo(reg),
      pdf: await paraBase64(pdfBlob || (await Relatorio.gerarPdf(reg))),
    };
    // text/plain evita a requisição "preflight" de CORS, que o Apps Script não responde.
    const resp = await fetch(cfg().syncUrl, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "text/plain;charset=utf-8" } });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.erro || "Falha ao enviar ao painel");
    reg.sync = { ok: true, em: Date.now(), pdfUrl: json.pdfUrl || null };
    await Db.salvar(reg);
    return true;
  }

  // Reenvia o que ficou na fila (sem internet na hora de finalizar).
  let rodando = false;
  async function enviarPendentes() {
    if (!configurado() || rodando || !navigator.onLine) return 0;
    rodando = true;
    let n = 0;
    try {
      const regs = await Db.listar();
      for (const r of regs) {
        if (r.status === "finalizado" && !r.sync?.ok) {
          try { if (await enviar(r)) n++; } catch (e) { console.warn("sync", e); break; }
        }
      }
    } finally { rodando = false; }
    return n;
  }

  async function listar(desde) {
    const u = new URL(cfg().syncUrl);
    u.searchParams.set("acao", "listar");
    u.searchParams.set("chave", cfg().syncChave);
    u.searchParams.set("desde", String(desde));
    const resp = await fetch(u.toString());
    const json = await resp.json();
    if (!json.ok) throw new Error(json.erro || "Falha ao ler o painel");
    return json.registros || [];
  }

  async function testar() {
    const u = new URL(cfg().syncUrl);
    u.searchParams.set("acao", "testar");
    u.searchParams.set("chave", cfg().syncChave);
    const json = await (await fetch(u.toString())).json();
    if (!json.ok) throw new Error(json.erro || "Chave inválida");
    return json;
  }

  return { iniciar, configurado, enviar, enviarPendentes, listar, testar };
})();
