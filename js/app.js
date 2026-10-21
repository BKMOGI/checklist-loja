// Check-list BK — estado, navegação e toda a lógica de tela.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { brl, hora, data, dataHora } = Relatorio;

  const GRUPOS = {
    loja: ["abertura_loja", "fechamento_loja"],
    caixa: ["abertura_caixa_manha", "fechamento_caixa_tarde", "abertura_caixa_tarde", "fechamento_caixa_noite"],
    outros: ["ocorrencia", "solicitacao_compras"],
  };
  // Rotina esperada todo dia (usada no painel da gerência).
  const ROTINA = ["abertura_loja", "abertura_caixa_manha", "fechamento_caixa_tarde", "abertura_caixa_tarde", "fechamento_caixa_noite", "fechamento_loja"];

  // ---------- Configuração ----------
  function lerCfg() { try { return JSON.parse(localStorage.getItem("cfg")) || {}; } catch { return {}; } }
  function gravarCfg() { try { localStorage.setItem("cfg", JSON.stringify(cfg)); } catch { /* sem armazenamento */ } }
  let cfg = lerCfg();
  Sync.iniciar(() => cfg);

  // ---------- Estado ----------
  let tela = "home";
  let reg = null;       // registro em edição / exibido
  let def = null;
  let etapas = [];
  let idx = 0;
  let pdfPromise = null;
  let fotoAlvo = null;  // { slot } | { extra: true }
  let painelPeriodo = "hoje";

  // ---------- Utilidades de UI ----------
  let toastTimer;
  function toast(msg, ms = 2800) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), ms);
  }
  function carregando(msg) {
    $("#loading-msg").textContent = msg || "Aguarde…";
    $("#loading").hidden = !msg;
  }

  let salvarTimer;
  function salvarDepois() {
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(() => reg && Db.salvar(reg), 350);
  }

  function mostrar(nome, titulo) {
    tela = nome;
    $$(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + nome));
    $("#topbar-titulo").innerHTML = titulo;
    $("#btn-voltar").hidden = nome === "home";
    $("#btn-config").hidden = nome !== "home";
    $("#rodape").hidden = nome !== "etapa";
    $("#progresso").hidden = nome !== "etapa";
    window.scrollTo(0, 0);
  }

  // ---------- INÍCIO ----------
  async function renderHome() {
    mostrar("home", "Check-list BK");
    const nome = cfg.nome || "";
    $("#home-avatar").textContent = (cfg.loja || "BK").replace(/^BK\s*/i, "").charAt(0).toUpperCase() || "B";
    $("#home-nome").textContent = cfg.loja || "Configure a loja";
    const hojeTxt = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    $("#home-data").textContent = hojeTxt.charAt(0).toUpperCase() + hojeTxt.slice(1) + (nome ? ` · ${nome}` : "");

    const regs = await Db.listar();
    const hoje = new Date().toDateString();
    const tile = (tipo, largo) => {
      const d = CHECKLISTS[tipo];
      const rasc = regs.find((r) => r.tipo === tipo && r.status === "rascunho");
      const feito = regs.find((r) => r.tipo === tipo && r.status === "finalizado" && new Date(r.inicio).toDateString() === hoje);
      const avulso = d.categoria === "ocorrencia" || d.categoria === "compras";
      let badge = "";
      if (rasc) badge = `<span class="badge-st and">Em andamento</span>`;
      else if (feito && !avulso) badge = `<span class="badge-st ok">✓ ${hora(feito.fim)}</span>`;
      return `<button class="tile ${largo ? "largo" : ""}" data-iniciar="${tipo}">
        <span class="ic">${d.icone}</span>
        <span><span class="t">${esc(d.titulo)}</span><span class="c">${d.codigo === "OCOR" ? "Qualquer problema na loja" : d.codigo}</span></span>
        ${badge}</button>`;
    };
    for (const [grupo, tipos] of Object.entries(GRUPOS)) {
      let html = tipos.map((t) => tile(t)).join("");
      if (grupo === "outros" && cfg.gerencia && Sync.configurado()) {
        html = `<button class="tile largo" data-painel="1"><span class="ic">📊</span><span><span class="t">Painel da gerência</span><span class="c">Acompanhe as lojas em tempo real</span></span></button>` + html;
      }
      $(`[data-grupo="${grupo}"]`).innerHTML = html;
    }

    const hist = regs.slice(0, 30);
    $("#lista-historico").innerHTML = hist.length ? hist.map((r) => {
      const d = CHECKLISTS[r.tipo];
      let tag = `<span class="tag rasc">Em andamento</span>`;
      if (r.status === "finalizado") {
        const a = d.categoria === "loja" || d.categoria === "caixa" ? Relatorio.analisar(r) : null;
        const p = a ? a.pendencias.length : 0;
        tag = p ? `<span class="tag pend">${p} pendência${p > 1 ? "s" : ""}</span>` : `<span class="tag ok">Concluído</span>`;
        if (d.categoria === "ocorrencia") tag = `<span class="tag pend">Ocorrência</span>`;
      }
      const nuvem = Sync.configurado() && r.status === "finalizado" ? (r.sync?.ok ? " · ☁️" : " · ⏳") : "";
      return `<div class="reg-item">
        <div class="info" data-abrir="${r.id}">
          <div class="nome">${d.icone} ${esc(d.titulo)}</div>
          <div class="meta">${dataHora(r.inicio)} · ${esc(r.responsavel || "—")}${nuvem}</div>
        </div>${tag}
        <button class="btn-del" data-excluir="${r.id}" aria-label="Excluir">🗑</button>
      </div>`;
    }).join("") : `<div class="vazio">Nenhum check-list ainda.</div>`;
  }

  async function iniciar(tipo) {
    if (!cfg.loja) {
      toast("Antes de começar, informe a loja.");
      return renderConfig();
    }
    const regs = await Db.listar();
    const rasc = regs.find((r) => r.tipo === tipo && r.status === "rascunho");
    if (rasc) {
      if (confirm(`Há um "${CHECKLISTS[tipo].titulo}" em andamento desde ${dataHora(rasc.inicio)} (${rasc.responsavel || "sem nome"}).\n\nOK = continuar de onde parou\nCancelar = descartar e começar do zero`)) {
        return abrirRegistro(rasc);
      }
      await Db.excluir(rasc.id);
    }
    const novo = {
      id: `${tipo}_${Date.now()}`,
      tipo,
      status: "rascunho",
      inicio: Date.now(),
      fim: null,
      responsavel: "",
      loja: cfg.loja,
      respostas: {},
      fotos: {},
      extras: [],
      caixa: { qtd: {}, sangria: null, entreguePara: "", obsDiferenca: "" },
      compras: { itens: [{ desc: "", qtd: "" }], obs: "" },
      ocorrencia: { categoria: "", urgencia: "", descricao: "", acao: "" },
      obsGeral: "",
      avisoGrupoEm: null,
      enviadoEm: null,
      sync: null,
    };
    await Db.salvar(novo);
    abrirRegistro(novo);
  }

  function montarEtapas(d) {
    const quem = { tipo: "quem", titulo: d.categoria === "compras" ? "Quem está solicitando?" : "Quem está preenchendo?" };
    const secoes = d.secoes.map((s) => ({ tipo: "secao", titulo: s.titulo, secao: s }));
    const final = { tipo: "final", titulo: "Revisar e finalizar" };
    if (d.categoria === "loja") return [quem, ...secoes, { tipo: "fotos", titulo: "Fotos obrigatórias" }, final];
    if (d.categoria === "caixa") return [quem, { tipo: "contagem", titulo: "Contagem do dinheiro" }, ...secoes, final];
    if (d.categoria === "compras") return [quem, { tipo: "compras", titulo: "Itens para comprar" }];
    return [quem, { tipo: "ocorrencia", titulo: "O que aconteceu?" }];
  }

  function abrirRegistro(r) {
    reg = r;
    def = CHECKLISTS[r.tipo];
    if (r.status === "finalizado") return renderConcluido();
    etapas = montarEtapas(def);
    // Retoma na primeira etapa que ainda tem algo faltando.
    idx = 0;
    while (idx < etapas.length - 1 && validar(etapas[idx]).length === 0) idx++;
    renderEtapa();
  }

  // ---------- ETAPAS ----------
  function renderEtapa() {
    const e = etapas[idx];
    mostrar("etapa", `${esc(def.titulo)}<span class="sub">${esc(reg.loja)} · ${data(reg.inicio)}</span>`);
    $("#progresso > div").style.width = `${((idx + 1) / etapas.length) * 100}%`;
    let corpo = "";
    let contagem = "";
    if (e.tipo === "quem") corpo = htmlQuem();
    else if (e.tipo === "secao") {
      const itens = e.secao.itens.map((i) => ({ ...i, tipo: i.tipo || "check" }));
      const feitos = itens.filter((i) => reg.respostas[i.id]?.status).length;
      contagem = `<span id="cont-secao">${feitos} de ${itens.length} itens respondidos</span>`;
      corpo = itens.map(htmlItem).join("");
    } else if (e.tipo === "fotos") {
      contagem = "Tire as fotos agora pela câmera. Foto antiga da galeria não é aceita.";
      corpo = `<div class="fotos-grid">${def.fotos.map((f) => htmlSlot(f.id, f.texto, reg.fotos[f.id])).join("")}</div>`;
    } else if (e.tipo === "contagem") corpo = htmlContagem();
    else if (e.tipo === "compras") corpo = htmlCompras();
    else if (e.tipo === "ocorrencia") corpo = htmlOcorrencia();
    else if (e.tipo === "final") corpo = htmlFinal();

    $("#etapa-conteudo").innerHTML = `
      <div class="etapa-topo">
        <div class="passo-n">Etapa ${idx + 1} de ${etapas.length}</div>
        <h2>${esc(e.titulo)}</h2>
        <div class="cont">${contagem}</div>
      </div>${corpo}`;
    $("#btn-anterior").textContent = idx === 0 ? "Sair" : "Voltar";
    $("#btn-proximo").textContent = idx === etapas.length - 1 ? "Finalizar ✓" : "Próximo →";
  }

  function htmlQuem() {
    const nomes = (cfg.nomes || []).slice(0, 8);
    return `<div class="card">
      ${nomes.length ? `<p class="hint">Toque no seu nome:</p><div class="item" style="box-shadow:none;margin:0"><div class="opcoes" style="margin:0 0 12px">${nomes.map((n) => `<button data-nome="${esc(n)}" class="${reg.responsavel === n ? "sel-ok" : ""}">${esc(n)}</button>`).join("")}</div></div>` : ""}
      <label class="campo" data-id="responsavel">${nomes.length ? "Ou digite seu nome" : "Seu nome completo"}
        <input type="text" data-campo="responsavel" value="${esc(reg.responsavel)}" placeholder="Ex.: Maria Souza" autocomplete="name" />
      </label>
    </div>`;
  }

  function marcaDe(st) { return { ok: "✓", pendente: "!", alerta: "!", na: "–" }[st] || ""; }

  function htmlItem(it) {
    const r = reg.respostas[it.id] || {};
    const st = r.status || "";
    const novo = it.novo ? `<span class="novo">NOVO</span>` : "";
    const bt = (status, rotulo) => `<button data-resp="${it.id}" data-st="${status}" class="${st === status ? "sel-" + status : ""}">${rotulo}</button>`;
    let corpo = "";
    if (it.tipo === "check") {
      corpo = `<div class="opcoes">${bt("ok", "✓ Feito")}${bt("pendente", "⚠ Pendência")}${it.na ? bt("na", "Não se aplica") : ""}</div>`;
      if (st === "pendente") corpo += `<textarea data-obs="${it.id}" placeholder="O que ficou pendente e por quê?">${esc(r.obs)}</textarea>`;
      if (st === "na") corpo += `<div class="aviso" style="color:var(--text-dim)">Motivo: ${esc(it.na)}</div>`;
    } else if (it.tipo === "temp") {
      const neg = r.sinal !== "+";
      const abs = r.valor != null && r.valor !== "" ? String(Math.abs(r.valor)).replace(".", ",") : "";
      corpo = `<div class="temp-wrap">
          <button class="btn btn-secondary" style="width:52px;margin:0;padding:12px 0;font-size:20px" data-sinal="${it.id}">${neg ? "−" : "+"}</button>
          <input type="text" inputmode="decimal" data-temp="${it.id}" value="${abs}" placeholder="00" /><span>°C</span>
        </div>
        <div class="aviso-temp">${htmlAvisoTemp(it, r)}</div>`;
    } else if (it.tipo === "lote") {
      corpo = `<div class="opcoes">${bt("ok", "✓ Tudo certo")}${bt("alerta", "Achei vencido")}${bt("pendente", "⚠ Pendência")}</div>`;
      if (st === "alerta") corpo += `<textarea data-obs="${it.id}" placeholder="Produto, lote, validade e o que foi feito (ex.: retirado da venda)">${esc(r.obs)}</textarea>`;
      if (st === "pendente") corpo += `<textarea data-obs="${it.id}" placeholder="O que ficou pendente e por quê?">${esc(r.obs)}</textarea>`;
    }
    return `<div class="item st-${st}" data-id="${it.id}">
      <div class="topo" ${it.tipo === "check" ? `data-toggle="${it.id}"` : ""}>
        <div class="marca">${marcaDe(st)}</div>
        <div class="txt">${esc(it.texto)}${novo}</div>
      </div>
      <div class="corpo">${corpo}</div>
    </div>`;
  }

  function htmlAvisoTemp(it, r) {
    if (r.valor == null || r.valor === "") return "";
    if (r.status === "ok") return `<div class="aviso bom">✓ Dentro do padrão (até ${it.max} °C)</div>`;
    return `<div class="aviso">⚠ Acima de ${it.max} °C! Informe o que foi feito.</div>
      <textarea data-obs="${it.id}" placeholder="Ex.: porta estava aberta, fechei e vou conferir de novo às 10h">${esc(r.obs)}</textarea>`;
  }

  function htmlSlot(id, texto, foto, extraIdx) {
    if (foto) {
      const url = URL.createObjectURL(foto.blob);
      const del = extraIdx != null ? `data-del-extra="${extraIdx}"` : `data-del-foto="${id}"`;
      return `<div class="foto-slot tem" data-id="${id}"><img src="${url}" alt="" /><span class="ok-ic">✓</span>
        <span class="leg">${esc(texto)} · ${hora(foto.ts)}</span><button class="x" ${del} aria-label="Remover">✕</button></div>`;
    }
    return `<div class="foto-slot" data-id="${id}" ${extraIdx === -1 ? 'data-add-extra="1"' : `data-foto="${id}"`}>
      <span class="ic">📷</span>${esc(texto)}</div>`;
  }

  function htmlExtras(rotulo) {
    return `<div class="fotos-grid">
      ${reg.extras.map((f, i) => htmlSlot("extra" + i, f.legenda || `${rotulo} ${i + 1}`, f, i)).join("")}
      ${htmlSlot("extra-add", "Adicionar foto", null, -1)}
    </div>`;
  }

  // --- Caixa ---
  function htmlContagem() {
    const linhas = DENOMINACOES.map((d) => {
      const q = reg.caixa.qtd[d] ?? "";
      return `<tr class="${d < 2 ? "moeda" : ""}"><td>${brl(d)}</td>
        <td><input type="text" inputmode="numeric" data-qtd="${d}" value="${esc(q)}" placeholder="0" /></td>
        <td id="sub-${String(d).replace(".", "_")}">${q ? brl(d * q) : "—"}</td></tr>`;
    }).join("");
    return `<div class="card" data-id="contagem">
        <p class="hint" style="margin-bottom:8px">Digite a <b>quantidade</b> de cada nota e moeda. O app soma sozinho.</p>
        <table class="contagem"><tbody>${linhas}</tbody></table>
        <div class="total-destaque"><span>TOTAL CONTADO</span><b id="caixa-total">${brl(Relatorio.totalCaixa(reg.caixa))}</b></div>
      </div>
      <div id="caixa-resumo">${htmlCaixaResumo()}</div>`;
  }

  function htmlCaixaResumo() {
    const c = Relatorio.calcCaixa(reg, def);
    if (def.modoCaixa === "abertura") {
      if (c.total === 0) return "";
      if (c.diferenca === 0) return `<div class="status-box success">✓ Fundo de caixa confere: ${brl(c.esperado)}</div>`;
      return `<div class="status-box warn">⚠ O fundo esperado é ${brl(c.esperado)}. Diferença de <b>${brl(c.diferenca)}</b>.</div>
        <label class="campo" data-id="obsDiferenca">Explique a diferença (obrigatório)
          <textarea data-campo="caixa.obsDiferenca" placeholder="Ex.: fechamento de ontem deixou R$ 280,00">${esc(reg.caixa.obsDiferenca)}</textarea>
        </label>`;
    }
    const difere = Math.abs(c.sangria - c.sugerida) > 0.009;
    return `<div class="card">
        <h3>Sangria e malote</h3>
        <p class="hint">Acima de ${brl(FUNDO_CAIXA_PADRAO)} vira sangria. Sugerido: <b>${brl(c.sugerida)}</b></p>
        <label class="campo" data-id="sangria">Valor da sangria feita no PDV
          <input type="text" inputmode="decimal" data-sangria="1" value="${reg.caixa.sangria != null && reg.caixa.sangria !== "" ? String(reg.caixa.sangria).replace(".", ",") : ""}" placeholder="${String(c.sugerida.toFixed(2)).replace(".", ",")}" />
        </label>
        <div class="linha-valor"><span>Fundo para o próximo turno</span><b id="caixa-fundo">${brl(c.fundo)}</b></div>
        <div id="obs-sangria">${difere ? htmlObsSangria() : ""}</div>
      </div>
      <div class="card" data-id="entreguePara">
        <h3>Malote entregue para</h3>
        <div class="item" style="box-shadow:none;margin:8px 0 0"><div class="opcoes">
          ${RESPONSAVEIS_MALOTE.map((n) => `<button data-entregue="${n}" class="${reg.caixa.entreguePara === n ? "sel-ok" : ""}">${n}</button>`).join("")}
        </div></div>
      </div>`;
  }

  function htmlObsSangria() {
    return `<label class="campo" data-id="obsDiferenca" style="margin-top:10px">Sangria diferente da sugerida — explique
      <textarea data-campo="caixa.obsDiferenca" placeholder="Ex.: troco alto hoje, mantive mais no caixa">${esc(reg.caixa.obsDiferenca)}</textarea></label>`;
  }

  // --- Compras ---
  function htmlCompras() {
    const linhas = reg.compras.itens.map((i, n) => `<div class="compra-linha" data-id="compra${n}">
        <input type="text" data-compra-desc="${n}" value="${esc(i.desc)}" placeholder="Produto / descrição" />
        <input type="text" data-compra-qtd="${n}" value="${esc(i.qtd)}" placeholder="Qtd" />
        <button data-del-compra="${n}" aria-label="Remover">✕</button></div>`).join("");
    return `<div class="card" data-id="compras">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--text-dim);margin-bottom:6px"><span>DESCRIÇÃO</span><span style="margin-right:40px">QTD</span></div>
        ${linhas}
        <button class="btn btn-secondary" data-add-compra="1" style="margin:8px 0 0">+ Adicionar item</button>
      </div>
      <label class="campo">Observação (opcional)
        <textarea data-campo="compras.obs" placeholder="Ex.: urgente, acabando hoje">${esc(reg.compras.obs)}</textarea></label>`;
  }

  // --- Ocorrência ---
  function htmlOcorrencia() {
    const o = reg.ocorrencia;
    const chip = (attr, v, sel) => `<button data-${attr}="${esc(v)}" class="${sel ? "sel-" + (attr === "urg" && v === "Alta" ? "pendente" : "ok") : ""}">${esc(v)}</button>`;
    return `<div class="card" data-id="categoria">
        <h3>Tipo do problema</h3>
        <div class="item" style="box-shadow:none;margin:8px 0 0"><div class="opcoes">
          ${CATEGORIAS_OCORRENCIA.map((c) => chip("cat", c, o.categoria === c).replace("<button", '<button style="flex:1 1 45%"')).join("")}
        </div></div>
      </div>
      <div class="card" data-id="urgencia">
        <h3>Urgência</h3>
        <div class="item" style="box-shadow:none;margin:8px 0 0"><div class="opcoes">${URGENCIAS.map((u) => chip("urg", u, o.urgencia === u)).join("")}</div></div>
      </div>
      <label class="campo" data-id="descricao">O que aconteceu? (obrigatório)
        <textarea data-campo="ocorrencia.descricao" rows="4" placeholder="Descreva o problema: onde, quando, quem estava envolvido…">${esc(o.descricao)}</textarea></label>
      <label class="campo">O que já foi feito? (opcional)
        <textarea data-campo="ocorrencia.acao" placeholder="Ex.: liguei para o técnico, retorna amanhã às 9h">${esc(o.acao)}</textarea></label>
      <h2 class="section-title">Fotos (recomendado)</h2>
      ${htmlExtras("Foto da ocorrência")}`;
  }

  // --- Final ---
  function htmlFinal() {
    const a = Relatorio.analisar(reg);
    const faltando = etapas.slice(0, -1).flatMap(validar);
    let caixa = "";
    if (a.caixa) {
      caixa = `<div class="card"><div class="linha-valor"><span>Total contado</span><b>${brl(a.caixa.total)}</b></div>
        ${def.modoCaixa === "fechamento" ? `<div class="linha-valor"><span>Sangria</span><b>${brl(a.caixa.sangria)}</b></div>
        <div class="linha-valor"><span>Fundo próximo turno</span><b>${brl(a.caixa.fundo)}</b></div>
        <div class="linha-valor"><span>Malote entregue para</span><b>${esc(reg.caixa.entreguePara)}</b></div>` : ""}</div>`;
    }
    return `
      <div class="resumo-final">
        <div class="mini ok"><span class="n">${a.ok}/${a.total}</span><span class="l">ITENS OK</span></div>
        <div class="mini ${a.pendencias.length ? "pend" : "ok"}"><span class="n">${a.pendencias.length}</span><span class="l">PENDÊNCIAS</span></div>
        <div class="mini ${a.alertas.length ? "pend" : "ok"}"><span class="n">${a.alertas.length}</span><span class="l">ALERTAS</span></div>
      </div>
      ${faltando.length ? `<div class="status-box error"><b>Ainda falta preencher:</b><ul>${faltando.map((f) => `<li>${esc(f.msg)}</li>`).join("")}</ul></div>` : ""}
      ${a.pendencias.length ? `<div class="status-box warn"><b>Pendências</b> — você vai avisar o grupo da loja no próximo passo.<ul>${a.pendencias.map((p) => `<li>${esc(p.texto)}</li>`).join("")}</ul></div>` : ""}
      ${caixa}
      <label class="campo">Observações gerais (opcional)
        <textarea data-campo="obsGeral" placeholder="Algo mais que a gerência precisa saber?">${esc(reg.obsGeral)}</textarea></label>
      <h2 class="section-title">Fotos adicionais (opcional)</h2>
      ${htmlExtras("Foto adicional")}`;
  }

  // ---------- Validação ----------
  function validar(e) {
    const erros = [];
    if (e.tipo === "quem" && !reg.responsavel.trim()) erros.push({ id: "responsavel", msg: "Informe seu nome" });
    if (e.tipo === "secao") {
      for (const it0 of e.secao.itens) {
        const it = { ...it0, tipo: it0.tipo || "check" };
        const r = reg.respostas[it.id];
        const curto = it.texto.length > 55 ? it.texto.slice(0, 52) + "…" : it.texto;
        if (!r || !r.status) erros.push({ id: it.id, msg: it.tipo === "temp" ? `Informe a temperatura: ${curto}` : `Responda: ${curto}` });
        else if ((r.status === "pendente" || r.status === "alerta") && !(r.obs || "").trim()) erros.push({ id: it.id, msg: `Descreva o problema: ${curto}` });
      }
    }
    if (e.tipo === "fotos") {
      for (const f of def.fotos) if (!reg.fotos[f.id]) erros.push({ id: f.id, msg: `Foto: ${f.texto}` });
    }
    if (e.tipo === "contagem") {
      const c = Relatorio.calcCaixa(reg, def);
      if (c.total <= 0) erros.push({ id: "contagem", msg: "Faça a contagem do dinheiro" });
      else if (def.modoCaixa === "abertura" && c.diferenca !== 0 && !reg.caixa.obsDiferenca.trim()) erros.push({ id: "obsDiferenca", msg: "Explique a diferença no fundo de caixa" });
      else if (def.modoCaixa === "fechamento") {
        if (c.sangria < 0 || c.sangria > c.total) erros.push({ id: "sangria", msg: "Valor da sangria inválido" });
        if (Math.abs(c.sangria - c.sugerida) > 0.009 && !reg.caixa.obsDiferenca.trim()) erros.push({ id: "obsDiferenca", msg: "Explique por que a sangria é diferente da sugerida" });
        if (!reg.caixa.entreguePara) erros.push({ id: "entreguePara", msg: "Informe para quem entregou o malote" });
      }
    }
    if (e.tipo === "compras") {
      const preenchidos = reg.compras.itens.filter((i) => i.desc.trim() || String(i.qtd).trim());
      if (!preenchidos.length) erros.push({ id: "compras", msg: "Adicione pelo menos um item" });
      reg.compras.itens.forEach((i, n) => {
        if (i.desc.trim() && !String(i.qtd).trim()) erros.push({ id: "compra" + n, msg: `Informe a quantidade de "${i.desc}"` });
        if (!i.desc.trim() && String(i.qtd).trim()) erros.push({ id: "compra" + n, msg: "Item sem descrição" });
      });
    }
    if (e.tipo === "ocorrencia") {
      const o = reg.ocorrencia;
      if (!o.categoria) erros.push({ id: "categoria", msg: "Escolha o tipo do problema" });
      if (!o.urgencia) erros.push({ id: "urgencia", msg: "Escolha a urgência" });
      if (!o.descricao.trim()) erros.push({ id: "descricao", msg: "Descreva o que aconteceu" });
    }
    return erros;
  }

  function mostrarErros(erros) {
    $$("#etapa-conteudo .erro").forEach((el) => el.classList.remove("erro"));
    for (const e of erros) $(`#etapa-conteudo [data-id="${e.id}"]`)?.classList.add("erro");
    const primeiro = $(`#etapa-conteudo [data-id="${erros[0].id}"]`);
    primeiro?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast(erros.length > 1 ? `${erros[0].msg} (e mais ${erros.length - 1})` : erros[0].msg, 3500);
  }

  async function proximo() {
    const e = etapas[idx];
    const erros = e.tipo === "final" ? etapas.slice(0, -1).flatMap(validar) : validar(e);
    if (erros.length) {
      if (e.tipo === "final") {
        // Leva para a primeira etapa com problema.
        idx = etapas.findIndex((et) => validar(et).length);
        renderEtapa();
        return mostrarErros(validar(etapas[idx]));
      }
      return mostrarErros(erros);
    }
    if (e.tipo === "quem") lembrarNome(reg.responsavel.trim());
    await Db.salvar(reg);
    if (idx < etapas.length - 1) { idx++; renderEtapa(); return; }
    await finalizar();
  }

  function anterior() {
    if (idx === 0) { Db.salvar(reg); return renderHome(); }
    idx--;
    renderEtapa();
  }

  function lembrarNome(n) {
    cfg.nome = n;
    cfg.nomes = [n, ...(cfg.nomes || []).filter((x) => x.toLowerCase() !== n.toLowerCase())].slice(0, 12);
    gravarCfg();
  }

  async function finalizar() {
    reg.responsavel = reg.responsavel.trim();
    reg.compras.itens = reg.compras.itens.filter((i) => i.desc.trim());
    reg.fim = Date.now();
    reg.status = "finalizado";
    await Db.salvar(reg);
    renderConcluido();
    sincronizar(true);
  }

  // ---------- CONCLUÍDO ----------
  function pdfAtual() {
    if (!pdfPromise) pdfPromise = Relatorio.gerarPdf(reg);
    return pdfPromise;
  }

  function renderConcluido() {
    pdfPromise = null;
    pdfAtual().catch((e) => console.error(e));
    mostrar("concluido", esc(def.titulo));
    const ehOcor = def.categoria === "ocorrencia";
    const ehCompras = def.categoria === "compras";
    const a = !ehOcor && !ehCompras ? Relatorio.analisar(reg) : null;
    const precisaGrupo = ehOcor || (a && (a.pendencias.length || a.alertas.length));
    const grupoOk = !!reg.avisoGrupoEm;
    let n = 1;

    const passoGrupo = precisaGrupo ? `<div class="card passo ${grupoOk ? "feito" : ""}">
        <div class="num">${grupoOk ? "✓" : n++}</div>
        <div class="conteudo"><h3>${ehOcor ? "Avisar no grupo da loja" : "Avisar as pendências no grupo da loja"}</h3>
          <p>${grupoOk ? `Avisado às ${hora(reg.avisoGrupoEm)}.` : "Abre o WhatsApp com a mensagem pronta — é só escolher o grupo da loja e enviar."}</p>
          <button class="btn ${grupoOk ? "btn-secondary" : "btn-whats"}" data-acao="grupo">💬 ${grupoOk ? "Avisar de novo" : "Avisar no grupo"}</button>
        </div></div>` : "";
    if (grupoOk && precisaGrupo) n++;

    const bloqueado = precisaGrupo && !grupoOk;
    const enviado = !!reg.enviadoEm;
    const passoGerencia = `<div class="card passo ${enviado ? "feito" : ""}">
        <div class="num">${enviado ? "✓" : n}</div>
        <div class="conteudo"><h3>Enviar o relatório para a gerência</h3>
          <p>${enviado ? `Enviado às ${hora(reg.enviadoEm)}.` : bloqueado ? "Primeiro avise o grupo da loja (passo acima)." : "Envia o PDF com tudo preenchido e as fotos pelo WhatsApp."}</p>
          <button class="btn ${enviado ? "btn-secondary" : "btn-whats"}" data-acao="gerencia" ${bloqueado ? "disabled style='opacity:.45'" : ""}>📄 ${enviado ? "Enviar de novo" : "Enviar relatório (PDF)"}</button>
          <button class="btn btn-secondary" data-acao="texto" ${bloqueado ? "disabled style='opacity:.45'" : ""}>Enviar só o resumo em texto</button>
        </div></div>`;

    let nuvem = "";
    if (Sync.configurado()) {
      nuvem = reg.sync?.ok
        ? `<div class="status-box success">☁️ Registrado no painel da gerência às ${hora(reg.sync.em)}.</div>`
        : `<div class="status-box warn">⏳ Aguardando internet para registrar no painel da gerência. <button class="btn btn-secondary" data-acao="sync" style="margin:8px 0 0">Tentar agora</button></div>`;
    }

    const resumo = a ? `<div class="resumo-final">
        <div class="mini ok"><span class="n">${a.ok}/${a.total}</span><span class="l">ITENS OK</span></div>
        <div class="mini ${a.pendencias.length ? "pend" : "ok"}"><span class="n">${a.pendencias.length}</span><span class="l">PENDÊNCIAS</span></div>
        <div class="mini ${a.alertas.length ? "pend" : "ok"}"><span class="n">${a.alertas.length}</span><span class="l">ALERTAS</span></div>
      </div>` : "";

    $("#concluido-conteudo").innerHTML = `
      <div class="sucesso-hero"><div class="ic">${ehOcor ? "🚨" : "✓"}</div>
        <h2>${ehOcor ? "Ocorrência registrada" : ehCompras ? "Solicitação registrada" : "Check-list finalizado"}</h2>
        <p>${esc(reg.responsavel)} · ${dataHora(reg.fim || reg.inicio)}</p></div>
      ${resumo}${nuvem}${passoGrupo}${passoGerencia}
      <button class="btn btn-secondary" data-acao="pdf">👁 Ver o relatório</button>
      <button class="btn btn-secondary" data-acao="inicio">Voltar ao início</button>`;
  }

  function numeroWhats(n) {
    const d = String(n || "").replace(/\D/g, "");
    if (!d) return "";
    return d.length <= 11 ? "55" + d : d;
  }
  function abrirWhats(texto, numero) {
    window.open(`https://wa.me/${numeroWhats(numero)}?text=${encodeURIComponent(texto)}`, "_blank");
  }

  // Compartilha o PDF (Android/iPhone abrem a lista de apps → WhatsApp).
  // Sem suporte a compartilhar arquivo: baixa o PDF e abre o WhatsApp com o texto.
  async function compartilharPdf(texto, numero) {
    const blob = await pdfAtual();
    const file = new File([blob], Relatorio.nomeArquivo(reg), { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: texto, title: def.titulo });
        return true;
      } catch (e) {
        if (e.name === "AbortError") return false;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    toast("PDF salvo no aparelho — anexe na conversa do WhatsApp.", 4500);
    abrirWhats(texto, numero);
    return true;
  }

  async function acaoConcluido(acao) {
    if (acao === "inicio") return renderHome();
    if (acao === "pdf") {
      const blob = await pdfAtual();
      window.open(URL.createObjectURL(blob), "_blank");
      return;
    }
    if (acao === "sync") return sincronizar(true);
    if (acao === "grupo") {
      const ok = def.categoria === "ocorrencia"
        ? await compartilharPdf(Relatorio.textoResumo(reg))
        : (abrirWhats(Relatorio.textoAvisoGrupo(reg)), true);
      if (ok) { reg.avisoGrupoEm = Date.now(); await Db.salvar(reg); renderConcluido(); sincronizar(false); }
      return;
    }
    if (acao === "gerencia" || acao === "texto") {
      const texto = Relatorio.textoResumo(reg);
      const ok = acao === "gerencia" ? await compartilharPdf(texto, cfg.whats) : (abrirWhats(texto, cfg.whats), true);
      if (ok) { reg.enviadoEm = Date.now(); await Db.salvar(reg); renderConcluido(); }
    }
  }

  async function sincronizar(avisar) {
    if (!Sync.configurado()) return;
    try {
      if (reg && reg.status === "finalizado") {
        await Sync.enviar(reg, await pdfAtual());
        if (tela === "concluido") renderConcluido();
        if (avisar) toast("☁️ Registrado no painel da gerência");
      }
      await Sync.enviarPendentes();
    } catch (e) {
      console.warn(e);
      if (avisar) toast("Sem conexão com o painel — será enviado depois automaticamente.", 4000);
    }
  }

  // ---------- FOTOS ----------
  function abrirCamera(alvo) {
    fotoAlvo = alvo;
    const inp = $("#input-foto");
    inp.value = "";
    inp.click();
  }

  async function fotoEscolhida(file) {
    if (!file || !fotoAlvo) return;
    carregando("Processando foto…");
    try {
      const legenda = fotoAlvo.slot ? def.fotos.find((f) => f.id === fotoAlvo.slot).texto : null;
      const foto = await Foto.processar(file, {
        linha1: `${reg.loja} · ${def.titulo.replace("—", "-")}`,
        linha2: `${new Date().toLocaleString("pt-BR")} · ${reg.responsavel}${legenda ? " · " + legenda : ""}`,
      });
      if (fotoAlvo.slot) reg.fotos[fotoAlvo.slot] = foto;
      else reg.extras.push(foto);
      await Db.salvar(reg);
      renderEtapaMantendoScroll();
    } catch (e) {
      toast(e.message, 4500);
    } finally {
      carregando(null);
      fotoAlvo = null;
    }
  }

  function renderEtapaMantendoScroll() {
    const y = window.scrollY;
    renderEtapa();
    window.scrollTo(0, y);
  }

  // ---------- Eventos da etapa ----------
  function atualizarItem(id) {
    const it = itensDoChecklist(def).find((i) => i.id === id);
    const el = $(`#etapa-conteudo .item[data-id="${id}"]`);
    if (!it || !el) return;
    el.outerHTML = htmlItem(it);
    atualizarContador();
  }

  function atualizarContador() {
    const e = etapas[idx];
    if (e.tipo !== "secao") return;
    const feitos = e.secao.itens.filter((i) => reg.respostas[i.id]?.status).length;
    $("#cont-secao").textContent = `${feitos} de ${e.secao.itens.length} itens respondidos`;
  }

  function setResp(id, status) {
    const atual = reg.respostas[id] || {};
    reg.respostas[id] = { ...atual, status };
    atualizarItem(id);
    salvarDepois();
    if (status === "pendente" || status === "alerta") $(`#etapa-conteudo [data-obs="${id}"]`)?.focus();
  }

  function atualizarTemp(id, texto) {
    const it = itensDoChecklist(def).find((i) => i.id === id);
    const r = reg.respostas[id] || {};
    const abs = parseFloat(String(texto).replace(",", "."));
    if (isNaN(abs)) {
      reg.respostas[id] = { ...r, valor: null, status: "" };
    } else {
      const valor = r.sinal === "+" ? Math.abs(abs) : -Math.abs(abs);
      reg.respostas[id] = { ...r, valor, status: valor <= it.max ? "ok" : "alerta" };
    }
    const nr = reg.respostas[id];
    const el = $(`#etapa-conteudo .item[data-id="${id}"]`);
    el.className = `item st-${nr.status || ""}`;
    $(".marca", el).textContent = marcaDe(nr.status);
    const av = $(".aviso-temp", el);
    const tinhaObs = !!$("textarea", av);
    const precisaObs = nr.status === "alerta";
    if (tinhaObs !== precisaObs || !precisaObs) av.innerHTML = htmlAvisoTemp(it, nr);
    atualizarContador();
    salvarDepois();
  }

  function definirCampo(caminho, valor) {
    const partes = caminho.split(".");
    let alvo = reg;
    while (partes.length > 1) alvo = alvo[partes.shift()];
    alvo[partes[0]] = valor;
    salvarDepois();
  }

  function atualizarCaixa() {
    $("#caixa-total").textContent = brl(Relatorio.totalCaixa(reg.caixa));
    $("#caixa-resumo").innerHTML = htmlCaixaResumo();
  }

  function onCliqueEtapa(ev) {
    const t = ev.target.closest("button, [data-toggle], [data-foto], [data-add-extra]");
    if (!t) return;
    t.closest(".erro")?.classList.remove("erro");
    const ds = t.dataset;
    if (ds.delFoto) { ev.stopPropagation(); delete reg.fotos[ds.delFoto]; salvarDepois(); return renderEtapaMantendoScroll(); }
    if (ds.delExtra != null) { ev.stopPropagation(); reg.extras.splice(Number(ds.delExtra), 1); salvarDepois(); return renderEtapaMantendoScroll(); }
    if (ds.resp) return setResp(ds.resp, ds.st);
    if (ds.toggle) return setResp(ds.toggle, reg.respostas[ds.toggle]?.status === "ok" ? "" : "ok");
    if (ds.sinal) {
      const r = reg.respostas[ds.sinal] || {};
      reg.respostas[ds.sinal] = { ...r, sinal: r.sinal === "+" ? "-" : "+" };
      t.textContent = reg.respostas[ds.sinal].sinal === "+" ? "+" : "−";
      return atualizarTemp(ds.sinal, $(`[data-temp="${ds.sinal}"]`).value);
    }
    if (ds.foto) return abrirCamera({ slot: ds.foto });
    if (ds.addExtra) return abrirCamera({ extra: true });
    if (ds.nome) { reg.responsavel = ds.nome; salvarDepois(); return proximo(); }
    if (ds.entregue) { reg.caixa.entreguePara = ds.entregue; salvarDepois(); return atualizarCaixa(); }
    if (ds.cat) { reg.ocorrencia.categoria = ds.cat; salvarDepois(); return renderEtapaMantendoScroll(); }
    if (ds.urg) { reg.ocorrencia.urgencia = ds.urg; salvarDepois(); return renderEtapaMantendoScroll(); }
    if (ds.addCompra) {
      reg.compras.itens.push({ desc: "", qtd: "" });
      renderEtapaMantendoScroll();
      $(`[data-compra-desc="${reg.compras.itens.length - 1}"]`)?.focus();
      return;
    }
    if (ds.delCompra != null) {
      reg.compras.itens.splice(Number(ds.delCompra), 1);
      if (!reg.compras.itens.length) reg.compras.itens.push({ desc: "", qtd: "" });
      salvarDepois();
      return renderEtapaMantendoScroll();
    }
  }

  function onInputEtapa(ev) {
    const t = ev.target;
    const ds = t.dataset;
    t.closest(".erro")?.classList.remove("erro");
    if (ds.obs) { reg.respostas[ds.obs] = { ...(reg.respostas[ds.obs] || {}), obs: t.value }; return salvarDepois(); }
    if (ds.temp) return atualizarTemp(ds.temp, t.value);
    if (ds.campo) return definirCampo(ds.campo, t.value);
    if (ds.qtd) {
      const q = t.value.replace(/\D/g, "");
      if (q !== t.value) t.value = q;
      reg.caixa.qtd[ds.qtd] = q === "" ? "" : Number(q);
      $(`#sub-${ds.qtd.replace(".", "_")}`).textContent = q ? brl(Number(ds.qtd) * Number(q)) : "—";
      salvarDepois();
      return atualizarCaixa();
    }
    if (ds.sangria) {
      const v = t.value.trim() === "" ? null : parseFloat(t.value.replace(/\./g, "").replace(",", "."));
      reg.caixa.sangria = v != null && isNaN(v) ? null : v;
      const c = Relatorio.calcCaixa(reg, def);
      $("#caixa-fundo").textContent = brl(c.fundo);
      const difere = Math.abs(c.sangria - c.sugerida) > 0.009;
      const box = $("#obs-sangria");
      if (difere && !box.innerHTML) box.innerHTML = htmlObsSangria();
      if (!difere) box.innerHTML = "";
      return salvarDepois();
    }
    if (ds.compraDesc != null) { reg.compras.itens[ds.compraDesc].desc = t.value; return salvarDepois(); }
    if (ds.compraQtd != null) { reg.compras.itens[ds.compraQtd].qtd = t.value; return salvarDepois(); }
  }

  // ---------- CONFIGURAÇÃO ----------
  function renderConfig() {
    mostrar("config", "Configurações");
    $("#cfg-loja").value = cfg.loja || "";
    $("#cfg-whats").value = cfg.whats || "";
    $("#cfg-url").value = cfg.syncUrl || "";
    $("#cfg-chave").value = cfg.syncChave || "";
    $("#cfg-gerencia").checked = !!cfg.gerencia;
    $("#cfg-painel-status").innerHTML = Sync.configurado() ? `<div class="status-box success">☁️ Conectado ao painel.</div>` : "";
  }

  function salvarConfig() {
    cfg.loja = $("#cfg-loja").value.trim();
    cfg.whats = $("#cfg-whats").value.trim();
    cfg.syncUrl = $("#cfg-url").value.trim();
    cfg.syncChave = $("#cfg-chave").value.trim();
    cfg.gerencia = $("#cfg-gerencia").checked;
    if (!cfg.loja) return toast("Informe a loja.");
    gravarCfg();
    toast("Configurações salvas");
    Sync.enviarPendentes();
    renderHome();
  }

  async function testarConexao() {
    cfg.syncUrl = $("#cfg-url").value.trim();
    cfg.syncChave = $("#cfg-chave").value.trim();
    if (!Sync.configurado()) return toast("Preencha o link e a chave.");
    carregando("Testando conexão…");
    try {
      await Sync.testar();
      $("#cfg-painel-status").innerHTML = `<div class="status-box success">✓ Conexão OK com a planilha.</div>`;
    } catch (e) {
      $("#cfg-painel-status").innerHTML = `<div class="status-box error">Não conectou: ${esc(e.message)}</div>`;
    } finally { carregando(null); }
  }

  function linkConexao() {
    const dados = btoa(unescape(encodeURIComponent(JSON.stringify({ u: $("#cfg-url").value.trim(), k: $("#cfg-chave").value.trim(), w: $("#cfg-whats").value.trim() }))));
    return `${location.origin}${location.pathname}?conectar=${encodeURIComponent(dados)}`;
  }

  function enviarLinkLoja() {
    if (!$("#cfg-url").value.trim() || !$("#cfg-chave").value.trim()) return toast("Preencha o link e a chave primeiro.");
    abrirWhats(`📋 *Check-list BK* — toque no link abaixo no celular da loja para conectar o app ao painel da gerência:\n\n${linkConexao()}`);
  }

  // Link de conexão recebido pelo WhatsApp: ?conectar=...
  function aplicarLinkConexao() {
    const p = new URLSearchParams(location.search).get("conectar");
    if (!p) return;
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(p))));
      cfg.syncUrl = d.u;
      cfg.syncChave = d.k;
      if (d.w) cfg.whats = d.w;
      gravarCfg();
      setTimeout(() => toast("☁️ App conectado ao painel da gerência!", 4000), 300);
    } catch { toast("Link de conexão inválido."); }
    history.replaceState(null, "", location.pathname);
  }

  // ---------- PAINEL DA GERÊNCIA ----------
  function inicioDoDia(offsetDias) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offsetDias);
    return d.getTime();
  }

  async function renderPainel() {
    mostrar("painel", "Painel da gerência");
    const cont = $("#painel-conteudo");
    const chips = [["hoje", "Hoje"], ["ontem", "Ontem"], ["7d", "7 dias"]].map(([k, l]) =>
      `<button data-periodo="${k}" class="${painelPeriodo === k ? "sel-ok" : ""}">${l}</button>`).join("");
    cont.innerHTML = `<div class="item" style="box-shadow:none;background:none;margin:0 0 12px"><div class="opcoes" style="margin:0">${chips}<button data-periodo="${painelPeriodo}" style="flex:0 0 48px" aria-label="Atualizar">↻</button></div></div>
      <div id="painel-lista"><div class="vazio"><div class="spinner"></div>Carregando…</div></div>`;
    const desde = painelPeriodo === "hoje" ? inicioDoDia(0) : painelPeriodo === "ontem" ? inicioDoDia(1) : inicioDoDia(6);
    const ate = painelPeriodo === "ontem" ? inicioDoDia(0) : Infinity;
    let regs;
    try {
      regs = (await Sync.listar(desde)).filter((r) => r.inicio < ate).sort((a, b) => b.inicio - a.inicio);
      try { localStorage.setItem("painelCache_" + painelPeriodo, JSON.stringify({ em: Date.now(), regs })); } catch { /* ok */ }
    } catch (e) {
      let cache = null;
      try { cache = JSON.parse(localStorage.getItem("painelCache_" + painelPeriodo)); } catch { /* ok */ }
      if (!cache) { $("#painel-lista").innerHTML = `<div class="status-box error">Não foi possível carregar: ${esc(e.message)}</div>`; return; }
      regs = cache.regs;
      toast(`Sem internet — mostrando dados de ${dataHora(cache.em)}`, 4000);
    }
    painelRegs = regs;
    $("#painel-lista").innerHTML = painelPeriodo === "7d" ? htmlPainelLista(regs) : htmlPainelDia(regs);
  }
  let painelRegs = [];

  function linhaPainel(r) {
    const d = CHECKLISTS[r.tipo] || { icone: "📋", titulo: r.titulo };
    let tag = `<span class="tag ok">OK</span>`;
    if (r.pendencias) tag = `<span class="tag pend">${r.pendencias} pend.</span>`;
    else if (r.alertas) tag = `<span class="tag pend">${r.alertas} alerta${r.alertas > 1 ? "s" : ""}</span>`;
    if (r.categoria === "ocorrencia") tag = `<span class="tag ${r.ocorrencia?.urgencia === "Alta" ? "alta" : "pend"}">${esc(r.ocorrencia?.urgencia || "")}</span>`;
    if (r.categoria === "compras") tag = `<span class="tag rasc">Compras</span>`;
    return `<div class="reg-item"><div class="info" data-detalhe="${esc(r.id)}">
        <div class="nome">${d.icone} ${esc(d.titulo)}</div>
        <div class="meta">${esc(r.loja)} · ${dataHora(r.fim || r.inicio)} · ${esc(r.responsavel)}</div>
        ${r.categoria === "ocorrencia" ? `<div class="meta" style="color:var(--text)">${esc(r.ocorrencia?.categoria)} — ${esc((r.detalhe || "").slice(0, 90))}</div>` : ""}
      </div>${tag}</div>`;
  }

  function htmlPainelDia(regs) {
    const lojas = [...new Set([cfg.loja, ...regs.map((r) => r.loja)].filter(Boolean))];
    let html = "";
    const ocor = regs.filter((r) => r.categoria === "ocorrencia");
    if (ocor.length) html += `<h2 class="section-title">🚨 Ocorrências (${ocor.length})</h2><div class="lista">${ocor.map(linhaPainel).join("")}</div>`;
    for (const loja of lojas) {
      const daLoja = regs.filter((r) => r.loja === loja);
      const feitos = ROTINA.filter((t) => daLoja.some((r) => r.tipo === t)).length;
      html += `<h2 class="section-title">${esc(loja)} — rotina ${feitos}/${ROTINA.length}</h2><div class="lista">`;
      for (const tipo of ROTINA) {
        const r = daLoja.find((x) => x.tipo === tipo);
        const d = CHECKLISTS[tipo];
        html += r ? linhaPainel(r) : `<div class="reg-item" style="opacity:.6"><div class="info"><div class="nome">${d.icone} ${esc(d.titulo)}</div><div class="meta">Ainda não realizado</div></div><span class="tag rasc">⏳</span></div>`;
      }
      const compras = daLoja.filter((r) => r.categoria === "compras");
      html += compras.map(linhaPainel).join("") + `</div>`;
    }
    return html || `<div class="vazio">Nada registrado.</div>`;
  }

  function htmlPainelLista(regs) {
    return regs.length ? `<div class="lista">${regs.map(linhaPainel).join("")}</div>` : `<div class="vazio">Nada registrado nesse período.</div>`;
  }

  function renderDetalhe(id) {
    const r = painelRegs.find((x) => x.id === id);
    if (!r) return;
    mostrar("painel", "Detalhe");
    tela = "detalhe";
    $("#btn-voltar").hidden = false;
    $("#painel-conteudo").innerHTML = `<div class="card"><div style="white-space:pre-wrap;font-size:14px;line-height:1.5">${esc(r.resumo || r.detalhe || "").replace(/\*([^*\n]+)\*/g, "<b>$1</b>")}</div></div>
      ${r.pdfUrl ? `<a class="btn btn-primary" href="${esc(r.pdfUrl)}" target="_blank" rel="noopener">📄 Abrir o relatório (PDF com fotos)</a>` : ""}
      <button class="btn btn-secondary" data-voltar-painel="1">Voltar ao painel</button>`;
  }

  // ---------- Navegação ----------
  function voltar() {
    if (tela === "etapa") return anterior();
    if (tela === "detalhe") return renderPainel();
    renderHome();
  }

  function ligarEventos() {
    $("#btn-voltar").addEventListener("click", voltar);
    $("#btn-config").addEventListener("click", renderConfig);
    $("#btn-trocar-nome").addEventListener("click", renderConfig);
    $("#btn-salvar-config").addEventListener("click", salvarConfig);
    $("#btn-testar").addEventListener("click", testarConexao);
    $("#btn-link-loja").addEventListener("click", enviarLinkLoja);
    $("#btn-anterior").addEventListener("click", anterior);
    $("#btn-proximo").addEventListener("click", proximo);
    $("#input-foto").addEventListener("change", (e) => fotoEscolhida(e.target.files[0]));

    $("#screen-home").addEventListener("click", async (e) => {
      const t = e.target.closest("[data-iniciar], [data-abrir], [data-excluir], [data-painel]");
      if (!t) return;
      if (t.dataset.iniciar) return iniciar(t.dataset.iniciar);
      if (t.dataset.painel) return renderPainel();
      if (t.dataset.abrir) return abrirRegistro(await Db.obter(t.dataset.abrir));
      if (t.dataset.excluir) {
        const r = await Db.obter(t.dataset.excluir);
        if (confirm(`Excluir "${CHECKLISTS[r.tipo].titulo}" de ${dataHora(r.inicio)}?`)) { await Db.excluir(r.id); renderHome(); }
      }
    });

    const etapa = $("#etapa-conteudo");
    etapa.addEventListener("click", onCliqueEtapa);
    etapa.addEventListener("input", onInputEtapa);

    $("#concluido-conteudo").addEventListener("click", (e) => {
      const t = e.target.closest("[data-acao]");
      if (t && !t.disabled) acaoConcluido(t.dataset.acao);
    });

    $("#painel-conteudo").addEventListener("click", (e) => {
      const t = e.target.closest("[data-periodo], [data-detalhe], [data-voltar-painel]");
      if (!t) return;
      if (t.dataset.periodo) { painelPeriodo = t.dataset.periodo; return renderPainel(); }
      if (t.dataset.detalhe) return renderDetalhe(t.dataset.detalhe);
      if (t.dataset.voltarPainel) return renderPainel();
    });

    window.addEventListener("online", () => Sync.enviarPendentes().then((n) => n && toast(`☁️ ${n} check-list(s) enviados ao painel`)));
  }

  async function main() {
    aplicarLinkConexao();
    ligarEventos();
    await Db.limparAntigos(45);
    await renderHome();
    if (!cfg.loja) renderConfig();
    Sync.enviarPendentes();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  main();
})();
