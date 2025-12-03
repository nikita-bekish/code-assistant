import * as fs from "fs";
import { CRMData, Ticket, TicketMessage, User } from "./types";

export class CRMService {
  private data: CRMData;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = { users: [], tickets: [] };
    this.load(); // Загружаем JSON при создании
  }

  // ЧТЕНИЕ: Get user by ID
  getUser(userId: string): User | undefined {
    // Ищем в массиве users пользователя с нужным ID
    // .find() возвращает первый найденный элемент или undefined
    const user = this.data.users.find((u: User) => u.id === userId);
    return user;
  }

  // ЧИТКА: Get ticket by ID
  getTicket(ticketId: string): Ticket | undefined {
    // Ищем в массиве tickets тикет с нужным ID
    const ticket = this.data.tickets.find((t: Ticket) => t.id === ticketId);
    return ticket;
  }

  // ЧИТКА: Get all tickets for a user
  getUserTickets(userId: string): Ticket[] {
    // Фильтруем tickets где ticket.user_id === userId
    // .filter() возвращает массив совпадающих элементов
    return this.data.tickets.filter(
      (ticket: Ticket) => ticket.user_id === userId
    );
  }

  // ЗАПИСЬ: Add message to ticket
  addTicketMessage(ticketId: string, message: TicketMessage): void {
    // 1. Найти тикет
    // 2. Добавить message в ticket.messages.push()
    // 3. Обновить updated_at = new Date().toISOString()
    // 4. Сохранить в файл (вызвать this.save())
    const ticket = this.data.tickets.find((t: Ticket) => t.id === ticketId);
    if (ticket) {
      ticket.messages.push(message);
      ticket.updated_at = new Date().toISOString();
      this.save();
    } else {
      console.error(`Ticket with ID ${ticketId} not found`);
    }
  }

  // ЗАПИСЬ: Update ticket status
  updateTicketStatus(
    ticketId: string,
    status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"
  ): void {
    // 1. Найти тикет
    // 2. Изменить status
    // 3. Обновить updated_at
    // 4. Сохранить
    const ticket = this.data.tickets.find((t: Ticket) => t.id === ticketId);
    if (ticket) {
      ticket.status = status;
      ticket.updated_at = new Date().toISOString();
      this.save();
    } else {
      console.error(`Ticket with ID ${ticketId} not found`);
    }
  }

  // ЗАПИСЬ: Create new ticket
  createTicket(ticket: Ticket): void {
    // 1. Добавить ticket в this.data.tickets.push()
    // 2. Сохранить
    this.data.tickets.push(ticket);
    this.save();
  }

  // ЗАПИСЬ: Update ticket with partial updates
  updateTicket(ticketId: string, updates: any): void {
    const ticket = this.data.tickets.find((t: Ticket) => t.id === ticketId);
    if (ticket) {
      Object.assign(ticket, updates);
      this.save();
    }
  }

  // HELPER: Загружаем JSON из файла
  private load(): void {
    // Читаем файл: fs.readFileSync(this.filePath, 'utf-8')
    // Парсим: JSON.parse()
    // Сохраняем в: this.data = ...
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(content);
      } else {
        this.data = { users: [], tickets: [] };
        this.save();
      }
    } catch (error) {
      console.error("Error loading CRM data, using defaults:", error);
      this.data = { users: [], tickets: [] };
    }
  }

  // HELPER: Сохраняем JSON в файл
  private save(): void {
    // Форматируем: JSON.stringify(this.data, null, 2) - null, 2 для красивого формата
    // Пишем: fs.writeFileSync(this.filePath, ...)
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Error saving CRM data:", error);
    }
  }
}
