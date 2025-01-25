export enum CorrelativeType {
  PREVIOUS = 'previous',
  NEXT = 'next'
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  correlatives: {
    previous: Array<{
      code: string;
      name?: string;
    }>;
    next: Array<{
      code: string;
      name?: string;
    }>;
  };
  semester: number;
  year: number;
  isOptional: boolean;
}

export interface Career {
  id: string;
  name: string;
  faculty: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    year: string;
  };
  subjects: Subject[];
  totalYears: number;
}

export interface Env {
  // Define your environment variables here
}

export type ExecutionContext = {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}; 