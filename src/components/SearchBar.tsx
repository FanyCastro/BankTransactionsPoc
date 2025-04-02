import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { SearchBarProps } from '../types/types';

const SearchBar: React.FC<SearchBarProps> = ({ onChangeText }) => {
  const [searchText, setSearchText] = useState<string>('');

  const handleChangeText = (text: string) => {
    setSearchText(text);
    onChangeText(text);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Buscar transacciones..."
        value={searchText}
        onChangeText={handleChangeText}
        clearButtonMode="while-editing"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  input: {
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8
  }
});

export default SearchBar;