import { makeAutoObservable, runInAction } from 'mobx';
import { Transaction } from '../types/types';
import api from '../services/api';
import database from '../services/database';

class TransactionStore {
    private lastSyncTimestamp = 0;

    inMemoryTransactions: Transaction[] = [];
    filteredTransactions: Transaction[] = [];
    searchQuery = '';
    currentAccountId = '';
    isLoading = false;
    isHydrating = false;
    allDataLoaded = false;
    page = 1;
    pageSize = 50;

    constructor() {
        makeAutoObservable(this);

        // Sincronización periódica cada 1 minuto
        setInterval(() => {
        if (this.currentAccountId) {this.syncNewTransactions();}
      }, 60000);

      // Limpieza semanal
      setInterval(() => this.cleanOldTransactions(), 604800000);
    }

   async syncNewTransactions() {
        try {
          const response = await api.fetchTransactionsByAccount(
            this.currentAccountId,
            1,
            this.pageSize,
            // this.lastSyncTimestamp
          );

          if (response.data.length > 0) {
            await database.persistTransactions(response.data, this.currentAccountId);
            this.lastSyncTimestamp = Date.now();

            // Actualizar solo transacciones nuevas/modificadas en memoria
            runInAction(() => {
              response.data.forEach(newTrans => {
                const existingIndex = this.inMemoryTransactions.findIndex(
                  t => t.id === newTrans.id
                );

                if (existingIndex >= 0) {
                  this.inMemoryTransactions[existingIndex] = newTrans;
                } else {
                  this.inMemoryTransactions.unshift(newTrans);
                }
              });

              this.applyFilters(this.searchQuery);
            });
          }
        } catch (error) {
          console.error('Sync failed', error);
        }
      }

    private applyFilters(query: string) {
        if (!query) {
            this.filteredTransactions = [...this.inMemoryTransactions];
            return;
        }

        const queryLower = query.toLowerCase();
        this.filteredTransactions = this.inMemoryTransactions.filter(
            transaction =>
            transaction.description.toLowerCase().includes(queryLower) ||
            transaction.amount.toString().includes(query) ||
            transaction.type.toLowerCase().includes(queryLower)
        );
    }

    async loadMoreTransactions() {
        if (this.isLoading || this.allDataLoaded) {return;}

        this.isLoading = true;

        try {
          const newTransactions = await api.fetchTransactionsByAccount(
            this.currentAccountId,
            this.page,
            this.pageSize
          );

          await database.persistTransactions(newTransactions.data, this.currentAccountId);

          runInAction(() => {
            this.page++;
            this.allDataLoaded = newTransactions.data.length < this.pageSize;
          });

          // Hidratar memoria si es la primera carga
          if (this.page === 2) {
            await this.hydrateMemory();
          }

        } finally {
          runInAction(() => {
            this.isLoading = false;
          });
        }
    }

    async hydrateMemory() {
        if (this.isHydrating) {return;}
        this.isHydrating = true;

        try {
          const transactions = await database.getTransactionsByAccountId(this.currentAccountId);
          runInAction(() => {
            this.inMemoryTransactions = transactions;
            // this.applyFilters();
          });

        } finally {
          runInAction(() => {
            this.isHydrating = false;
          });
        }
      }

    async setAccount(accountId: string) {
        if (this.currentAccountId === accountId) {return;}

        runInAction(() => {
            this.currentAccountId = accountId;
            this.inMemoryTransactions = [];
            this.filteredTransactions = [];
            this.page = 1;
            this.allDataLoaded = false;
            this.searchQuery = '';
        });

        await this.loadMoreTransactions();
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
        // debounce(this.applyFilters(query), 300);
        this.applyFilters(query);
    }

    private async cleanOldTransactions() {
        await database.cleanOldTransactions();
        await this.hydrateMemory();
    }
}

export const transactionStore = new TransactionStore();
