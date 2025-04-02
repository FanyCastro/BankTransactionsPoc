import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AccountCardProps } from '../types/types';

const AccountCard: React.FC<AccountCardProps> = ({ account, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.accountName}>{account.name.toUpperCase()}</Text>
        <Text style={styles.balance}>
          {account.balance} {account.currency}
        </Text>
        <Text style={styles.lastUpdated}>
          Account id: {account.accountId}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    padding: 16,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  balance: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    color: '#2c3e50',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#7f8c8d',
  },
});

export default AccountCard;
