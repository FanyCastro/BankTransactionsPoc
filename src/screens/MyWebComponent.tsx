import React, { useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { RootStackParamList } from '../types/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyWebComponent'>;

const jsToInject = `
  (function() {
    document.getElementById('fileInput').addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (file) {
        window.ReactNativeWebView.postMessage(file.name);
      }
    });
  })();
  true;
`;

const MyWebComponent: React.FC<Props> = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const webViewRef = useRef<WebView>(null);

    const handleLoadStart = () => {
        setLoading(true);
        setError(false);
    };

    const handleLoadEnd = () => {
        setLoading(false);
    };

    const handleError = (syntheticEvent: any) => {
        setLoading(false);
        setError(true);

        const { nativeEvent } = syntheticEvent;
        console.error('[MyWebComponent] WebView error:', nativeEvent);

        if (nativeEvent.description) {
            console.error(`[MyWebComponent] Error description: ${nativeEvent.description}`);
        }
    };

    const handleGoBack = () => {
        if (webViewRef.current) {
            webViewRef.current.goBack();
        }
    };

    const handleMessage = (event: any) => {
        // const data = JSON.parse(event.nativeEvent.data);

        // if (data.error) {
        //     console.error('[MyWebComponent] Error reading file:', data.error);
        //     return;
        // }

        // console.log('[MyWebComponent] File selected:', data.name);
        // console.log('[MyWebComponent] File content:', data.content);

        // setSelectedFile(data.content);
        console.info('[MyWebComponent] Result reading file:', event.nativeEvent.data);
        setSelectedFile(event.nativeEvent.data);
    };

    return (
        <View style={styles.container}>
            {loading && !error && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text>Loading...</Text>
                </View>
            )}
            {error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Failed to load the page.</Text>
                    <Button title="Retry" onPress={() => webViewRef.current?.reload()} />
                </View>
            ) : (
                <WebView
                    ref={webViewRef}
                    source={{ uri: 'http://localhost:4200/' }}
                    style={{ flex: 1 }}
                    onLoadStart={handleLoadStart}
                    onLoadEnd={handleLoadEnd}
                    onError={handleError}
                    injectedJavaScript={jsToInject}
                    onMessage={handleMessage}
                />
            )}

            {/* {selectedFile && ( */}
                {/* <View style={styles.previewContainer}>
                    <Text style={styles.previewText}>File Preview:</Text>
                    <Text style={styles.fileContent}>{selectedFile}</Text>
                </View> */}
            {/* )} */}

            <View style={styles.navigationContainer}>
                <Button title="Go Back" onPress={handleGoBack} disabled={!webViewRef.current} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        color: 'red',
        marginBottom: 16,
        fontSize: 16,
    },
    navigationContainer: {
        padding: 10,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#ccc',
    },
    previewContainer: {
        padding: 10,
        backgroundColor: '#e0e0e0',
        borderTopWidth: 1,
        borderTopColor: '#ccc',
    },
    previewText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 10,
    },
    fileContent: {
        fontSize: 14,
        color: '#333',
        backgroundColor: '#f9f9f9',
        padding: 10,
        borderRadius: 5,
        maxHeight: 200,
        overflow: 'scroll',
    },
});

export default MyWebComponent;
