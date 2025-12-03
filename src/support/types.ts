export interface User {
  id: string; // Уникальный ID (uuid или номер)
  name: string; // Имя пользователя
  email: string; // Email для связи
  plan: "free" | "pro" | "enterprise"; // План подписки
  created_at: string; // Когда зарегистрировался (ISO 8601)
  status: "active" | "inactive"; // Активен ли пользователь
}

export interface TicketMessage {
  sender: "user" | "support_bot" | "support_agent"; // Кто написал
  text: string; // Текст сообщения
  timestamp: string; // Когда (ISO 8601)
}

export interface Ticket {
  id: string; // Уникальный ID тикета
  user_id: string; // Кому принадлежит
  title: string; // Заголовок проблемы
  description: string; // Полное описание
  category: "technical" | "billing" | "account" | "feature_request" | "other";
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string; // Когда создан
  updated_at: string; // Когда последнее изменение
  messages: TicketMessage[]; // История переписки
}

export interface SupportResponse {
  answer: string; // Ответ на вопрос
  relatedDocs: Array<{
    // Релевантная документация
    title: string;
    source: string; // Файл источник (например: docs/authentication.md)
    content: string; // Первые 200 символов цитаты
    relevance: number; // 0-1, насколько релевантна
  }>;
  suggestedActions: string[]; // Что можно сделать дальше
  ticket_updated?: boolean; // Был ли обновлен тикет
}

export interface CRMData {
  users: User[];
  tickets: Ticket[];
}
