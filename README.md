# ROBOTTO

Teletriagem em telemedicina otorrinolaringológica.

## Visão Geral

ROBOTTO é uma aplicação web simples que auxilia na triagem inicial de queixas
otorrinolaringológicas. O fluxo de atendimento é automatizado e conduz o
usuário por perguntas padronizadas até uma orientação preliminar, sem substituir
avaliação médica presencial.

## Como funciona

1. **Consentimento LGPD** – Ao abrir a página o usuário precisa aceitar o uso de
   dados para continuar.
2. **Queixa principal** – O paciente descreve sua queixa em texto livre.
3. **Classificação de domínio** – O texto é analisado para identificar se a
   queixa está relacionada a ouvido, nariz, garganta ou outro.
4. **Perguntas de red flag** – Para o domínio identificado são exibidas perguntas
   de alerta, três por vez. As respostas são dadas por botões *Sim*, *Não* ou
   *Não sei*.
5. **Orientação** –
   - Se alguma red flag recebe resposta *Sim*, o usuário é orientado a buscar
     atendimento presencial imediato.
   - Caso todas as red flags sejam negativas, a aplicação apresenta um resumo e
     uma rede de segurança com orientações não urgentes.
6. **Reiniciar** – Um botão permite reiniciar a triagem a qualquer momento.

## Regras de Triagem (rules_otorrino.json)

- [rules_otorrino.json](./rules_otorrino.json) centraliza a lógica de triagem.
- O arquivo deve conter o campo `updated_at`, utilizado para controle de versão
  e cache.
- Valide o arquivo executando `python validate_rules.py --path rules_otorrino.json`.
- Ao atualizar o campo `updated_at`, revise o JSON e peça revisão clínica via
  PR dedicado.

## Estrutura do Projeto

- `index.html` – marcação da interface e estilos básicos.
- `app.js` – lógica de interação do chat.
- `rules_otorrino.json` – regras de triagem utilizadas pelo chat.
- `validate_rules.py` – script para validar o arquivo de regras.

## Envio de resultados

Ao final da triagem, o botão **Enviar para médico** permite compartilhar o resumo:

- Se a variável global `DOCTOR_ENDPOINT` estiver definida, os dados são enviados via requisição `POST` para esse endpoint.
- Caso contrário, o envio é apenas simulado: é gerado um link `mailto:` com o resumo e um arquivo `triagem.json` é oferecido para download manual.
- Nessa situação, uma mensagem informa ao usuário que o envio não foi feito automaticamente.

## Execução Local

Por ser uma aplicação estática, basta abrir `index.html` em um navegador
compatível. Para atualizar as regras, modifique `rules_otorrino.json` e valide o
conteúdo com `python validate_rules.py --path rules_otorrino.json`.

## Validação e Testes

Execute os comandos abaixo para validar o arquivo de regras e rodar os testes automatizados:

```bash
python validate_rules.py --path rules_otorrino.json
pytest -q
```

## Boas práticas de acessibilidade

- Botões de respostas rápidas possuem atributos `aria-label` descritivos.
- Todas as opções podem ser navegadas via teclado (Tab) e selecionadas com **Enter** ou **Espaço**.
- Recomenda-se testar a interface com leitores de tela como [NVDA](https://www.nvaccess.org/) ou VoiceOver.
- Ao adicionar novos componentes, mantenha contraste e semântica adequados.

## Política de retenção de dados

- As informações do chat e o consentimento LGPD são armazenados apenas no
  navegador do usuário.
- Esses dados são preservados por até **30 dias**; depois desse período, ao
  carregar a página, eles são removidos automaticamente.
- O botão **Reiniciar** também limpa imediatamente todas as informações
  armazenadas.

