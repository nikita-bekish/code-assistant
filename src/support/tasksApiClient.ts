// src/support/tasksApiClient.ts
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

export interface ListTasksFilters {
  priority?: "high" | "medium" | "low";
  status?: "open" | "in_progress" | "completed";
  assignee?: string;
}

export interface ListTasksResponse {
  tasks: Task[];
  count: number;
}

export class TasksApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Пример: baseUrl = 'http://localhost:3000'
    this.baseUrl = baseUrl.replace(/\/$/, ""); // без хвостового /
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | undefined>
  ): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  async listTasks(filters?: ListTasksFilters): Promise<ListTasksResponse> {
    const url = this.buildUrl("/api/tasks", {
      priority: filters?.priority,
      status: filters?.status,
      assignee: filters?.assignee,
    });
    console.log("nik request called", url);
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to list tasks: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as ListTasksResponse;

    return data;
  }

  async getTask(taskId: string): Promise<Task> {
    const url = this.buildUrl(`/api/tasks/${taskId}`);
    console.log("nik request called", url);
    const res = await fetch(url);
    if (res.status === 404) {
      throw new Error(`Task ${taskId} not found`);
    }
    if (!res.ok) {
      throw new Error(`Failed to get task: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<Task>;
  }

  async createTask(input: {
    title: string;
    description: string;
    priority?: "high" | "medium" | "low";
    assignee: string;
    depends_on?: string[];
  }): Promise<{ success: boolean; task: Task }> {
    const url = this.buildUrl("/api/tasks");
    console.log("nik request called", url);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to create task: ${res.status} ${res.statusText} - ${text}`
      );
    }

    return res.json() as Promise<{ success: boolean; task: Task }>;
  }

  async updateTask(
    taskId: string,
    updates: Partial<Pick<Task, "status" | "priority" | "assignee">>
  ): Promise<{ success: boolean; task: Task }> {
    const url = this.buildUrl(`/api/tasks/${taskId}`);
    console.log("nik request called", url);
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to update task: ${res.status} ${res.statusText} - ${text}`
      );
    }

    return res.json() as Promise<{ success: boolean; task: Task }>;
  }

  async getHighPriorityTasks(): Promise<ListTasksResponse> {
    const url = this.buildUrl("/api/tasks/high-priority");
    console.log("nik request called", url);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to get high priority tasks: ${res.status} ${res.statusText}`
      );
    }
    // /tasks/high-priority сейчас возвращает { tasks, count }
    return res.json() as Promise<ListTasksResponse>;
  }
}
