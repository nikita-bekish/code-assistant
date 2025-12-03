import { CRMService } from './crmService.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Server for CRM tools
 * Provides tools for managing users and support tickets
 */

export class CRMToolServer {
  private crm: CRMService;
  private server: Server;

  constructor(crmPath: string) {
    this.crm = new CRMService(crmPath);
    this.server = new Server(
      {
        name: 'crm-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleToolCall(name: string, args: any) {
    switch (name) {
      case 'get_user':
        return this.handleGetUser(args);
      case 'list_tickets':
        return this.handleListTickets(args);
      case 'create_ticket':
        return this.handleCreateTicket(args);
      case 'update_ticket':
        return this.handleUpdateTicket(args);
      case 'add_message':
        return this.handleAddMessage(args);
      case 'search_tickets':
        return this.handleSearchTickets(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private handleGetUser(args: any) {
    const { user_id } = args;
    if (!user_id) {
      throw new Error('user_id is required');
    }

    const user = this.crm.getUser(user_id);
    if (!user) {
      throw new Error(`User ${user_id} not found`);
    }

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        status: user.status,
        created_at: user.created_at,
      },
    };
  }

  private handleListTickets(args: any) {
    const { user_id, status } = args;
    if (!user_id) {
      throw new Error('user_id is required');
    }

    const tickets = this.crm.getUserTickets(user_id);
    const filtered = status ? tickets.filter((t: any) => t.status === status) : tickets;

    return {
      success: true,
      count: filtered.length,
      tickets: filtered.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.category,
        created_at: t.created_at,
        message_count: t.messages.length,
      })),
    };
  }

  private handleCreateTicket(args: any) {
    const { user_id, title, description, category, priority } = args;

    if (!user_id || !title || !description) {
      throw new Error('user_id, title, and description are required');
    }

    const user = this.crm.getUser(user_id);
    if (!user) {
      throw new Error(`User ${user_id} not found`);
    }

    const ticketId = `ticket_${Date.now()}`;
    const ticket = {
      id: ticketId,
      user_id,
      title,
      description,
      category: category || 'other',
      priority: priority || 'medium',
      status: 'open' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          sender: 'user' as const,
          text: description,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    this.crm.createTicket(ticket);

    return {
      success: true,
      ticket_id: ticketId,
      message: 'Ticket created successfully',
    };
  }

  private handleUpdateTicket(args: any) {
    const { ticket_id, status, priority } = args;

    if (!ticket_id) {
      throw new Error('ticket_id is required');
    }

    const ticket = this.crm.getTicket(ticket_id);
    if (!ticket) {
      throw new Error(`Ticket ${ticket_id} not found`);
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    updates.updated_at = new Date().toISOString();

    this.crm.updateTicket(ticket_id, updates);
    const updatedTicket = this.crm.getTicket(ticket_id);

    return {
      success: true,
      message: `Ticket ${ticket_id} updated successfully`,
      ticket: {
        id: updatedTicket?.id,
        status: updatedTicket?.status,
        priority: updatedTicket?.priority,
        updated_at: updatedTicket?.updated_at,
      },
    };
  }

  private handleAddMessage(args: any) {
    const { ticket_id, text, sender } = args;

    if (!ticket_id || !text) {
      throw new Error('ticket_id and text are required');
    }

    const ticket = this.crm.getTicket(ticket_id);
    if (!ticket) {
      throw new Error(`Ticket ${ticket_id} not found`);
    }

    this.crm.addTicketMessage(ticket_id, {
      sender: sender || 'support_agent',
      text,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Message added to ticket ${ticket_id}`,
    };
  }

  private handleSearchTickets(args: any) {
    const { query, user_id } = args;

    if (!query && !user_id) {
      throw new Error('Either query or user_id is required');
    }

    let results: any[] = [];

    if (user_id) {
      results = this.crm.getUserTickets(user_id);
    } else {
      // Search across all tickets - need to add getData method to CRMService
      const data = (this.crm as any).data;
      results = data.tickets;
    }

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (t: any) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      count: results.length,
      tickets: results.map((t: any) => ({
        id: t.id,
        user_id: t.user_id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        created_at: t.created_at,
      })),
    };
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'get_user',
        description: 'Get information about a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'The ID of the user to retrieve',
            },
          },
          required: ['user_id'],
        },
      },
      {
        name: 'list_tickets',
        description: 'List all tickets for a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'The ID of the user',
            },
            status: {
              type: 'string',
              description:
                'Filter by status (open, in_progress, waiting_customer, resolved, closed)',
            },
          },
          required: ['user_id'],
        },
      },
      {
        name: 'create_ticket',
        description: 'Create a new support ticket',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'The ID of the user creating the ticket',
            },
            title: {
              type: 'string',
              description: 'The title of the issue',
            },
            description: {
              type: 'string',
              description: 'The detailed description of the issue',
            },
            category: {
              type: 'string',
              description: 'Category: technical, billing, account, feature_request, other',
            },
            priority: {
              type: 'string',
              description: 'Priority: low, medium, high, urgent',
            },
          },
          required: ['user_id', 'title', 'description'],
        },
      },
      {
        name: 'update_ticket',
        description: 'Update a support ticket status or priority',
        inputSchema: {
          type: 'object',
          properties: {
            ticket_id: {
              type: 'string',
              description: 'The ID of the ticket to update',
            },
            status: {
              type: 'string',
              description:
                'New status (open, in_progress, waiting_customer, resolved, closed)',
            },
            priority: {
              type: 'string',
              description: 'New priority (low, medium, high, urgent)',
            },
          },
          required: ['ticket_id'],
        },
      },
      {
        name: 'add_message',
        description: 'Add a message to a support ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticket_id: {
              type: 'string',
              description: 'The ID of the ticket',
            },
            text: {
              type: 'string',
              description: 'The message text',
            },
            sender: {
              type: 'string',
              description: 'Sender type (user, support_bot, support_agent)',
            },
          },
          required: ['ticket_id', 'text'],
        },
      },
      {
        name: 'search_tickets',
        description: 'Search for support tickets by title or description',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for title or description',
            },
            user_id: {
              type: 'string',
              description: 'Optionally filter by user ID',
            },
          },
        },
      },
    ];
  }

  public async start() {
    console.log('🚀 Starting CRM MCP Server...');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('✅ CRM MCP Server connected');
  }
}
