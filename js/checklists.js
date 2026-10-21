// Definição dos check-lists (baseados nos formulários BKF03..BKF08 / BK08).
// Para incluir/alterar um item, basta editar este arquivo.
//
// Tipos de item:
//   check  → Feito / Pendência (pendência exige descrição)
//   temp   → informa a temperatura (°C); fora do limite vira alerta no relatório
//   lote   → "Encontrou produto vencido ou vencendo?" Não / Sim (descrever)
// Opções:
//   na: "motivo"  → permite "Não se aplica" (ex.: bandeiras com chuva)
//   novo: true    → item que não existia no formulário em papel

const FUNDO_CAIXA_PADRAO = 200;
const RESPONSAVEIS_MALOTE = ["Climério", "Vanessa", "Mariana", "Eliane"];
const DENOMINACOES = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05];

const ITENS_LOTE = [
  { id: "lote_planilha", texto: "Verificar lotes e vencimentos na planilha de controle de lote" },
  { id: "lote_freezers", texto: "Verificar lotes e vencimentos nos freezers", tipo: "lote" },
];

const CHECKLISTS = {
  abertura_loja: {
    codigo: "BKF03",
    titulo: "Abertura de Loja",
    icone: "🔓",
    categoria: "loja",
    secoes: [
      {
        titulo: "Abertura",
        itens: [
          { id: "porta", texto: "Destrancar a porta principal e abrir com cuidado" },
          { id: "alarme", texto: "Desativar o alarme de segurança" },
          { id: "luzes", texto: "Ligar as luzes e verificar o funcionamento dos sistemas elétricos" },
          { id: "chaves", texto: "Guardar chaves no local adequado" },
          { id: "uniforme", texto: "Uso adequado de uniforme" },
        ],
      },
      {
        titulo: "Caixa e sistema",
        itens: [
          { id: "equipamentos", texto: "Verificar o funcionamento dos equipamentos (caixa, computador, etc.)" },
          { id: "fundo", texto: "Conferir o fundo de caixa" },
          { id: "valor_inicial", texto: "Registrar o valor inicial no sistema de caixa" },
          { id: "placa", texto: "Virar a placa de fechado para aberto" },
        ],
      },
      {
        titulo: "Temperaturas",
        itens: [
          { id: "temp_geladeiras", tipo: "temp", max: -18, texto: "Temperatura das geladeiras/freezers (sempre estar em -18°C)" },
          { id: "temp_camara", tipo: "temp", max: -18, texto: "Temperatura da câmara fria" },
        ],
      },
      {
        titulo: "Limpeza e salão",
        itens: [
          { id: "carrinhos", texto: "Colocar os carrinhos de compras no local indicado para os clientes" },
          { id: "limpeza", texto: "Varrer, passar pano, tirar pó e limpar os vidros dos expositores" },
          { id: "soleiras", texto: "Tirar pó das soleiras das janelas" },
          { id: "lixo", texto: "Tirar o lixo" },
          { id: "estacionamento", texto: "Verificar se há lixo no estacionamento ou algum detrito de animal" },
          { id: "repor", texto: "Conferir os produtos em exposição e repor, se necessário" },
          { id: "precos", texto: "Verificar se todos os produtos expostos estão com preço" },
          { id: "banheiro", texto: "Deixar o banheiro limpo para uso" },
          { id: "sabao", texto: "Verificar abastecimento de sabão e papel no banheiro" },
          { id: "copa", texto: "Deixar a copa limpa e organizada" },
        ],
      },
      {
        titulo: "Equipamentos e fachada",
        itens: [
          { id: "forno", texto: "Ligar forno e estufa" },
          { id: "ar", texto: "Ligar ar condicionado" },
          { id: "tv", texto: "Ligar TV" },
          { id: "degustacao", texto: "Colocar degustação no forno" },
          { id: "bandeiras", texto: "Colocar as bandeiras na rua", na: "Chovendo" },
          { id: "sacolas", texto: "Verificar estoque de sacolas no caixa" },
        ],
      },
      {
        titulo: "iFood, Delivery e WhatsApp",
        itens: [
          { id: "ifood", novo: true, texto: "iFood: loja aberta e itens disponíveis/pausados conferidos com o estoque" },
          { id: "delivery", novo: true, texto: "Delivery: verificar itens disponíveis e pedidos pendentes" },
          { id: "whats_manha", novo: true, texto: "Responder os clientes pendentes no WhatsApp" },
        ],
      },
      { titulo: "Lotes e vencimentos", itens: ITENS_LOTE.map((i) => ({ ...i, novo: true })) },
    ],
    fotos: [
      { id: "f_fachada", texto: "Fachada com a placa de ABERTO" },
      { id: "f_temp_gel", texto: "Visor de temperatura das geladeiras/freezers" },
      { id: "f_temp_cam", texto: "Visor de temperatura da câmara fria" },
      { id: "f_salao", texto: "Salão e expositores limpos" },
      { id: "f_banheiro", texto: "Banheiro limpo" },
    ],
  },

  fechamento_loja: {
    codigo: "BKF04",
    titulo: "Fechamento de Loja",
    icone: "🔒",
    categoria: "loja",
    secoes: [
      {
        titulo: "Salão",
        itens: [
          { id: "organizacao", texto: "Verificar a organização e limpeza da loja" },
          { id: "repor", texto: "Repor produtos nos expositores, se necessário" },
          { id: "carrinhos", texto: "Recolher os carrinhos e colocar no local indicado (dentro da loja)" },
          { id: "bandeiras", texto: "Guardar bandeiras", na: "Não foram colocadas hoje" },
        ],
      },
      {
        titulo: "Caixa",
        itens: [
          { id: "conferencia_caixa", texto: "Realizar a conferência do caixa" },
          { id: "valor_final", texto: "Registrar o valor final no sistema" },
          { id: "malote", texto: "Entregar o malote para o responsável guardar em local seguro" },
        ],
      },
      {
        titulo: "WhatsApp",
        itens: [{ id: "whats_noite", novo: true, texto: "Responder os clientes pendentes no WhatsApp" }],
      },
      { titulo: "Lotes e vencimentos", itens: ITENS_LOTE.map((i) => ({ ...i, novo: true })) },
      {
        titulo: "Encerramento",
        itens: [
          { id: "desligar_ar", novo: true, texto: "Desligar o ar-condicionado" },
          { id: "desligar", texto: "Desligar todos os equipamentos elétricos (forno, estufa, TV, luzes), exceto os de refrigeração e segurança" },
          { id: "portas", texto: "Verificar o fechamento de portas e janelas" },
          { id: "alarme", texto: "Ativar o sistema de alarme" },
          { id: "trancar", texto: "Trancar a porta principal com segurança" },
        ],
      },
    ],
    fotos: [
      { id: "f_salao", texto: "Salão organizado e limpo" },
      { id: "f_expositores", texto: "Expositores/freezers abastecidos e fechados" },
      { id: "f_ar", texto: "AR-CONDICIONADO DESLIGADO (visor/controle apagado)" },
      { id: "f_forno", texto: "Forno e estufa desligados" },
      { id: "f_tv", texto: "TV e luzes do salão desligadas" },
      { id: "f_porta", texto: "Porta principal trancada" },
    ],
  },

  abertura_caixa_manha: {
    codigo: "BKF07",
    titulo: "Abertura de Caixa — Manhã",
    icone: "💰",
    categoria: "caixa",
    modoCaixa: "abertura",
    secoes: [
      {
        titulo: "Checagens",
        itens: [
          { id: "abrir_malote", texto: "Abrir o malote com o fundo de caixa" },
          { id: "operador", texto: "Colocar o código do operador e senha no PDV" },
          { id: "inserir_fundo", texto: "Inserir o valor do fundo de caixa no PDV" },
        ],
      },
    ],
    fotos: [],
  },

  abertura_caixa_tarde: {
    codigo: "BKF08",
    titulo: "Abertura de Caixa — Tarde",
    icone: "💰",
    categoria: "caixa",
    modoCaixa: "abertura",
    secoes: [
      {
        titulo: "Checagens",
        itens: [
          { id: "operador", texto: "Colocar o código do operador e senha no PDV" },
          { id: "inserir_fundo", texto: "Inserir o valor do fundo de caixa no PDV" },
        ],
      },
    ],
    fotos: [],
  },

  fechamento_caixa_tarde: {
    codigo: "BKF06",
    titulo: "Fechamento de Caixa — Tarde",
    icone: "🧾",
    categoria: "caixa",
    modoCaixa: "fechamento",
    secoes: [
      {
        titulo: "Checagens",
        itens: [
          { id: "sangria", texto: "Se passar de R$ 200,00, fazer SANGRIA no PDV com o valor a mais" },
          { id: "fecha_operador", texto: "Apertar FECHA CAIXA OPERADOR" },
          { id: "cupons", texto: "Separar os cupons fiscais: crédito, débito e PIX, cada um em um clips" },
          { id: "malote", texto: "Colocar o valor da sangria e todos os cupons fiscais no malote" },
          { id: "entregar", texto: "Entregar o malote para o responsável" },
        ],
      },
    ],
    fotos: [],
  },

  fechamento_caixa_noite: {
    codigo: "BKF05",
    titulo: "Fechamento de Caixa — Noite",
    icone: "🧾",
    categoria: "caixa",
    modoCaixa: "fechamento",
    secoes: [
      {
        titulo: "Checagens",
        itens: [
          { id: "sangria", texto: "Se passar de R$ 200,00, fazer SANGRIA no PDV com o valor a mais" },
          { id: "reducao_z", texto: "Apertar REDUÇÃO Z para sair os relatórios diário e de fechamento de caixa" },
          { id: "cupons", texto: "Separar os cupons fiscais: crédito, débito e PIX, cada um em um clips" },
          { id: "malote", texto: "Colocar as notas do fundo de caixa, todos os cupons fiscais e o relatório no malote" },
          { id: "entregar", texto: "Entregar o malote para o responsável" },
        ],
      },
    ],
    fotos: [],
  },

  recebimento_caminhao: {
    codigo: "ATIV",
    titulo: "Recebimento do Caminhão",
    icone: "🚚",
    categoria: "atividade",
    secoes: [
      {
        titulo: "Data de recebimento",
        itens: [
          { id: "data_receb", tipo: "data", texto: "Data em que o caminhão chegou" },
        ],
      },
      {
        titulo: "Organização da câmara fria",
        itens: [
          { id: "guardar", texto: "Guardar os congelados imediatamente na câmara fria (nada esperando fora)" },
          { id: "categorias", texto: "Produtos separados por tipo/categoria" },
          { id: "peps", texto: "PEPS: validade mais próxima na frente, mercadoria nova atrás" },
          { id: "chao", texto: "Nenhuma caixa direto no chão (usar estrados/prateleiras)" },
          { id: "caixas", texto: "Caixas abertas fechadas e identificadas" },
          { id: "vencidos", tipo: "lote", texto: "Retirar produtos vencidos ou avariados" },
          { id: "piso", texto: "Limpar piso e prateleiras" },
          { id: "temp_final", tipo: "temp", max: -18, texto: "Temperatura da câmara fria ao terminar" },
        ],
      },
      {
        titulo: "Lançamento dos lotes",
        itens: [
          { id: "planilha", texto: "Lançar lote e vencimento de todos os produtos recebidos na planilha de vencimento" },
          { id: "planilha_conf", texto: "Conferir se nenhum produto recebido ficou sem lançar" },
        ],
      },
    ],
    fotos: [
      { id: "f_camara_geral", texto: "Câmara fria organizada — visão geral" },
      { id: "f_camara_prat", texto: "Prateleiras organizadas (PEPS)" },
    ],
  },

  limpeza_freezers: {
    codigo: "ATIV",
    titulo: "Limpeza dos Freezers",
    icone: "🧽",
    categoria: "atividade",
    periodicidadeDias: 15,
    secoes: [
      {
        titulo: "Preparação",
        itens: [
          { id: "quais", tipo: "texto", texto: "Qual freezer será descongelado e limpo?", placeholder: "Ex.: Freezer 2 (pão de queijo)" },
          { id: "transferir", texto: "Transferir os produtos para a câmara fria antes de desligar" },
          { id: "desligar", texto: "Desligar o freezer da tomada" },
          { id: "degelo", texto: "Fazer o degelo completo (retirar todo o gelo)" },
        ],
      },
      {
        titulo: "Limpeza",
        itens: [
          { id: "limpar", texto: "Limpar por dentro e por fora com pano, água e sabão neutro" },
          { id: "secar", texto: "Secar bem por dentro e as borrachas da tampa/porta" },
          { id: "religar", texto: "Religar e esperar atingir a temperatura antes de recolocar os produtos" },
          { id: "temp_religado", tipo: "temp", max: -18, texto: "Temperatura do freezer antes de recolocar os produtos" },
          { id: "recolocar", tipo: "lote", texto: "Recolocar os produtos pelo PEPS, conferindo as validades" },
        ],
      },
    ],
    fotos: [
      { id: "f_freezer_limpo", texto: "Freezer desligado, vazio e limpo" },
      { id: "f_freezer_cheio", texto: "Freezer religado e reabastecido" },
    ],
  },

  solicitacao_compras: {
    codigo: "BK08",
    titulo: "Solicitação de Compras",
    icone: "🛒",
    categoria: "compras",
    secoes: [],
    fotos: [],
  },

  ocorrencia: {
    codigo: "OCOR",
    titulo: "Reportar Ocorrência",
    icone: "🚨",
    categoria: "ocorrencia",
    secoes: [],
    fotos: [],
  },
};

const CATEGORIAS_OCORRENCIA = [
  "Equipamento com defeito",
  "Refrigeração / temperatura",
  "Estrutura / manutenção",
  "Falta de energia, água ou internet",
  "Sistema / PDV / maquininha",
  "Cliente (reclamação ou problema)",
  "Funcionário",
  "Segurança / furto",
  "Produto (avaria, vencido, falta)",
  "Fornecedor / entrega",
  "Outro",
];
const URGENCIAS = ["Baixa", "Média", "Alta"];

// Itens "achatados" de um check-list, na ordem.
function itensDoChecklist(def) {
  return def.secoes.flatMap((s) => s.itens.map((i) => ({ ...i, tipo: i.tipo || "check", secao: s.titulo })));
}
