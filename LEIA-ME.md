# Check-list BK

App para celular (PWA) com os check-lists diários da loja. Funciona sem internet. Os relatórios vão pelo WhatsApp e, quando o painel está ligado, também para uma planilha Google da gerência.

## O que tem no app

| Check-list | Formulário | Fotos obrigatórias |
|---|---|---|
| Abertura de Loja | BKF03 | Fachada com a placa de ABERTO, visor das geladeiras, visor da câmara fria, salão, banheiro |
| Fechamento de Loja | BKF04 | Salão, expositores, **ar-condicionado desligado**, forno e estufa, TV e luzes, porta trancada |
| Abertura de Caixa (manhã e tarde) | BKF07 / BKF08 | — |
| Fechamento de Caixa (tarde e noite) | BKF06 / BKF05 | — |
| Recebimento do Caminhão (1x por semana) | — | Câmara fria organizada (visão geral e prateleiras) |
| Limpeza dos Freezers (a cada 15 dias) | — | Freezer vazio e limpo, freezer religado e reabastecido |
| Reportar Ocorrência | — | Opcionais |
| Solicitação de Compras | BK08 | — |

O que foi acrescentado aos formulários de papel aparece com a etiqueta **NOVO**:
- **Abertura:** iFood, Delivery, responder os clientes pendentes no WhatsApp, lotes e vencimentos na planilha e nos freezers.
- **Fechamento:** responder os clientes no WhatsApp, lotes e vencimentos na planilha e nos freezers, desligar o ar-condicionado.

**Atividades do dia:**
- **Recebimento do Caminhão:** a pessoa informa a data de recebimento, organiza a câmara fria (PEPS, nada no chão, retirar vencidos, temperatura final) e lança os lotes na planilha de vencimento. O card mostra a data do último recebimento.
- **Limpeza dos Freezers:** a pessoa informa qual freezer será descongelado e limpo e segue o passo a passo (transferir produtos, desligar, degelo, limpar, secar, religar, conferir a temperatura e recolocar pelo PEPS). O app conta os 15 dias: mostra quando é a próxima e, quando vence, coloca um aviso no topo da tela inicial. No painel da gerência aparece "Em dia" ou "Atrasada" para cada loja.

Regras:
- Todo item precisa ser respondido: **Feito**, **Pendência** (com descrição obrigatória) ou **Não se aplica**, este só nos itens em que faz sentido (ex.: bandeiras com chuva).
- A temperatura é digitada. Acima de -18 °C vira alerta e é preciso explicar o que foi feito.
- As fotos têm que ser tiradas na hora: o app recusa foto antiga da galeria e grava data, hora, loja e nome em cada foto.
- Caixa: a pessoa digita a quantidade de cada nota e moeda e o app soma. No fechamento, o app sugere a sangria (o que passar de R$ 300) e calcula o fundo do próximo turno.
- Quando há pendências, o app obriga a avisar o grupo da loja antes de liberar o envio do relatório para a gerência.
- Se o app fechar no meio, o check-list continua de onde parou.

## Ligar o Painel da gerência (uma vez só, ~5 min)

1. No computador, entre no Google Drive com a conta da gerência e crie uma **Planilha Google** nova, por exemplo "Check-list BK - Painel".
2. Na planilha, abra **Extensões → Apps Script**.
3. Apague o que estiver escrito, cole todo o conteúdo do arquivo `gerencia/Codigo.gs` e, na linha `const CHAVE = "TROQUE-ESTA-CHAVE";`, troque o texto por uma senha só sua (letras e números, sem espaço).
4. Clique em 💾 Salvar. Escolha a função **autorizar** no menu ao lado de ▶ Executar e clique em **Executar**. Depois autorize o acesso com a sua conta. Se aparecer "app não verificado", clique em "Avançado → Acessar".
5. Clique em **Implantar → Nova implantação**, escolha o tipo **App da Web** e preencha:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).
7. No **seu celular**, abra o app e vá em ⚙ Ajustes. Em **Painel da gerência**, cole o link e a chave, marque **"Este celular é da gerência"**, toque em **Testar conexão** e depois em **Salvar**.
8. Ainda em Ajustes, toque em **"Enviar link de conexão para a loja"** e mande para o WhatsApp do celular da loja. Lá, é só abrir o link uma vez para o app ficar conectado.

Pronto. Cada check-list finalizado entra numa linha da aba **Registros** e o PDF com as fotos fica salvo no seu Drive, na pasta **Check-list BK - Relatórios** (uma subpasta por mês). No seu celular, o card **📊 Painel da gerência** mostra a rotina do dia de cada loja (o que foi feito, a que horas, por quem e com quantas pendências) e as ocorrências no topo.

Se você alterar o script depois, use **Implantar → Gerenciar implantações → editar → Nova versão** para o link continuar o mesmo.

## Editar itens

Os itens e as fotos de cada check-list ficam em `js/checklists.js`. Depois de editar, aumente o número em `CACHE_NAME` no `sw.js` (ex.: `checklist-bk-v2`) e publique de novo.
