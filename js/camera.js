// Câmera dentro do próprio app (getUserMedia). No Android, abrir a câmera do
// sistema pelo <input capture> faz o celular fechar o app em segundo plano para
// liberar memória — e a foto se perde. Aqui a câmera roda na própria página.
const Camera = (() => {
  let stream = null;

  const suportada = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);

  function parar() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  // Abre a câmera em tela cheia. Resolve com um Blob JPEG, ou null se cancelar.
  // Rejeita se a câmera não puder ser aberta (sem permissão / sem câmera).
  async function capturar(titulo) {
    const el = document.getElementById("camera");
    const video = el.querySelector("video");
    el.querySelector(".camera-titulo").textContent = titulo || "";
    const ligar = async () => {
      parar();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay já cuida */ }
    };
    await ligar();
    el.hidden = false;
    document.body.style.overflow = "hidden";

    // Se o celular bloquear a tela ou trocar de app, a imagem da câmera para:
    // ao voltar, religa sozinha.
    const aoVoltar = () => {
      const ativa = stream && stream.getVideoTracks().some((t) => t.readyState === "live");
      if (document.visibilityState === "visible" && !el.hidden && (!ativa || !video.videoWidth)) ligar().catch(() => {});
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return new Promise((resolve) => {
      const btnFoto = el.querySelector("[data-cam-foto]");
      const btnSair = el.querySelector("[data-cam-sair]");
      const fechar = (resultado) => {
        document.removeEventListener("visibilitychange", aoVoltar);
        btnFoto.onclick = btnSair.onclick = null;
        parar();
        video.srcObject = null;
        el.hidden = true;
        document.body.style.overflow = "";
        resolve(resultado);
      };
      btnSair.onclick = () => fechar(null);
      btnFoto.onclick = () => {
        if (!video.videoWidth) { ligar().catch(() => {}); return; } // imagem parada: religa e tenta de novo
        const c = document.createElement("canvas");
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        c.getContext("2d").drawImage(video, 0, 0);
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 150);
        c.toBlob((blob) => fechar(blob), "image/jpeg", 0.9);
      };
    });
  }

  return { suportada, capturar, parar };
})();
