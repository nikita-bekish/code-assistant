import express, { Request, Response } from 'express';
import { SupportAssistant } from '../support/supportAssistant.js';
import { ProjectConfig } from '../types/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Pretty print JSON responses
app.set('json spaces', 2);

// Initialize support assistant
let supportAssistant: SupportAssistant | null = null;

/**
 * Initialize the support API server
 */
export async function initializeSupportServer(config: ProjectConfig, crmPath?: string): Promise<void> {
  const finalCrmPath = crmPath || './src/data/crm.json';
  supportAssistant = new SupportAssistant(finalCrmPath, config);
  await supportAssistant.initialize();
  console.log('Support Assistant initialized');
}

/**
 * POST /api/support/ask
 * Answer a customer support question
 */
app.post('/api/support/ask', async (req: Request, res: Response) => {
  try {
    if (!supportAssistant) {
      return res.status(500).json({ error: 'Support assistant not initialized' });
    }

    const { question, user_id, ticket_id } = req.body;

    // Validate required fields
    if (!question || !user_id) {
      return res.status(400).json({
        error: 'Missing required fields: question, user_id',
      });
    }

    // Answer the question
    const response = await supportAssistant.answerQuestion(
      question,
      user_id,
      ticket_id
    );

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in /api/support/ask:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/support/user/:user_id
 * Get user information
 */
app.get('/api/support/user/:user_id', (req: Request, res: Response) => {
  try {
    if (!supportAssistant) {
      return res.status(500).json({ error: 'Support assistant not initialized' });
    }

    const user = supportAssistant['crm'].getUser(req.params.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/support/tickets/:user_id
 * Get all tickets for a user
 */
app.get('/api/support/tickets/:user_id', (req: Request, res: Response) => {
  try {
    if (!supportAssistant) {
      return res.status(500).json({ error: 'Support assistant not initialized' });
    }

    const tickets = supportAssistant['crm'].getUserTickets(req.params.user_id);
    res.json(tickets);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/support/ticket/:ticket_id
 * Get a specific ticket
 */
app.get('/api/support/ticket/:ticket_id', (req: Request, res: Response) => {
  try {
    if (!supportAssistant) {
      return res.status(500).json({ error: 'Support assistant not initialized' });
    }

    const ticket = supportAssistant['crm'].getTicket(req.params.ticket_id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/support/ticket/:ticket_id/status
 * Update ticket status
 */
app.put('/api/support/ticket/:ticket_id/status', (req: Request, res: Response) => {
  try {
    if (!supportAssistant) {
      return res.status(500).json({ error: 'Support assistant not initialized' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    supportAssistant['crm'].updateTicketStatus(req.params.ticket_id, status);
    res.json({ success: true, message: 'Ticket status updated' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start the server
 */
export function startSupportServer(): void {
  app.listen(PORT, () => {
    console.log(`Support API server running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  POST   /api/support/ask - Answer support question`);
    console.log(`  GET    /api/support/user/:user_id - Get user info`);
    console.log(`  GET    /api/support/tickets/:user_id - Get user tickets`);
    console.log(`  GET    /api/support/ticket/:ticket_id - Get specific ticket`);
    console.log(`  PUT    /api/support/ticket/:ticket_id/status - Update ticket status`);
    console.log(`  GET    /api/health - Health check`);
  });
}

export default app;
