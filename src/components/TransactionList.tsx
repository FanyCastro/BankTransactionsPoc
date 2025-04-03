import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import TransactionItem from './TransactionItem';
import { TransactionListProps } from '../types/types';

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onRefresh,
  refreshing = false,
}) => {
  return (
    <FlatList
      data={transactions}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay transacciones</Text>
        </View>
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});

export default TransactionList;
