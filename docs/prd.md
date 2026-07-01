# PRD - Video Slide Web

## 1. Contexto

O Video Slide Web e um sistema interno para que um designer crie apresentacoes compostas por uma sequencia ordenada de videos. A experiencia deve se aproximar de uma apresentacao de slides, mas usando videos como unidades principais de conteudo.

## 2. Problema

Hoje a montagem e apresentacao de sequencias de videos tende a depender de ferramentas genericas, arquivos soltos ou processos manuais. Isso dificulta salvar versoes, controlar a ordem dos videos e definir o comportamento de cada video durante a apresentacao.

## 3. Publico-alvo

- Designer ou profissional de comunicacao interna que precisa montar apresentacoes visuais com videos.
- Time interno que precisa revisar ou apresentar sequencias sem editar video em ferramentas externas.

## 4. Objetivos

- Permitir criar e salvar varias apresentacoes.
- Permitir adicionar um ou mais videos por apresentacao.
- Armazenar videos no Firebase Storage quando o projeto Firebase estiver configurado.
- Persistir apresentacoes e metadados no Firestore quando configurado.
- Exibir metadados uteis de cada video.
- Permitir escolher comportamento individual: loop, pausar no fim ou avancar automaticamente.
- Oferecer modo apresentacao dedicado.

## 5. Escopo do MVP

- Workspace unico, sem autenticacao.
- Criacao, edicao, exclusao e listagem de apresentacoes.
- Upload de video por input.
- Extracao de nome, tamanho, duracao, MIME type e data de upload.
- Ordenacao manual por mover para cima/baixo.
- Player com suporte aos tres modos de reproducao.
- Fallback local para desenvolvimento quando variaveis Firebase nao estiverem configuradas.

## 6. Fora de escopo inicial

- Autenticacao e separacao por usuario.
- Compartilhamento publico por link.
- Edicao do conteudo do video.
- Conversao/transcodificacao de video.
- Funcionamento offline completo.
- Controle fino de permissoes por apresentacao.

## 7. Jornadas principais

1. Usuario abre o app e ve a lista de apresentacoes salvas.
2. Usuario cria uma apresentacao, define um titulo e adiciona videos.
3. Usuario revisa metadados, escolhe comportamento de cada video e reordena a lista.
4. Usuario salva a apresentacao.
5. Usuario inicia o modo apresentacao e percorre a sequencia conforme as regras configuradas.

## 8. Requisitos funcionais

- O sistema deve permitir criar apresentacoes com titulo.
- O sistema deve permitir adicionar multiplos videos a uma apresentacao.
- O sistema deve extrair e exibir metadados dos videos adicionados.
- O sistema deve permitir configurar `loop`, `pauseAtEnd` ou `autoAdvance` por video.
- O sistema deve persistir apresentacoes e videos.
- O sistema deve permitir remover e reordenar videos.
- O sistema deve permitir iniciar e encerrar o modo apresentacao.

## 9. Requisitos nao funcionais

- A interface deve ser responsiva.
- O estado de upload deve ter feedback visual.
- O app nao deve conter credenciais Firebase hardcoded.
- O build de producao deve passar em TypeScript e Vite.
- O codigo deve manter uma arquitetura simples, legivel e adequada ao porte do sistema.

## 10. Criterios de sucesso

- Um usuario consegue criar uma apresentacao com mais de um video.
- Os metadados aparecem apos o upload.
- A apresentacao salva aparece na listagem.
- O modo apresentacao respeita os tres comportamentos configurados.
- O app continua utilizavel em desenvolvimento sem Firebase configurado.

## 11. Perguntas em aberto

- O MVP definitivo tera Firebase Auth?
- Havera multiplos designers usando o mesmo workspace?
- O link da apresentacao precisara ser compartilhavel?
- Existirao limites de tamanho, duracao ou formato de video?
- A identidade visual seguira uma marca interna especifica?
