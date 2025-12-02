/**
 * This file contains intentional code issues for testing the PR reviewer
 * DO NOT USE IN PRODUCTION
 */

interface Database {
  prepare(query: string): { get(): any };
}

// ISSUE 1: SQL Injection vulnerability
export function getUserById(userId: string, db: Database): any {
  // User input directly concatenated into SQL query
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  return db.prepare(query).get();
}

// ISSUE 2: Race condition with async operations
let userCache: Map<string, any> = new Map();
let cacheInitialized = false;

export async function getUserFromCache(userId: string): Promise<any> {
  if (!cacheInitialized) {
    // Race condition: multiple calls can trigger initialization simultaneously
    await initializeCache();
    cacheInitialized = true;
  }
  return userCache.get(userId);
}

async function initializeCache(): Promise<void> {
  // Expensive operation
  const users = await fetch('/api/users').then(r => r.json());
  for (const user of users) {
    userCache.set(user.id, user);
  }
}

// ISSUE 3: Missing error handling
export function processUserData(rawData: string): any {
  const data = JSON.parse(rawData); // No try-catch, will crash on invalid JSON
  const transformed = data.users.map((u: any) => ({
    name: u.name.toUpperCase(), // No null check, will crash if u.name is null
    email: u.email.toLowerCase(),
  }));
  return transformed;
}

// ISSUE 4: Memory leak - event listener never removed
export class UserProcessor {
  private listeners: any[] = [];

  attachListener(callback: (data: any) => void): void {
    process.on('message', callback); // Never removes listener
    this.listeners.push(callback);
  }

  cleanup(): void {
    // Listeners still attached to process
    this.listeners = [];
  }
}

// ISSUE 5: Type safety - implicit any
export function mergeConfigs(config1: any, config2: any): any {
  return { ...config1, ...config2 }; // any type, no validation
}

// ISSUE 6: Performance - inefficient algorithm
export function findDuplicates(arr: number[]): number[] {
  const duplicates: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      // O(n²) algorithm instead of using Set or Map - O(n)
      if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
        duplicates.push(arr[i]);
      }
    }
  }
  return duplicates;
}
