import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Transaction } from '../types/types';

interface TransactionItemProps {
  transaction: Transaction;
}

const TransactionItem: React.FC<TransactionItemProps> = React.memo(({ transaction }) => {
  const isIncome = transaction.amount >= 0;
  const amountColor = isIncome ? styles.income : styles.expense;

  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        <Text style={styles.description}>{transaction.description}</Text>
        {/* <Text style={styles.category}>{transaction.category}</Text> */}
      </View>
      <View style={styles.rightContainer}>
        <Text style={[styles.amount, amountColor]}>
          {isIncome ? '+' : ''}{transaction.amount} {transaction.currency || 'USD'}
        </Text>
        <Text style={styles.date}>
          {new Date(transaction.date).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  leftContainer: {
    flex: 2,
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    color: '#888',
  },
  amount: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  income: {
    color: '#4CAF50', // Verde para ingresos
  },
  expense: {
    color: '#F44336', // Rojo para gastos
  },
  date: {
    fontSize: 12,
    color: '#888',
  },
});

export default TransactionItem;