import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../services/api';
import database from '../services/database';
import TransactionList from '../components/TransactionList';
import SearchBar from '../components/SearchBar';
import debounce from '../utils/debounce';
import { RootStackParamList, Transaction } from '../types/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Transactions'>;

const TransactionsScreen: React.FC<Props> = ({ route }) => {
  const { accountId } = route.params;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  const loadTransactions = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    try {
      setLoading(true);

      // 1. Verificar actualizaciones
      // const localLastId = await database.getLastTransactionId(accountId);
      // const shouldUpdate = forceRefresh ||
      //   (localLastId && await api.checkForUpdates(accountId, localLastId));
      console.log('Calling get all transactions');
      // const all = await database.getAllTransactions(); 
  
      // // 2. Obtener datos
      let txData: Transaction[];
      // if (shouldUpdate || !localLastId) {
        // Desde API
        const apiResponse = await api.fetchTransactions(accountId);
        txData = apiResponse.data;
        console.log('Save transaction');
        await database.saveTransactions(txData);
        setLastTxId(apiResponse.data[0]?.transactionId || null);
      // } else {
      //   // Desde memoria (ya cargados)
      //   return;
      // }

      // 3. Actualizar estado
      setTransactions(txData);
      setFilteredTransactions(txData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions(true);
  }, [loadTransactions]);

  // Búsqueda en memoria
  const handleSearch = useMemo(() => debounce((text: string) => {
    if (!text) {
      setFilteredTransactions(transactions);
      return;
    }

    const searchLower = text.toLowerCase();
    const filtered = transactions.filter(tx =>
      tx.description.toLowerCase().includes(searchLower) ||
      tx.amount.toString().includes(text) ||
      tx.currency.toLowerCase().includes(searchLower)
    );

    setFilteredTransactions(filtered);
  }, 300), [transactions]);

    // Sincronización en segundo plano
    // useEffect(() => {
    //   const interval = setInterval(async () => {
    //     if (lastTxId && await api.checkForUpdates(accountId, lastTxId)) {
    //       loadTransactions(true);
    //     }
    //   }, 5 * 60 * 1000); // 5 minutos

    //   return () => clearInterval(interval);
    // }, [accountId, lastTxId]);


  if (loading) { //  && !transactions.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Account id: {accountId}</Text>
      <SearchBar onChangeText={handleSearch} />
      <TransactionList
        transactions={filteredTransactions}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TransactionsScreen;
