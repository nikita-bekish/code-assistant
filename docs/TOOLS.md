# Tool Calling in Chat

## Обзор

Теперь LLM (Ollama) может автоматически вызывать git инструменты при ответе на вопросы. Это позволяет ассистенту получать актуальную информацию о состоянии репозитория.

## Как это работает

### Архитектура Tool Calling (Подход 2)

```
User Question
     ↓
RAG Search (документация)
     ↓
LLM + Tool Prompt
     ↓
Does LLM need git info?
     ├─→ Yes: Execute Tool
     │        ↓
     │    Return Result
     │        ↓
     │    LLM continues...
     │
     └─→ No: Generate final answer
              ↓
           Return to User
```

## Доступные Инструменты

### 1. `git_branch`
Получить текущую ветку репозитория

**Использование в ответе LLM:**
```
<tool>git_branch</tool>
<input></input>
```

**Результат:**
```
Current git branch: main
```

### 2. `git_status`
Получить статус репозитория (staged, unstaged, untracked files)

**Использование в ответе LLM:**
```
<tool>git_status</tool>
<input></input>
```

**Результат:**
```
Git Status:
 M src/chatbot.ts
 M src/codeAssistant.ts
?? test-mcp.js
```

## Реализация

### Методы в CodeAssistant

**`_generateAnswerWithTools(prompt: string)`** - Основной метод для генерации ответа с поддержкой инструментов
- Передает LLM систему с описанием инструментов
- Анализирует ответ на предмет вызовов инструментов
- Выполняет найденные инструменты
- Продолжает диалог с LLM для уточнения ответа

**`_getToolsDescription(): string`** - Возвращает описание доступных инструментов в формате подсказки для LLM

**`_executeTool(toolName: string): Promise<string>`** - Выполняет инструмент и возвращает результат

### Поток Работы

1. Пользователь задает вопрос: `"What branch are we on?"`
2. Ассистент выполняет RAG поиск в документации
3. LLM получает prompt с контекстом + описанием инструментов
4. LLM распознает, что нужна информация о ветке
5. LLM генерирует: `<tool>git_branch</tool><input></input>`
6. Ассистент перехватывает вызов и выполняет `git_branch`
7. Результат возвращается LLM: `Current git branch: main`
8. LLM формирует финальный ответ: `"Based on our repository, we are currently on the main branch"`

## Использование в Чате

Просто используйте обычный чат - LLM автоматически решит, нужны ли ему инструменты:

```bash
node bin/cli.js chat

# > What branch are we on?
# [LLM автоматически вызывает git_branch tool]
# Assistant: Based on the repository information, we are currently working on the main branch.

# > Show me the current status
# [LLM автоматически вызывает git_status tool]
# Assistant: The repository currently has the following changes...
```

## Особенности

✅ **Автоматическое распознавание** - LLM сам решает, когда нужны инструменты
✅ **Итеративный процесс** - Может вызвать несколько инструментов подряд
✅ **Интеграция с RAG** - Работает вместе с поиском в документации
✅ **Безопасность** - Ограничено только git инструментами, никаких произвольных команд
