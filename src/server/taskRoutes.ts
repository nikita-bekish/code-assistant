import { Router, Request, Response } from 'express';
import { TasksService } from '../support/tasksService.js';

let tasksService: TasksService | null = null;

/**
 * Initialize tasks service
 */
export function initializeTasksService(tasksPath: string): void {
  tasksService = new TasksService(tasksPath);
  console.log('Tasks Service initialized');
}

/**
 * Create Express router for task routes
 */
export function createTaskRoutes(): Router {
  const router = Router();

  /**
   * GET /api/tasks
   * List all tasks with optional filters
   */
  router.get('/tasks', (req: Request, res: Response) => {
    try {
      if (!tasksService) {
        return res.status(500).json({ error: 'Tasks service not initialized' });
      }

      const { priority, status, assignee } = req.query;
      const filters: any = {};

      if (priority) filters.priority = priority as string;
      if (status) filters.status = status as string;
      if (assignee) filters.assignee = assignee as string;

      const tasks = tasksService.getTasks(filters);
      res.json({ tasks, count: tasks.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/tasks/:id
   * Get a specific task
   */
  router.get('/tasks/:id', (req: Request, res: Response) => {
    try {
      if (!tasksService) {
        return res.status(500).json({ error: 'Tasks service not initialized' });
      }

      const task = tasksService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/tasks
   * Create a new task
   */
  router.post('/tasks', (req: Request, res: Response) => {
    try {
      if (!tasksService) {
        return res.status(500).json({ error: 'Tasks service not initialized' });
      }

      const { title, description, priority, assignee } = req.body;

      // Validate required fields
      if (!title || !description || !assignee) {
        return res.status(400).json({
          error: 'Missing required fields: title, description, assignee',
        });
      }

      const taskId = `task_${Date.now()}`;
      const newTask = {
        id: taskId,
        title,
        description,
        priority: priority || 'medium',
        status: 'open' as const,
        assignee,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        depends_on: req.body.depends_on || [],
      };

      tasksService.createTask(newTask);
      res.status(201).json({ success: true, task: newTask });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * PUT /api/tasks/:id
   * Update a task
   */
  router.put('/tasks/:id', (req: Request, res: Response) => {
    try {
      if (!tasksService) {
        return res.status(500).json({ error: 'Tasks service not initialized' });
      }

      const task = tasksService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const { status, priority, assignee } = req.body;
      const updates: any = {};

      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (assignee) updates.assignee = assignee;

      tasksService.updateTask(req.params.id, updates);
      const updatedTask = tasksService.getTask(req.params.id);

      res.json({ success: true, task: updatedTask });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/tasks/high-priority
   * Get high priority tasks for recommendations
   */
  router.get('/tasks/high-priority', (_req: Request, res: Response) => {
    try {
      if (!tasksService) {
        return res.status(500).json({ error: 'Tasks service not initialized' });
      }

      const tasks = tasksService.getHighPriorityTasks();
      res.json({ tasks, count: tasks.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
