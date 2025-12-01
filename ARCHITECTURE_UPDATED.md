# Архитектура: RAG + MCP + Tool Calling

## Полная интеграция всех компонентов

```
┌────────────────────────────────────────────────────────┐
│                    User Chat                           │
│                                                        │
│  "What branch are we on and what is the setup?"       │
└─────────────────────┬────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        ↓                            ↓
   ┌─────────────┐          ┌──────────────────┐
   │ RAG Pipeline│          │ Tool Execution   │
   │             │          │ (git_branch,     │
   │ 1. Search   │          │  git_status)     │
   │    docs/    │          │                  │
   │    README   │          └──────────────────┘
   │             │                 ↑
   │ 2. Semantic │                 │
   │    search   │                 │
   │             │                 │
   │ 3. Rank &   │          ┌──────┴──────────┐
   │    filter   │          │ LLM (Ollama)    │
   └─────────────┘          │                │
        │                   │ - Reads RAG   │
        │                   │ - Decides on  │
        │                   │   tools       │
        │                   │ - Generates   │
        └───────────────────┤   answer      │
                            │                │
                            └────────────────┘
                                   │
                                   ↓
                            ┌─────────────┐
                            │ Final Answer│
                            │ to User     │
                            └─────────────┘
```

## Компоненты

### 1️⃣ RAG Pipeline (Документация)
- **Индексация**: README.md + /docs (SETUP, CONFIG, EXAMPLES, API, ARCHITECTURE)
- **Поиск**: Semantic search с embeddings
- **Формат**: 231 чанк с метаданными
- **Использование**: Контекст для LLM

### 2️⃣ Tool Calling (Git инструменты)
- **git_branch**: Получить текущую ветку
- **git_status**: Получить статус репозитория
- **Механизм**: LLM генерирует `<tool>name</tool><input></input>`
- **Выполнение**: Автоматическое перехватывание и исполнение

### 3️⃣ LLM (Ollama)
- **Модель**: llama3.2
- **Контекст**: RAG результаты + описание инструментов
- **Решение**: Вызывает ли инструменты или нет
- **Ответ**: Естественный, основанный на всех источниках

## Поток выполнения для вопроса

```
                                   [User Input]
                                        │
                                        ↓
                         ┌──────────────────────────┐
                         │ 1. Parse Question        │
                         │    "What branch we on?"  │
                         └──────────────┬───────────┘
                                        ↓
                         ┌──────────────────────────┐
                         │ 2. RAG Search            │
                         │ (Find git docs/README)   │
                         └──────────────┬───────────┘
                                        ↓
                    ┌───────────────────────────────────┐
                    │ 3. Create Prompt                  │
                    │ - Context from RAG                │
                    │ - Tool descriptions               │
                    │ - Instructions to LLM             │
                    └───────────────┬───────────────────┘
                                    ↓
                    ┌───────────────────────────────────┐
                    │ 4. LLM Generates Response         │
                    │ (Iteration 1)                     │
                    └───────────────┬───────────────────┘
                                    ↓
                    ┌───────────────────────────────────┐
                    │ 5. Check for Tool Calls           │
                    │ Regex: <tool>(\w+)</tool>         │
                    └───────────────┬───────────────────┘
                                    ↓
                        ┌───────────────────────┐
                        │ Tool Found?           │
                        └─┬─────────────────┬──┘
                   Yes   │                 │  No
                        ↓                 ↓
                   ┌────────────┐    ┌───────────────┐
                   │ Execute    │    │ Return Answer │
                   │ Tool       │    │ to User       │
                   └────┬───────┘    └───────────────┘
                        ↓
                   ┌────────────────┐
                   │ Get Result     │
                   │ (e.g., main)   │
                   └────┬───────────┘
                        ↓
                   ┌────────────────────────────┐
                   │ 6. Iteration 2+            │
                   │ LLM now has:               │
                   │ - Original context (RAG)   │
                   │ - Tool result              │
                   │ - Instructions to finish   │
                   └────┬───────────────────────┘
                        ↓
                   ┌────────────────┐
                   │ Generate Final │
                   │ Answer         │
                   └────┬───────────┘
                        ↓
                   [Return to User]
```

## Пример Диалога

```
User: What is the setup and which branch are we on?

LLM (Iteration 1):
Looking at the project, I'll get the setup information and check the current branch.

<tool>git_branch</tool>
<input></input>

[Tool executed: git_branch → "main"]

LLM (Iteration 2):
The project uses llama3.2 for the LLM component and supports semantic search. 
We are currently working on the main branch.

[No more tools needed]

[Return to User]:
"According to the documentation, the setup involves installing dependencies with npm 
and configuring the embedding model. The project is currently on the main branch."
```

## Интеграция с MCP (Бонус)

MCP сервер все еще работает отдельно для внешних клиентов:

```
External Client (Claude Desktop)
         │
         ├─ /mcp start
         │
         ↓
    MCP Server (stdio)
         │
         ├─ git_branch tool
         ├─ git_status tool
         │
         ↓
    External LLM использует результаты
```

## Статус для зачета

| Компонент | Статус | Использование |
|-----------|--------|-----------------|
| RAG (README + docs) | ✅ | 231 чанков, семантический поиск |
| MCP (git tools) | ✅ | Доступен через `/mcp start` |
| Tool Calling | ✅ | LLM вызывает инструменты автоматически |
| /help команда | ✅ | Использует RAG + Tools |
| Chat интеграция | ✅ | Обычные вопросы с инструментами |

## Что улучшилось

### До Tool Calling
```
User: "What branch are we on?"
→ RAG ищет в документации
→ LLM видит только RAG результаты
→ Может не найти точный ответ
```

### После Tool Calling
```
User: "What branch are we on?"
→ RAG ищет в документации
→ LLM распознает необходимость инструмента
→ Вызывает git_branch
→ Получает "main"
→ Формирует точный ответ
```

## Готово к использованию!

```bash
npm run build
node bin/cli.js chat

> What branch are we on?
# LLM автоматически использует git_branch tool

> Show setup and status
# LLM может вызвать оба инструмента по необходимости
```
