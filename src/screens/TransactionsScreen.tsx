import React, { useEffect, useState} from 'react';
import { observer } from 'mobx-react-lite';
import { View, StyleSheet, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types/types';
import { transactionStore } from '../stores/TransactionStore';
import TransactionItem from '../components/TransactionItem';

type Props = NativeStackScreenProps<RootStackParamList, 'Transactions'>;

const TransactionsScreen: React.FC<Props> = observer(({ route }) => {
  const { accountId } = route.params;
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const init = async () => {
      await transactionStore.setAccount(accountId);
      await transactionStore.syncNewTransactions();
    };
    init();
  }, [accountId]);

  useEffect(() => {
    transactionStore.setSearchQuery(searchInput);
  }, [searchInput]);

  const handleEndReached = () => {
    if (!transactionStore.isLoading) {
      transactionStore.loadMoreTransactions();
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar transacciones..."
        value={searchInput}
        onChangeText={setSearchInput}
        autoCorrect={false}
      />

      {transactionStore.isHydrating && transactionStore.inMemoryTransactions.length === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={transactionStore.filteredTransactions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <TransactionItem transaction={item} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            transactionStore.isLoading && !transactionStore.isHydrating ? (
              <ActivityIndicator size="small" />
            ) : null
          }
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  loader: {
    marginTop: 20,
  },
});

export default TransactionsScreen;
