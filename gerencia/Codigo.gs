/**
 * Check-list BK — Painel da gerência (Google Apps Script)
 *
 * Recebe os check-lists finalizados nos celulares das lojas, grava uma linha
 * na aba "Registros" desta planilha e salva o PDF (com as fotos) no seu Google
 * Drive, na pasta "Check-list BK - Relatórios". O app da gerência lê daqui.
 *
 * Passo a passo de instalação: ver LEIA-ME.md nesta mesma pasta.
 */

// Troque por uma senha só sua (letras e números, sem espaço). A mesma vai no app.
const CHAVE = "TROQUE-ESTA-CHAVE";

const ABA = "Registros";
const PASTA = "Check-list BK - Relatórios";
const COLUNAS = [
  "ID", "Data", "Início", "Fim", "Loja", "Check-list", "Código", "Responsável",
  "Itens OK", "Total itens", "Pendências", "Alertas", "Detalhe", "Categoria ocorrência",
  "Urgência", "Avisou grupo", "Resumo", "PDF", "Recebido em", "JSON",
];

function doGet(e) {
  const p = e.parameter || {};
  if (p.chave !== CHAVE) return json({ ok: false, erro: "Chave inválida" });
  if (p.acao === "testar") return json({ ok: true, planilha: SpreadsheetApp.getActiveSpreadsheet().getName() });
  if (p.acao === "listar") return json({ ok: true, registros: listar(Number(p.desde) || 0) });
  return json({ ok: false, erro: "Ação desconhecida" });
}

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.chave !== CHAVE) return json({ ok: false, erro: "Chave inválida" });
  if (d.acao !== "salvar") return json({ ok: false, erro: "Ação desconhecida" });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const r = d.registro;
    const sh = aba();
    const linhaExistente = acharLinha(sh, r.id);
    let pdfUrl = linhaExistente ? sh.getRange(linhaExistente, COLUNAS.indexOf("PDF") + 1).getValue() : "";

    if (d.pdf) {
      const blob = Utilities.newBlob(Utilities.base64Decode(d.pdf), "application/pdf", d.nomePdf || r.id + ".pdf");
      if (pdfUrl) {
        // Reenvio (ex.: avisou o grupo depois): substitui o PDF antigo.
        try { DriveApp.getFileById(idDoArquivo(pdfUrl)).setTrashed(true); } catch (err) { /* já removido */ }
      }
      pdfUrl = pastaDoMes(r.inicio).createFile(blob).getUrl();
    }

    const tz = Session.getScriptTimeZone();
    const fmt = (ts, f) => (ts ? Utilities.formatDate(new Date(ts), tz, f) : "");
    const oc = r.ocorrencia || {};
    const valores = [
      r.id, fmt(r.inicio, "dd/MM/yyyy"), fmt(r.inicio, "HH:mm"), fmt(r.fim, "HH:mm"), r.loja, r.titulo, r.codigo,
      r.responsavel, r.ok != null ? r.ok : "", r.total != null ? r.total : "", r.pendencias != null ? r.pendencias : "",
      r.alertas != null ? r.alertas : "", r.detalhe || "", oc.categoria || "", oc.urgencia || "",
      r.avisoGrupoEm ? fmt(r.avisoGrupoEm, "HH:mm") : "", d.resumo || "", pdfUrl,
      fmt(Date.now(), "dd/MM/yyyy HH:mm"), JSON.stringify(Object.assign({}, r, { resumo: d.resumo, pdfUrl: pdfUrl })),
    ];
    if (linhaExistente) sh.getRange(linhaExistente, 1, 1, valores.length).setValues([valores]);
    else sh.appendRow(valores);
    return json({ ok: true, pdfUrl: pdfUrl });
  } finally {
    lock.releaseLock();
  }
}

function listar(desde) {
  const sh = aba();
  const n = sh.getLastRow();
  if (n < 2) return [];
  const col = COLUNAS.indexOf("JSON") + 1;
  return sh.getRange(2, col, n - 1, 1).getValues()
    .map((l) => { try { return JSON.parse(l[0]); } catch (e) { return null; } })
    .filter((r) => r && r.inicio >= desde);
}

function aba() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA);
  if (!sh) {
    sh = ss.insertSheet(ABA);
    sh.appendRow(COLUNAS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUNAS.length).setFontWeight("bold").setBackground("#1f8a4c").setFontColor("#ffffff");
    sh.hideColumns(COLUNAS.indexOf("JSON") + 1);
  }
  return sh;
}

function acharLinha(sh, id) {
  const n = sh.getLastRow();
  if (n < 2) return 0;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return 0;
}

function pastaDoMes(ts) {
  const raiz = pasta(DriveApp.getRootFolder(), PASTA);
  return pasta(raiz, Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), "yyyy-MM"));
}

function pasta(pai, nome) {
  const it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function idDoArquivo(url) {
  const m = String(url).match(/[-\w]{25,}/);
  return m ? m[0] : "";
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Rode uma vez pelo editor (botão ▶ Executar) para autorizar o acesso à planilha e ao Drive.
function autorizar() {
  aba();
  pasta(DriveApp.getRootFolder(), PASTA);
}
