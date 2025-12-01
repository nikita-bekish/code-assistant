# Tool Calling Implementation Summary

## ✅ Что было реализовано

### Подход 2: Tool-Calling via Prompt (для Ollama)

LLM теперь может автоматически вызывать git инструменты при ответе на вопросы.

## Новые методы в CodeAssistant

### 1. `_generateAnswerWithTools(prompt: string): Promise<string>`

Основной метод, заменивший `_generateAnswerWithLLM`:

```typescript
private async _generateAnswerWithTools(prompt: string): Promise<string> {
  // Получает LLM с описанием инструментов
  const toolsDescription = this._getToolsDescription();
  let fullPrompt = prompt + '\n\n' + toolsDescription;
  
  // Итеративный процесс (до 5 итераций)
  while (iterations < maxIterations) {
    // LLM генерирует ответ
    const response = await this.llm.invoke(fullPrompt);
    
    // Проверяет, использует ли LLM инструменты
    const toolMatch = response.match(/<tool>(\w+)<\/tool>\s*<input>(.*?)<\/input>/s);
    
    if (!toolMatch) {
      // Нет инструментов - готов ответ
      break;
    }
    
    // Выполняет инструмент
    const toolResult = await this._executeTool(toolName);
    
    // Продолжает диалог с LLM
    fullPrompt = `${response}\n\nTool result:\n${toolResult}\n\nContinue...`;
  }
}
```

### 2. `_getToolsDescription(): string`

Описание доступных инструментов для LLM:

```typescript
private _getToolsDescription(): string {
  return `
You have access to the following tools:
1. git_branch - Get the current git branch name
2. git_status - Get git repository status

Format: <tool>tool_name</tool><input>input</input>
`;
}
```

### 3. `_executeTool(toolName: string): Promise<string>`

Выполнение инструмента:

```typescript
private async _executeTool(toolName: string): Promise<string> {
  switch (toolName) {
    case 'git_branch':
      return await this.git.getProjectStats().branch;
    case 'git_status':
      return await this.git.getStatus();
    default:
      return `Unknown tool`;
  }
}
```

## Изменения в ask()

Теперь вместо:
```typescript
answer = await this._generateAnswerWithLLM(prompt);
```

Используется:
```typescript
answer = await this._generateAnswerWithTools(prompt);
```

## Поток Работы

```
User: "What branch are we on?"
  ↓
1. RAG ищет документацию
  ↓
2. LLM получает prompt с инструментами
  ↓
3. LLM понимает, что нужна информация о ветке
  ↓
4. LLM генерирует: "<tool>git_branch</tool><input></input>"
  ↓
5. Код перехватывает вызов
  ↓
6. Выполняет: git.getProjectStats()
  ↓
7. Возвращает: "Current git branch: main"
  ↓
8. LLM формирует финальный ответ
  ↓
9. User видит: "We are on the main branch..."
```

## Файлы

### Модифицированные:
- `src/codeAssistant.ts` - Добавлены методы для tool calling
- `src/chatbot.ts` - Обновлена справка

### Созданные:
- `docs/TOOLS.md` - Документация по инструментам
- `test-tools.ts` - Тестовый скрипт

## Тестирование

```bash
# Собрать проект
npm run build

# Запустить чат
node bin/cli.js chat

# Примеры вопросов:
# > What branch are we on?
# > Show me the git status
# > What is the project structure and which branch are we on?
```

## Отличия от других подходов

### Подход 1 (LangChain Tools + Agent)
- Требует функции function calling (GPT, Claude)
- Ollama это не поддерживает

### Подход 3 (Simple)
- LLM не может вызвать инструменты
- Информация только в prompt

### Подход 2 (Выбранный) ✅
- Работает с Ollama
- LLM может вызывать инструменты по необходимости
- Простая реализация
- Хорошая интеграция с RAG
