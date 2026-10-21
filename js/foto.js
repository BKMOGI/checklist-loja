// Tratamento das fotos: reduz o tamanho, carimba data/hora/loja na imagem e
// recusa fotos antigas da galeria (a foto tem que ser tirada na hora).
const Foto = (() => {
  const LADO_MAX = 1280;
  const IDADE_MAX_MIN = 20;

  function carregarImagem(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir a foto.")); };
      img.src = url;
    });
  }

  function fotoAntiga(file) {
    return file.lastModified && Date.now() - file.lastModified > IDADE_MAX_MIN * 60000;
  }

  async function processar(file, carimbo) {
    if (fotoAntiga(file)) {
      throw new Error("Essa foto é antiga (da galeria). Tire uma foto agora pela câmera.");
    }
    const img = await carregarImagem(file);
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    // Carimbo no rodapé da imagem
    const fonte = Math.max(14, Math.round(w / 32));
    const faixa = fonte * 2.6;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - faixa, w, faixa);
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${fonte}px Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(carimbo.linha1, fonte * 0.7, h - faixa * 0.68);
    ctx.font = `${Math.round(fonte * 0.85)}px Arial, sans-serif`;
    ctx.fillText(carimbo.linha2, fonte * 0.7, h - faixa * 0.3);

    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.72));
    return { blob, w, h, ts: Date.now() };
  }

  function paraDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  return { processar, paraDataUrl };
})();
