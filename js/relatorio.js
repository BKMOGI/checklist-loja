// Análise de um registro + geração do relatório (PDF e textos para WhatsApp).
const Relatorio = (() => {
  const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dataHora = (ts) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = (ts) => new Date(ts).toLocaleDateString("pt-BR");
  const dataIso = (iso) => String(iso || "").split("-").reverse().join("/"); // 2026-10-21 → 21/10/2026

  function totalCaixa(caixa) {
    return DENOMINACOES.reduce((s, d) => s + d * (Number(caixa?.qtd?.[d]) || 0), 0);
  }

  function calcCaixa(reg, def) {
    if (!def.modoCaixa) return null;
    const total = Math.round(totalCaixa(reg.caixa) * 100) / 100;
    if (def.modoCaixa === "abertura") {
      return { total, esperado: FUNDO_CAIXA_PADRAO, diferenca: Math.round((total - FUNDO_CAIXA_PADRAO) * 100) / 100 };
    }
    const sugerida = Math.max(0, Math.round((total - FUNDO_CAIXA_PADRAO) * 100) / 100);
    const sangria = reg.caixa?.sangria != null && reg.caixa.sangria !== "" ? Number(reg.caixa.sangria) : sugerida;
    return { total, sugerida, sangria, fundo: Math.round((total - sangria) * 100) / 100 };
  }

  function analisar(reg) {
    const def = CHECKLISTS[reg.tipo];
    const itens = itensDoChecklist(def);
    const r = { def, itens, total: itens.length, ok: 0, pendencias: [], na: [], alertas: [], respondidos: 0 };
    for (const it of itens) {
      const resp = reg.respostas[it.id];
      if (!resp || !resp.status) continue;
      r.respondidos++;
      const linha = { texto: it.texto, obs: resp.obs || "", valor: resp.valor, tipo: it.tipo };
      if (resp.status === "ok") r.ok++;
      else if (resp.status === "pendente") r.pendencias.push(linha);
      else if (resp.status === "na") r.na.push(linha);
      else if (resp.status === "alerta") { r.alertas.push(linha); r.ok++; }
    }
    r.caixa = calcCaixa(reg, def);
    return r;
  }

  function rotuloResposta(it, resp) {
    if (!resp) return "—";
    if (it.tipo === "temp") return `${String(resp.valor).replace(".", ",")} °C`;
    if (it.tipo === "texto") return "";
    if (it.tipo === "data") return dataIso(resp.valor);
    if (it.tipo === "lote" && resp.status === "ok") return "Nada vencido";
    if (it.tipo === "lote" && resp.status === "alerta") return "Vencido/vencendo";
    return { ok: "OK", pendente: "PENDENTE", na: "N/A", alerta: "ALERTA" }[resp.status];
  }

  // ---------- Textos para WhatsApp ----------

  function cabecalhoTexto(reg, def) {
    return `*${def.titulo.toUpperCase()}* — ${reg.loja}\n📅 ${data(reg.inicio)}  ${hora(reg.inicio)}${reg.fim ? " às " + hora(reg.fim) : ""}\n👤 ${reg.responsavel}`;
  }

  function textoOcorrencia(reg) {
    const o = reg.ocorrencia;
    const urg = { Alta: "🔴", "Média": "🟠", Baixa: "🟢" }[o.urgencia] || "";
    return [
      `🚨 *OCORRÊNCIA — ${reg.loja}*`,
      `📅 ${dataHora(reg.inicio)}`,
      `👤 ${reg.responsavel}`,
      `📂 ${o.categoria}`,
      `${urg} Urgência: *${o.urgencia}*`,
      "",
      `*O que aconteceu:*\n${o.descricao}`,
      o.acao ? `\n*O que já foi feito:*\n${o.acao}` : null,
      reg.extras.length ? `\n📷 ${reg.extras.length} foto(s) no relatório.` : null,
    ].filter((l) => l != null).join("\n");
  }

  function textoCompras(reg) {
    const linhas = reg.compras.itens.map((i) => `• ${i.qtd} — ${i.desc}`);
    return [
      `🛒 *SOLICITAÇÃO DE COMPRAS — ${reg.loja}*`,
      `📅 ${dataHora(reg.inicio)}`,
      `👤 Solicitante: ${reg.responsavel}`,
      "",
      ...linhas,
      reg.compras.obs ? `\nObs.: ${reg.compras.obs}` : null,
    ].filter((l) => l != null).join("\n");
  }

  function textoAvisoGrupo(reg) {
    const a = analisar(reg);
    const linhas = [`⚠️ *PENDÊNCIAS — ${a.def.titulo}*`, `${reg.loja} · ${dataHora(reg.fim || Date.now())}`, `👤 ${reg.responsavel}`, ""];
    if (a.pendencias.length) {
      linhas.push("*Não foi possível concluir:*");
      a.pendencias.forEach((p) => linhas.push(`• ${p.texto}${p.obs ? `\n   ↳ ${p.obs}` : ""}`));
    }
    if (a.alertas.length) {
      linhas.push("", "*Atenção:*");
      a.alertas.forEach((p) => linhas.push(`• ${p.texto}${p.valor != null && p.tipo === "temp" ? ` (${String(p.valor).replace(".", ",")} °C)` : ""}${p.obs ? `\n   ↳ ${p.obs}` : ""}`));
    }
    linhas.push("", "Quem assumir o próximo turno, por favor verificar. 🙏");
    return linhas.join("\n");
  }

  function textoResumo(reg) {
    const def = CHECKLISTS[reg.tipo];
    if (def.categoria === "ocorrencia") return textoOcorrencia(reg);
    if (def.categoria === "compras") return textoCompras(reg);
    const a = analisar(reg);
    const st = a.pendencias.length ? `⚠️ ${a.pendencias.length} pendência(s)` : "✅ Tudo concluído";
    const l = [cabecalhoTexto(reg, def), "", `${st} · ${a.ok}/${a.total} itens OK${a.na.length ? ` · ${a.na.length} N/A` : ""}`];
    for (const it of a.itens.filter((i) => i.tipo === "texto" || i.tipo === "data")) {
      const resp = reg.respostas[it.id];
      if (resp?.valor) l.push(`📝 ${it.texto.replace(/\?$/, "")}: *${it.tipo === "data" ? dataIso(resp.valor) : resp.valor}*`);
    }
    for (const it of a.itens.filter((i) => i.tipo === "temp")) {
      const resp = reg.respostas[it.id];
      if (resp) l.push(`🌡️ ${it.texto.split("(")[0].trim()}: ${String(resp.valor).replace(".", ",")} °C ${resp.status === "alerta" ? "⚠️" : "✓"}`);
    }
    if (a.caixa) {
      l.push(`💵 Contado: *${brl(a.caixa.total)}*`);
      if (def.modoCaixa === "abertura" && a.caixa.diferenca !== 0) l.push(`⚠️ Diferença no fundo: ${brl(a.caixa.diferenca)} — ${reg.caixa.obsDiferenca}`);
      if (def.modoCaixa === "fechamento") {
        l.push(`💸 Sangria: *${brl(a.caixa.sangria)}*`);
        l.push(`🏦 Fundo p/ próximo turno: *${brl(a.caixa.fundo)}*`);
        l.push(`🤝 Malote entregue para: ${reg.caixa.entreguePara}`);
        if (Math.abs(a.caixa.sangria - a.caixa.sugerida) > 0.009) l.push(`⚠️ Sangria diferente da sugerida (${brl(a.caixa.sugerida)}): ${reg.caixa.obsDiferenca}`);
      }
    }
    if (a.pendencias.length) {
      l.push("", "*Pendências:*");
      a.pendencias.forEach((p) => l.push(`• ${p.texto} — ${p.obs}`));
    }
    if (a.alertas.length) {
      l.push("", "*Alertas:*");
      a.alertas.forEach((p) => l.push(`• ${p.texto}${p.obs ? " — " + p.obs : ""}`));
    }
    if (reg.obsGeral) l.push("", `📝 ${reg.obsGeral}`);
    if (reg.avisoGrupoEm) l.push("", `📣 Pendências avisadas no grupo às ${hora(reg.avisoGrupoEm)}`);
    return l.join("\n");
  }

  // ---------- PDF ----------

  async function gerarPdf(reg) {
    const { jsPDF } = window.jspdf;
    const def = CHECKLISTS[reg.tipo];
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 14, CW = W - 2 * M;
    const VERDE = [31, 138, 76], CINZA = [102, 117, 108], LARANJA = [201, 130, 26], ESCURO = [20, 32, 26];
    let y = 0;

    const novaPagina = () => { doc.addPage(); y = 16; };
    const garantir = (h) => { if (y + h > 282) novaPagina(); };
    const cor = (c) => doc.setTextColor(...c);

    // Faixa de título
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, W, 30, "F");
    cor([255, 255, 255]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(def.titulo.replace("—", "-").toUpperCase(), M, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${reg.loja}  ·  ${def.codigo}`, M, 20);
    doc.text(`Gerado em ${dataHora(Date.now())}`, W - M, 20, { align: "right" });
    y = 38;

    // Dados gerais
    const dados = [
      ["Responsável", reg.responsavel],
      ["Data", data(reg.inicio)],
      ["Início", hora(reg.inicio)],
      ["Término", reg.fim ? hora(reg.fim) : "-"],
    ];
    doc.setFontSize(9);
    dados.forEach(([k, v], i) => {
      const x = M + i * (CW / 4);
      cor(CINZA); doc.setFont("helvetica", "normal"); doc.text(k.toUpperCase(), x, y);
      cor(ESCURO); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(String(v), x, y + 5.5);
      doc.setFontSize(9);
    });
    y += 13;

    const titulo = (t) => {
      garantir(14);
      y += 3;
      cor(VERDE); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(t.toUpperCase(), M, y);
      doc.setDrawColor(...VERDE); doc.setLineWidth(0.4); doc.line(M, y + 1.8, W - M, y + 1.8);
      y += 7;
    };

    const paragrafo = (t, c = ESCURO, tam = 10, negrito = false) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(tam); cor(c);
      const linhas = doc.splitTextToSize(String(t), CW);
      linhas.forEach((ln) => { garantir(5); doc.text(ln, M, y); y += 4.8; });
    };

    if (def.categoria === "ocorrencia") {
      const o = reg.ocorrencia;
      titulo("Ocorrência");
      paragrafo(`Categoria: ${o.categoria}`, ESCURO, 10, true);
      paragrafo(`Urgência: ${o.urgencia}`, o.urgencia === "Alta" ? [204, 61, 46] : ESCURO, 10, true);
      y += 2;
      titulo("O que aconteceu");
      paragrafo(o.descricao);
      if (o.acao) { titulo("O que já foi feito"); paragrafo(o.acao); }
    } else if (def.categoria === "compras") {
      titulo("Itens solicitados");
      reg.compras.itens.forEach((i, idx) => {
        garantir(7);
        if (idx % 2 === 0) { doc.setFillColor(241, 244, 242); doc.rect(M, y - 4.2, CW, 6.6, "F"); }
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); cor(ESCURO);
        doc.text(doc.splitTextToSize(i.desc, CW - 40)[0], M + 2, y);
        doc.setFont("helvetica", "bold"); doc.text(String(i.qtd), W - M - 2, y, { align: "right" });
        y += 6.6;
      });
      if (reg.compras.obs) { y += 2; titulo("Observações"); paragrafo(reg.compras.obs); }
    } else {
      const a = analisar(reg);
      // Cartões de resumo
      const cards = [
        ["ITENS OK", `${a.ok}/${a.total}`, VERDE],
        ["PENDÊNCIAS", String(a.pendencias.length), a.pendencias.length ? LARANJA : VERDE],
        ["ALERTAS", String(a.alertas.length), a.alertas.length ? LARANJA : VERDE],
      ];
      const cw = (CW - 8) / 3;
      cards.forEach(([l, n, c], i) => {
        const x = M + i * (cw + 4);
        doc.setFillColor(241, 244, 242); doc.roundedRect(x, y, cw, 17, 2.5, 2.5, "F");
        cor(c); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(n, x + cw / 2, y + 8.5, { align: "center" });
        cor(CINZA); doc.setFontSize(7.5); doc.text(l, x + cw / 2, y + 13.5, { align: "center" });
      });
      y += 23;

      if (a.pendencias.length || a.alertas.length) {
        const lista = [...a.pendencias.map((p) => ["PENDENTE", p]), ...a.alertas.map((p) => ["ALERTA", p])];
        titulo("Pendências e alertas");
        lista.forEach(([tag, p]) => {
          paragrafo(`[${tag}] ${p.texto}`, LARANJA, 10, true);
          if (p.obs) paragrafo(`    ${p.obs}`, ESCURO, 9.5);
          y += 1;
        });
        if (reg.avisoGrupoEm) paragrafo(`Avisado no grupo da loja às ${hora(reg.avisoGrupoEm)}.`, CINZA, 9);
      }

      // Itens por seção
      for (const sec of def.secoes) {
        titulo(sec.titulo);
        for (const it0 of sec.itens) {
          const it = { ...it0, tipo: it0.tipo || "check" };
          const resp = reg.respostas[it.id];
          const rot = rotuloResposta(it, resp);
          doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
          const linhas = doc.splitTextToSize(it.texto, CW - 38);
          garantir(linhas.length * 4.5 + 2);
          cor(ESCURO); doc.text(linhas, M, y);
          const c = !resp ? CINZA : resp.status === "ok" ? VERDE : resp.status === "na" ? CINZA : LARANJA;
          cor(c); doc.setFont("helvetica", "bold"); doc.text(rot, W - M, y, { align: "right" });
          y += linhas.length * 4.5;
          const detalhe = it.tipo === "texto" ? resp?.valor : resp?.status !== "pendente" ? resp?.obs : "";
          if (detalhe) {
            doc.setFont("helvetica", it.tipo === "texto" ? "bold" : "italic"); doc.setFontSize(it.tipo === "texto" ? 9.5 : 8.5); cor(it.tipo === "texto" ? ESCURO : CINZA);
            doc.splitTextToSize(detalhe, CW - 38).forEach((ln) => { garantir(4.5); doc.text(ln, M + 3, y); y += 4.3; });
          }
          doc.setDrawColor(225, 231, 227); doc.setLineWidth(0.2); doc.line(M, y - 1.5, W - M, y - 1.5);
          y += 2.2;
        }
      }

      if (a.caixa) {
        titulo("Contagem do dinheiro");
        doc.setFontSize(9.5);
        const linhas = DENOMINACOES.filter((d) => Number(reg.caixa.qtd[d]) > 0);
        linhas.forEach((d) => {
          garantir(5.5);
          const q = Number(reg.caixa.qtd[d]);
          cor(ESCURO); doc.setFont("helvetica", "normal");
          doc.text(brl(d), M + 2, y); doc.text(`x ${q}`, M + 60, y);
          doc.setFont("helvetica", "bold"); doc.text(brl(d * q), M + 110, y, { align: "right" });
          y += 5.2;
        });
        y += 2;
        const linhaValor = (k, v, destaque) => {
          garantir(8);
          doc.setFillColor(...(destaque ? [229, 244, 234] : [241, 244, 242])); doc.rect(M, y - 4.5, 110, 7, "F");
          cor(ESCURO); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
          doc.text(k, M + 2, y); doc.text(v, M + 108, y, { align: "right" }); y += 8;
        };
        linhaValor("TOTAL CONTADO", brl(a.caixa.total), true);
        if (def.modoCaixa === "abertura") {
          linhaValor("Fundo esperado", brl(a.caixa.esperado));
          if (a.caixa.diferenca !== 0) {
            linhaValor("Diferença", brl(a.caixa.diferenca));
            paragrafo(`Justificativa: ${reg.caixa.obsDiferenca}`, LARANJA, 9.5, true);
          }
        } else {
          linhaValor("Sangria", brl(a.caixa.sangria));
          linhaValor("Fundo para o próximo turno", brl(a.caixa.fundo), true);
          linhaValor("Malote entregue para", reg.caixa.entreguePara || "-");
          if (Math.abs(a.caixa.sangria - a.caixa.sugerida) > 0.009) {
            paragrafo(`Obs.: sangria diferente da sugerida (${brl(a.caixa.sugerida)}). ${reg.caixa.obsDiferenca || ""}`, LARANJA, 9);
          }
        }
      }

      if (reg.obsGeral) { titulo("Observações"); paragrafo(reg.obsGeral); }
    }

    // Fotos
    const fotos = [];
    for (const f of def.fotos) if (reg.fotos[f.id]) fotos.push({ leg: f.texto, ...reg.fotos[f.id] });
    const rotuloExtra = def.categoria === "ocorrencia" ? "Foto da ocorrência" : "Foto adicional";
    reg.extras.forEach((f, i) => fotos.push({ leg: f.legenda || `${rotuloExtra} ${i + 1}`, ...f }));
    if (fotos.length) {
      titulo("Fotos");
      const fw = (CW - 6) / 2;
      const FH_MAX = 95;
      let col = 0, alturaLinha = 0;
      for (const f of fotos) {
        const url = await Foto.paraDataUrl(f.blob);
        const fh = Math.min(fw * (f.h / f.w), FH_MAX);
        const iw = fh * (f.w / f.h);
        if (col === 0) garantir(FH_MAX + 10);
        const x = M + col * (fw + 6);
        doc.addImage(url, "JPEG", x + (fw - iw) / 2, y, iw, fh);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); cor(CINZA);
        doc.text(doc.splitTextToSize(`${f.leg} · ${hora(f.ts)}`, fw)[0], x, y + fh + 4);
        alturaLinha = Math.max(alturaLinha, fh);
        if (col === 1) { y += alturaLinha + 9; col = 0; alturaLinha = 0; } else col = 1;
      }
      if (col === 1) y += alturaLinha + 9;
    }

    // Rodapé
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); cor(CINZA);
      doc.text(`${def.titulo.replace("—", "-")} · ${reg.loja} · ${reg.responsavel}`, M, 292);
      doc.text(`Página ${p} de ${n}`, W - M, 292, { align: "right" });
    }
    return doc.output("blob");
  }

  function nomeArquivo(reg) {
    const def = CHECKLISTS[reg.tipo];
    const d = new Date(reg.inicio);
    const p = (n) => String(n).padStart(2, "0");
    const slug = def.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/, "");
    return `${slug}_${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}_${p(d.getHours())}h${p(d.getMinutes())}.pdf`;
  }

  return { analisar, calcCaixa, totalCaixa, textoResumo, textoAvisoGrupo, gerarPdf, nomeArquivo, brl, dataHora, hora, data, dataIso };
})();
