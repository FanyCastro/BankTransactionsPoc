import { makeAutoObservable, runInAction } from 'mobx';
import { Transaction } from '../types/types';
import api from '../services/api';
import database from '../services/database';
import { debounce } from '../utils/debounce';

class TransactionStore {
    inMemoryTransactions: Transaction[] = [];
    filteredTransactions: Transaction[] = [];
    currentAccountId = '';
    isLoading = false;
    isHydrating = false;
    allDataLoaded = false;
    page = 1;
    pageSize = 50;

    searchQuery = '';
    private debouncedApplyFilters: (query: string) => void;

    constructor() {
        makeAutoObservable(this);
        this.debouncedApplyFilters = debounce(
            (query: string) => this.applyFilters(query),
            300
          );

        // Sincronización periódica cada 1 minuto
        setInterval(() => {
        if (this.currentAccountId) {this.syncNewTransactions();}
      }, 60000);

      // Limpieza semanal
      setInterval(() => this.cleanOldTransactions(), 604800000);
    }

  async syncNewTransactions() {
    console.log('***** Sync new transactions method');
    if (this.isLoading || this.allDataLoaded) {return;}

    this.isLoading = true;

    try {
      const apiResponse = await api.fetchTransactionsByAccount(
        this.currentAccountId,
        1, // Siempre comenzar desde la página 1
        this.pageSize
      );
      console.log('***** API response fetch transactions by account:');
      console.info(apiResponse.data);

      if (apiResponse.data.length === 0) {
        runInAction(() => {
          console.log('***** No transactions from API.');
          this.allDataLoaded = true;
        });
        return;
      }

      const firstApiTransaction = apiResponse.data[0];
      const existsLocally = await database.getTransactionById(firstApiTransaction.id);
      console.log(`***** firstApiTransaction ${firstApiTransaction.id}, existsLocally ${existsLocally}`);

      // all transactions are already sincronized
      if (existsLocally) {
        console.log('***** All data loaded as the last transactions exists in local storage');
        runInAction(async () => {
          this.allDataLoaded = true;
          this.isLoading = false;
          await this.hydrateMemory();
        });
        return;
      }

      // we have transactions to syncronized
      // let hasNewTransactions = false;
      let currentPage = 1;

      do {
        const pageResponse = await api.fetchTransactionsByAccount(
          this.currentAccountId,
          currentPage,
          this.pageSize
        );

        await database.persistTransactions(pageResponse.data, this.currentAccountId);
        await this.hydrateMemory(pageResponse.data);

        currentPage++;
      } while (currentPage <= Math.ceil(apiResponse.total / this.pageSize) && !this.allDataLoaded);

      runInAction(() => {
        this.allDataLoaded = true;
        if (this.searchQuery) {this.applyFilters(this.searchQuery);}
      });

    } catch (error) {
      console.error('Sync failed', error);
    }

    finally {
      runInAction(() => {
        this.isLoading = false;
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
        if (this.isHydrating) {return;}
        this.isHydrating = true;

        try {
          const aux = transactions || await database.getTransactionsByAccountId(this.currentAccountId);
          runInAction(() => {
            for (const transaction of aux) {
              if (!this.inMemoryTransactions.includes(transaction)){
                this.inMemoryTransactions.push(transaction);
              }
            }
            // this.inMemoryTransactions = aux;
            this.applyFilters(this.searchQuery);
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
}

export const transactionStore = new TransactionStore();
