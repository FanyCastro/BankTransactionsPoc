import { makeAutoObservable, runInAction } from 'mobx';
import { ApiResponse, Transaction } from '../types/types';
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
    pageSize = 200;

    searchQuery = '';
    private debouncedApplyFilters: (query: string) => void;

    constructor() {
        makeAutoObservable(this);
        this.debouncedApplyFilters = debounce(
            (query: string) => this.applyFilters(query),
            300
          );

        // Sincronización periódica cada 1 minuto
      // setInterval(() => {
      //   if (this.currentAccountId) {this.syncNewTransactions();}
      // }, 60000);

      // Limpieza semanal
      setInterval(() => this.cleanOldTransactions(), 604800000);
    }

  async syncNewTransactions() {
    console.log('***** Sync new transactions method');
    if (this.isLoading || this.allDataLoaded) {
      console.warn('***** Already loading data');
      return;
    }

    this.isLoading = true;

    try {
      const firstPageResponse = await api.fetchTransactionsByAccount(
        this.currentAccountId,
        1, // we always start with page = 1
        this.pageSize
      );

      console.info('***** Request with page 1 always happens');
      if (firstPageResponse.data.length > 0) {
        const existsLocally = await database.getTransactionById(firstPageResponse.data[0].id) != null;
        console.info(`***** Current page 1, existsLocally ${existsLocally}`);
        if (!existsLocally) {
          await database.persistTransactions(firstPageResponse.data, this.currentAccountId);
          await this.hydrateMemory(firstPageResponse.data);
        }
      }

      this.handleOtherPages(firstPageResponse);

    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      console.error('Sync failed', error);
    }
  }

  private async handleOtherPages(firstPageResponse: ApiResponse<Transaction>) {

      // We set up all the requests for the remaining pages
      console.info('***** We set up all the requests for the remaining pages - init');
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

      // We run all the requests in pararell
      const pagesResponses = await Promise.all(pagePromises);

      // We process the responses
      const persistPromises = pagesResponses.map(async (pageResponse) => {
        if (pageResponse.data.length > 0) {
          const existsLocally = await database.getTransactionById(pageResponse.data[0].id) != null;
          console.info(`***** Current page ${pageResponse.page}, existsLocally ${existsLocally}`);
          if (!existsLocally) {
            await database.persistTransactions(pageResponse.data, this.currentAccountId);
            await this.hydrateMemory(pageResponse.data);
          }
        }
      });

      await Promise.allSettled(persistPromises);
      console.info('***** We set up all the requests for the remaining pages - done');

      runInAction(() => {
        this.allDataLoaded = true;
        this.isLoading = false;
        if (this.searchQuery) {this.applyFilters(this.searchQuery);}
      });
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
            this.inMemoryTransactions =[];
            this.filteredTransactions = [];
            this.page = 1;
            this.allDataLoaded = false;
            this.searchQuery = '';
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
}

export const transactionStore = new TransactionStore();