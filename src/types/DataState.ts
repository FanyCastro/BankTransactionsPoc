export interface DataState<T> {
    content: T;
    loading: boolean;
    error: string | null;
} 