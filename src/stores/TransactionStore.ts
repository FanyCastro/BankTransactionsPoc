import { makeAutoObservable, runInAction } from 'mobx';
import { Transaction } from '../types/types';
import api from '../services/api';
import database from '../services/database';
import { debounce } from '../utils/debounce';

// Estados de sincronización
enum SyncState {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ERROR = 'error'
}

class TransactionStore {
    inMemoryTransactions: Transaction[] = [];
    filteredTransactions: Transaction[] = [];
    currentAccountId = '';
    isLoading = false;
    isHydrating = false;
    allDataLoaded = false;
    page = 1;
    pageSize = 200;
    lastSyncTimestamp: number = 0;
    syncState: SyncState = SyncState.IDLE;
    syncError: string | null = null;
    lastKnownTransactionId: string | null = null;
    pendingSync = false;

    searchQuery = '';
    private debouncedApplyFilters: (query: string) => void;
    private syncInterval: NodeJS.Timeout | null = null;
    private syncTimeout: NodeJS.Timeout | null = null;

    constructor() {
        makeAutoObservable(this);
        this.debouncedApplyFilters = debounce(
            (query: string) => this.applyFilters(query),
            300
        );

        // Sincronización periódica cada 1 minuto
        this.startPeriodicSync();
    }

    private startPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        this.syncInterval = setInterval(() => {
            if (this.currentAccountId && this.syncState === SyncState.IDLE) {
                this.syncNewTransactions();
            } else if (this.currentAccountId && this.syncState === SyncState.ERROR) {
                // Reintentar después de un error
                this.syncNewTransactions();
            }
        }, 60000);
    }

    private stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = null;
        }
    }

    async syncNewTransactions() {
        // Si ya hay una sincronización en progreso, marcar como pendiente
        if (this.syncState === SyncState.SYNCING) {
            this.pendingSync = true;
            return;
        }

        // Si hay un error, limpiar el error antes de intentar de nuevo
        if (this.syncState === SyncState.ERROR) {
            runInAction(() => {
                this.syncError = null;
            });
        }

        runInAction(() => {
            this.syncState = SyncState.SYNCING;
            this.isLoading = true;
        });

        try {
            // 1. Obtener la última transacción conocida
            const lastLocalTransaction = await database.getLastTransactionId(this.currentAccountId);
            this.lastKnownTransactionId = lastLocalTransaction;
            
            // 2. Obtener la primera página de la API
            const firstPageResponse = await api.fetchTransactionsByAccount(
                this.currentAccountId,
                1,
                this.pageSize
            );

            if (firstPageResponse.data.length === 0) {
                runInAction(() => {
                    this.allDataLoaded = true;
                    this.isLoading = false;
                    this.syncState = SyncState.IDLE;
                    this.lastSyncTimestamp = Date.now();
                });
                return;
            }

            // 3. Verificar si necesitamos actualizar
            const needsUpdate = !lastLocalTransaction || 
                              firstPageResponse.data[0].id !== lastLocalTransaction;

            if (!needsUpdate) {
                runInAction(() => {
                    this.allDataLoaded = true;
                    this.isLoading = false;
                    this.syncState = SyncState.IDLE;
                    this.lastSyncTimestamp = Date.now();
                });
                return;
            }

            // 4. Procesar la primera página
            await this.processTransactionPage(firstPageResponse.data);

            // 5. Procesar páginas adicionales si es necesario
            const totalPages = firstPageResponse.totalPages;
            const pagePromises = [];
            
            for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
                pagePromises.push(
                    api.fetchTransactionsByAccount(
                        this.currentAccountId,
                        currentPage,
                        this.pageSize
                    )
                );
            }

            const pagesResponses = await Promise.all(pagePromises);
            
            for (const pageResponse of pagesResponses) {
                await this.processTransactionPage(pageResponse.data);
            }

            runInAction(() => {
                this.lastSyncTimestamp = Date.now();
                this.allDataLoaded = true;
                this.isLoading = false;
                this.syncState = SyncState.IDLE;
                this.lastKnownTransactionId = firstPageResponse.data[0].id;
                if (this.searchQuery) {
                    this.applyFilters(this.searchQuery);
                }
            });

            // Verificar si hay una sincronización pendiente
            if (this.pendingSync) {
                this.pendingSync = false;
                // Esperar un poco antes de iniciar la siguiente sincronización
                this.syncTimeout = setTimeout(() => {
                    this.syncNewTransactions();
                }, 1000);
            }

        } catch (error) {
            console.error('Sync failed', error);
            runInAction(() => {
                this.isLoading = false;
                this.syncState = SyncState.ERROR;
                this.syncError = error instanceof Error ? error.message : 'Unknown error';
            });
        }
    }

    private async processTransactionPage(transactions: Transaction[]) {
        if (transactions.length === 0) return;

        // 1. Verificar qué transacciones son nuevas o actualizadas
        const existingTransactionsMap = new Map(
            this.inMemoryTransactions.map(t => [t.id, t])
        );

        const newTransactions: Transaction[] = [];
        const updatedTransactions: Transaction[] = [];

        for (const transaction of transactions) {
            const existing = existingTransactionsMap.get(transaction.id);
            if (!existing) {
                newTransactions.push(transaction);
            } else if (JSON.stringify(existing) !== JSON.stringify(transaction)) {
                updatedTransactions.push(transaction);
            }
        }

        const transactionsToSave = [...newTransactions, ...updatedTransactions];

        if (transactionsToSave.length > 0) {
            // 2. Persistir en la base de datos
            await database.persistTransactions(transactionsToSave, this.currentAccountId);
            
            // 3. Actualizar la memoria
            runInAction(() => {
                // Eliminar las transacciones actualizadas de la memoria
                const updatedIds = new Set(updatedTransactions.map(t => t.id));
                this.inMemoryTransactions = this.inMemoryTransactions.filter(
                    t => !updatedIds.has(t.id)
                );

                // Agregar las nuevas y actualizadas transacciones
                this.inMemoryTransactions = [
                    ...newTransactions,
                    ...updatedTransactions,
                    ...this.inMemoryTransactions
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
        }
    }

    private applyFilters(query: string) {
        if (!query) {
            this.filteredTransactions = [...this.inMemoryTransactions];
        } else {
            const queryLower = query.toLowerCase();
            this.filteredTransactions = this.inMemoryTransactions.filter(
                transaction =>
                    transaction.description.toLowerCase().includes(queryLower) ||
                    transaction.amount.toString().includes(query) ||
                    transaction.type.toLowerCase().includes(queryLower)
            );
        }
    }

    async hydrateMemory(transactions?: Transaction[]) {
        if (this.isHydrating) return;
        this.isHydrating = true;

        try {
            if (transactions) {
                // Si se proporcionan transacciones, las usamos directamente
                runInAction(() => {
                    this.inMemoryTransactions = transactions.sort(
                        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    this.applyFilters(this.searchQuery);
                });
            } else {
                // Cargar transacciones en lotes para mejor rendimiento
                const batchSize = 100;
                let offset = 0;
                let allTransactions: Transaction[] = [];
                let hasMore = true;

                while (hasMore) {
                    const batch = await database.getTransactionsByAccountId(
                        this.currentAccountId,
                        batchSize,
                        offset
                    );

                    if (batch.length === 0) {
                        hasMore = false;
                    } else {
                        allTransactions = [...allTransactions, ...batch];
                        offset += batchSize;
                    }
                }

                runInAction(() => {
                    this.inMemoryTransactions = allTransactions.sort(
                        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    this.applyFilters(this.searchQuery);
                });
            }
        } finally {
            runInAction(() => {
                this.isHydrating = false;
            });
        }
    }

    async setAccount(accountId: string) {
        if (this.currentAccountId === accountId) return;

        runInAction(() => {
            this.currentAccountId = accountId;
            this.inMemoryTransactions = [];
            this.filteredTransactions = [];
            this.page = 1;
            this.allDataLoaded = false;
            this.searchQuery = '';
            this.lastKnownTransactionId = null;
        });

        await this.hydrateMemory();
        await this.syncNewTransactions();
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
        this.debouncedApplyFilters(query);
    }

    private async cleanOldTransactions() {
        await database.cleanOldTransactions();
        await this.hydrateMemory();
    }

    dispose() {
        this.stopPeriodicSync();
    }
}

export const transactionStore = new TransactionStore();
