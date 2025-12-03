import { CRMService } from './crmService.js';
import { CodeAssistant } from '../codeAssistant.js';
import { SupportResponse, Ticket } from './types.js';
import { ProjectConfig } from '../types/index.js';

/**
 * Support Assistant
 * Handles customer support inquiries using RAG for context and CRM for ticket management
 */
export class SupportAssistant {
  private crm: CRMService;
  private assistant: CodeAssistant;

  constructor(crmPath: string, config: ProjectConfig) {
    this.crm = new CRMService(crmPath);
    this.assistant = new CodeAssistant(config);
  }

  /**
   * Initialize the assistant
   */
  async initialize(): Promise<void> {
    await this.assistant.initialize();
  }

  /**
   * Answer a customer support question
   * @param question The customer's question
   * @param userId The user asking the question
   * @param ticketId Optional ticket ID to associate the answer with
   * @returns SupportResponse with answer and related documentation
   */
  async answerQuestion(
    question: string,
    userId: string,
    ticketId?: string
  ): Promise<SupportResponse> {
    try {
      // Get user context
      const user = this.crm.getUser(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Get ticket context if provided
      let ticket: Ticket | undefined;
      if (ticketId) {
        ticket = this.crm.getTicket(ticketId);
        if (!ticket) {
          throw new Error(`Ticket ${ticketId} not found`);
        }
      }

      // Get user's other tickets for context
      const userTickets = this.crm.getUserTickets(userId);

      // Use RAG to find relevant documentation
      const searchResults = await this.assistant.search(question);
      const relatedDocs = searchResults.map((result: any) => {
        const content = result.content || '';
        const excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');
        return {
          title: result.metadata?.title || 'Documentation',
          source: result.metadata?.source || 'Unknown source',
          content: excerpt,
          relevance: result.score || 0.5,
        };
      });

      // Build context for the LLM
      const context = this._buildContext(user, ticket, userTickets, relatedDocs);

      // Ask LLM to answer the question
      const prompt = `
You are a helpful customer support specialist. Answer the following question based on the provided context.

${context}

CUSTOMER QUESTION: ${question}

Provide a clear, helpful answer. If the issue can be resolved with a specific solution, provide step-by-step instructions.
If you need to escalate or create a ticket, suggest that to the customer.
`;

      const result = await this.assistant.ask(prompt);

      // Add message to ticket if provided
      if (ticketId) {
        this.crm.addTicketMessage(ticketId, {
          sender: 'support_bot',
          text: result.answer,
          timestamp: new Date().toISOString(),
        });
      }

      // Generate suggested actions
      const suggestedActions = this._generateSuggestedActions(question, ticket);

      return {
        answer: result.answer,
        relatedDocs,
        suggestedActions,
        ticket_updated: !!ticketId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to answer question: ${errorMessage}`);
    }
  }

  /**
   * Build context string for the LLM
   */
  private _buildContext(
    user: any,
    ticket: any,
    userTickets: any[],
    relatedDocs: any[]
  ): string {
    let context = `
=== USER CONTEXT ===
Name: ${user.name}
Plan: ${user.plan}
Email: ${user.email}
Member since: ${user.created_at}
Status: ${user.status}
`;

    if (ticket) {
      context += `

=== CURRENT TICKET ===
Title: ${ticket.title}
Description: ${ticket.description}
Category: ${ticket.category}
Status: ${ticket.status}
Priority: ${ticket.priority}
Created: ${ticket.created_at}
`;
    }

    if (userTickets.length > 0) {
      context += `

=== PREVIOUS TICKETS ===
${userTickets
  .slice(0, 3)
  .map(t => `- [${t.status}] ${t.title}`)
  .join('\n')}
`;
    }

    if (relatedDocs.length > 0) {
      context += `

=== RELEVANT DOCUMENTATION ===
${relatedDocs
  .slice(0, 3)
  .map(
    doc =>
      `[${Math.round(doc.relevance * 100)}% relevant] ${doc.title}\n${doc.content.substring(0, 200)}...`
  )
  .join('\n\n')}
`;
    }

    return context;
  }

  /**
   * Generate suggested actions based on the question and ticket
   */
  private _generateSuggestedActions(question: string, ticket?: any): string[] {
    const actions: string[] = [];

    // Always offer to create a ticket if not already in one
    if (!ticket) {
      actions.push('Create a support ticket for follow-up');
    }

    // Suggest escalation for certain keywords
    if (
      question.toLowerCase().includes('urgent') ||
      question.toLowerCase().includes('emergency') ||
      question.toLowerCase().includes('critical')
    ) {
      actions.push('Escalate to priority support');
    }

    // Suggest contacting sales for plan-related questions
    if (
      question.toLowerCase().includes('plan') ||
      question.toLowerCase().includes('billing') ||
      question.toLowerCase().includes('upgrade')
    ) {
      actions.push('Contact sales team for plan information');
    }

    // Suggest documentation review
    if (question.toLowerCase().includes('how')) {
      actions.push('Review detailed documentation');
    }

    // Default action
    if (actions.length === 0) {
      actions.push('Get more help from documentation');
    }

    return actions;
  }
}
