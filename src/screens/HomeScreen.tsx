import React from 'react';
import { StyleSheet, View, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <Button
                title="Go to Accounts"
                onPress={() => navigation.navigate('Accounts')}
            />
            <Button
                title="Go to WebView"
                onPress={() => navigation.navigate('MyWebComponent')}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    button: {
        marginVertical: 10,
    },
});

export default HomeScreen;