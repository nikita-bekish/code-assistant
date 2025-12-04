import * as fs from "fs";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "completed";
  assignee: string;
  created_at: string;
  updated_at: string;
  depends_on: string[];
}

export interface TasksData {
  tasks: Task[];
}

export class TasksService {
  private data: TasksData;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = { tasks: [] };
    this.load();
  }

  // READ: Get all tasks with optional filters
  getTasks(filters?: {
    priority?: "high" | "medium" | "low";
    status?: "open" | "in_progress" | "completed";
    assignee?: string;
  }): Task[] {
    let tasks = this.data.tasks;
    console.log("nik tasks", tasks, "filters", filters);
    if (filters) {
      if (filters.priority) {
        tasks = tasks.filter((t) => t.priority === filters.priority);
      }
      if (filters.status) {
        tasks = tasks.filter((t) => t.status === filters.status);
      }
      if (filters.assignee) {
        tasks = tasks.filter((t) => t.assignee === filters.assignee);
      }
    }

    return tasks;
  }

  // READ: Get task by ID
  getTask(taskId: string): Task | undefined {
    return this.data.tasks.find((t) => t.id === taskId);
  }

  // WRITE: Create new task
  createTask(task: Task): void {
    this.data.tasks.push(task);
    this.save();
  }

  // WRITE: Update task
  updateTask(taskId: string, updates: Partial<Task>): void {
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (task) {
      Object.assign(task, updates);
      task.updated_at = new Date().toISOString();
      this.save();
    } else {
      console.error(`Task with ID ${taskId} not found`);
    }
  }

  // READ: Get high priority tasks (for recommendations)
  getHighPriorityTasks(): Task[] {
    return this.getTasks({ priority: "high", status: "open" });
  }

  // READ: Analyze task dependencies
  getTaskDependencies(taskId: string): Task[] {
    const task = this.getTask(taskId);
    if (!task || task.depends_on.length === 0) {
      return [];
    }

    return task.depends_on
      .map((depId) => this.getTask(depId))
      .filter((t): t is Task => t !== undefined);
  }

  // Private methods for file operations
  private load(): void {
    try {
      const fileContent = fs.readFileSync(this.filePath, "utf-8");
      this.data = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Failed to load tasks from ${this.filePath}:`, error);
      this.data = { tasks: [] };
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(this.data, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error(`Failed to save tasks to ${this.filePath}:`, error);
    }
  }
}
