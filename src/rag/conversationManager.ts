import { Message, Conversation, ProjectContext, SearchResult } from '../types/index.js';

export class ConversationManager {
  private conversation: Conversation;
  private maxMessages: number = 50;

  constructor(projectContext: ProjectContext) {
    this.conversation = {
      id: `conv_${Date.now()}`,
      messages: [],
      projectContext,
      createdAt: Date.now()
    };
  }

  /**
   * Add a user message to the conversation
   */
  addUserMessage(content: string): void {
    this.conversation.messages.push({
      role: 'user',
      content,
      timestamp: Date.now()
    });

    // Keep conversation size reasonable
    if (this.conversation.messages.length > this.maxMessages) {
      this.conversation.messages = this.conversation.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Add an assistant message with sources
   */
  addAssistantMessage(content: string, sources?: SearchResult[]): void {
    this.conversation.messages.push({
      role: 'assistant',
      content,
      timestamp: Date.now(),
      sources
    });

    // Keep conversation size reasonable
    if (this.conversation.messages.length > this.maxMessages) {
      this.conversation.messages = this.conversation.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Get the conversation history formatted for the LLM
   */
  getHistory(lastN: number = 5): string {
    const messages = this.conversation.messages.slice(-lastN);
    let history = '';

    for (const msg of messages) {
      if (msg.role === 'user') {
        history += `User: ${msg.content}\n`;
      } else {
        history += `Assistant: ${msg.content}\n`;
      }
    }

    return history;
  }

  /**
   * Get raw messages
   */
  getMessages(): Message[] {
    return this.conversation.messages;
  }

  /**
   * Get the full conversation
   */
  getConversation(): Conversation {
    return this.conversation;
  }

  /**
   * Clear conversation history
   */
  clear(): void {
    this.conversation.messages = [];
  }

  /**
   * Get summary of conversation for context
   */
  getSummary(): string {
    const totalMessages = this.conversation.messages.length;
    const userMessages = this.conversation.messages.filter(m => m.role === 'user').length;

    return `Conversation Summary:
- Total messages: ${totalMessages}
- User questions: ${userMessages}
- Duration: ${Math.round((Date.now() - this.conversation.createdAt) / 1000)}s
- Project: ${this.conversation.projectContext.name}`;
  }
}
