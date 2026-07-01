# Spec - Video Slide Web

## 1. Decisao arquitetural

A arquitetura adotada e por camadas simples com leve agrupamento por dominio:

- `app`: composicao da aplicacao, navegacao interna e layout raiz.
- `features`: fluxos de produto, como editor e player.
- `entities`: tipos e contratos de dominio.
- `shared`: Firebase, utilitarios e estilos compartilhados.

Essa abordagem evita a complexidade de uma Clean Architecture completa e tambem evita uma Feature-Sliced Design formal demais para o tamanho do MVP.

## 2. Stack

- React 19.
- Vite 8.
- TypeScript 6.
- Tailwind CSS 4 via `@tailwindcss/vite`.
- Firebase JS SDK modular para Firestore e Storage.
- Bun para scripts locais, conforme `package.json`.

## 3. Variaveis de ambiente

Todas as variaveis expostas ao cliente devem usar prefixo `VITE_`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Se alguma variavel obrigatoria estiver ausente, o app usa persistencia local para desenvolvimento com metadados em `localStorage` e arquivos em IndexedDB.

## 4. Modelo de dominio

### Presentation

- `id`: identificador unico.
- `title`: titulo editavel.
- `videos`: lista ordenada de `VideoItem`.
- `status`: `draft` ou `ready`.
- `createdAt`: ISO string.
- `updatedAt`: ISO string.

### VideoItem

- `id`: identificador unico.
- `order`: posicao na apresentacao.
- `fileName`: nome original.
- `sizeBytes`: tamanho em bytes.
- `durationSeconds`: duracao extraida no navegador.
- `mimeType`: tipo MIME.
- `uploadedAt`: ISO string.
- `storagePath`: caminho no Storage ou identificador local.
- `downloadUrl`: URL para reproducao.
- `playbackMode`: `loop`, `pauseAtEnd` ou `autoAdvance`.

## 5. Firebase

O MVP nao usa Firebase Auth. O projeto opera como workspace unico interno.

Firestore:

- Colecao: `presentations`.
- Documento: `presentations/{presentationId}`.
- Videos ficam embutidos em array porque o MVP usa listas pequenas e precisa salvar a apresentacao como uma unidade.

Storage:

- Caminho: `presentations/{presentationId}/videos/{videoId}-{safeFileName}`.

## 6. Fluxos

### Criar apresentacao

1. Gerar `presentationId` no cliente.
2. Criar draft em memoria.
3. Usuario define titulo e adiciona videos.
4. Ao salvar, persistir no Firestore ou localStorage.

### Upload de video

1. Usuario seleciona arquivo `video/*`.
2. Extrair metadados via `File` e elemento `video` temporario.
3. Fazer upload para Storage se Firebase estiver configurado.
4. Em fallback local, salvar o arquivo em IndexedDB e gerar uma object URL para reproducao.
5. Adicionar `VideoItem` na lista.

### Apresentar

1. Ordenar videos por `order`.
2. Renderizar o video atual.
3. Em `loop`, manter o mesmo video em loop.
4. Em `pauseAtEnd`, aguardar acao manual para avancar.
5. Em `autoAdvance`, avancar ao terminar.

## 7. Estados de UI

- Lista vazia de apresentacoes.
- Formulario de titulo vazio.
- Upload em progresso.
- Erro de upload ou metadados invalidos.
- Apresentacao sem videos.
- Fim da apresentacao.
- Firebase ausente usando modo local.

## 8. Regras e validacoes

- Aceitar apenas arquivos cujo MIME type comece com `video/`.
- Nao iniciar apresentacao sem videos.
- Normalizar `order` apos remover ou mover videos.
- Salvar `updatedAt` a cada persistencia.
- Tratar falhas de Firebase com mensagem clara.
- Ao excluir videos ou apresentacoes, remover tambem os arquivos associados no Storage ou IndexedDB local.

## 9. Plano de testes

- `bun run build`: valida TypeScript e build Vite.
- `bun run lint`: valida Oxlint.
- Teste manual: criar apresentacao, adicionar videos, salvar, recarregar e abrir.
- Teste manual: remover e reordenar videos.
- Teste manual: validar os tres modos de reproducao.
- Teste manual: rodar sem `.env` Firebase e confirmar fallback local.

## 10. Decisoes pendentes

- Avaliar endurecimento das regras Firebase para ambiente fora da rede interna.
- Definir limites de tamanho/duracao por arquivo.
- Definir identidade visual final da empresa.
