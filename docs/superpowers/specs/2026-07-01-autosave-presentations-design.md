# Autosave de apresentacoes com videos

## Contexto

O sistema permite criar apresentacoes compostas por videos, configurar o comportamento de cada video e persistir os dados em Firebase ou no modo local. A interface atual tem elementos visuais que serao removidos e um botao manual de salvar que deve ser substituido por autosave.

## Objetivos

- Remover o bloco de persistencia da home, links de navegacao do header, botao "Fale conosco", footer, link "Ver biblioteca" e botao "Salvar".
- Abrir "Nova apresentacao" como rascunho apenas em memoria.
- Persistir automaticamente a apresentacao apos a primeira inclusao de video.
- Persistir automaticamente alteracoes relevantes posteriores: titulo, ordem, modo de reproducao e remocao de videos.
- Impedir que apresentacoes vazias sejam salvas.

## Decisao de arquitetura

`App.tsx` continua sendo o dono do estado de apresentacoes e da persistencia. `PresentationEditor` continua responsavel pela experiencia de edicao, upload e exclusao do arquivo de video, mas nao chama mais um fluxo manual de salvar.

O fluxo aprovado para "Nova apresentacao" cria um objeto `Presentation` no estado local e abre o editor. Esse objeto so passa a ser salvo por `savePresentation` quando tiver pelo menos um video. Assim, o usuario pode abandonar um rascunho vazio sem gerar item salvo.

## Fluxo de autosave

`PresentationEditor` chama `onChange` para cada alteracao relevante. O `App` atualiza o estado e, se a apresentacao tiver videos, agenda a persistencia usando o fluxo existente `savePresentation`. O agendamento deve ser por apresentacao e seguir a regra "ultimo estado vence": edicoes rapidas substituem saves pendentes, e uma resposta antiga nao deve restaurar dados obsoletos no estado.

O autosave preserva a regra do botao manual atual: titulo vazio nao deve ser salvo como titulo invalido. Antes de persistir, o titulo sera normalizado com `trim`; se ficar vazio, a apresentacao sera salva com o titulo padrao valido `"Nova apresentacao"` para que o primeiro upload consiga criar o registro sem exigir uma acao manual extra.

Quando um video for removido, o editor atualiza a apresentacao e o autosave persiste a nova lista. Depois, o asset do video removido e excluido com `deletePresentationVideo`. Se a remocao deixar a apresentacao sem videos, saves pendentes dessa apresentacao devem ser cancelados, o registro persistido deve ser excluido com o fluxo existente de exclusao de apresentacao, e o editor pode manter o rascunho aberto apenas em memoria. A biblioteca nao deve exibir itens vazios.

## UI

As remocoes sao estritamente visuais e nao alteram o design geral:

- remover o card/bloco de persistencia da home;
- remover navegacao do header;
- remover "Fale conosco";
- remover footer;
- remover "Ver biblioteca";
- remover botao "Salvar" do editor.

O botao "Nova apresentacao" permanece e abre o editor.

## Erros e feedback

O feedback existente de toast e mensagens de erro sera reaproveitado. O autosave pode mostrar mensagens discretas para falhas de persistencia e para a validacao de titulo vazio. Indicadores existentes de upload e remocao continuam ativos.

## Validacao

Validar manualmente e por comandos disponiveis:

- o build/lint continua passando;
- os elementos removidos nao aparecem;
- "Nova apresentacao" sem video nao cria item salvo;
- adicionar video salva automaticamente;
- remover video salva automaticamente;
- alterar modo de reproducao salva automaticamente;
- nao ha erros no console durante o fluxo principal.
