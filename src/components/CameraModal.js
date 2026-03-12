import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { Camera, CameraType } from 'expo-camera';
import { Video } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../config/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

export default function CameraModal({ visible, onClose, tripId }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraType, setCameraType] = useState(CameraType.back);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (visible) {
      requestCameraPermission();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const startRecording = async () => {
    if (cameraRef.current) {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync({
          maxDuration: 300, // 5 minutes max
          quality: Camera.Constants.VideoQuality['720p'],
        });
        setRecordedVideo(video.uri);
        setIsRecording(false);
      } catch (error) {
        console.error('Error recording video:', error);
        setIsRecording(false);
        Alert.alert('Error', 'Failed to record video');
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const uploadVideo = async () => {
    if (!recordedVideo) return;

    setUploading(true);
    try {
      // Convert video URI to blob
      const response = await fetch(recordedVideo);
      const blob = await response.blob();

      // Create a unique filename
      const filename = `surveillance/${tripId || 'emergency'}_${Date.now()}.mp4`;
      const storageRef = ref(storage, filename);

      // Upload to Firebase Storage
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // Save reference to Firestore
      if (tripId) {
        await updateDoc(doc(db, 'trips', tripId), {
          surveillance: arrayUnion({
            url: downloadURL,
            timestamp: new Date().toISOString(),
            type: 'video',
          }),
        });
      }

      Alert.alert('Success', 'Video uploaded successfully!');
      setRecordedVideo(null);
      onClose();
    } catch (error) {
      console.error('Error uploading video:', error);
      Alert.alert('Error', 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        
        // Upload photo
        await uploadPhoto(photo.uri);
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const uploadPhoto = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const filename = `surveillance/${tripId || 'emergency'}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      if (tripId) {
        await updateDoc(doc(db, 'trips', tripId), {
          surveillance: arrayUnion({
            url: downloadURL,
            timestamp: new Date().toISOString(),
            type: 'photo',
          }),
        });
      }

      Alert.alert('Success', 'Photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text>Camera recording is available on Android/iOS only.</Text>
        <Button mode="contained" onPress={onClose} style={styles.closeButton}>
          Close
        </Button>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>Camera permission denied</Text>
        <Button mode="contained" onPress={onClose}>
          Close
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!recordedVideo ? (
        <>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={cameraType}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.topBar}>
                <IconButton
                  icon="close"
                  iconColor="#fff"
                  size={30}
                  onPress={onClose}
                />
                <Text style={styles.title}>Emergency Surveillance</Text>
                <IconButton
                  icon="camera-flip"
                  iconColor="#fff"
                  size={30}
                  onPress={() =>
                    setCameraType(
                      cameraType === CameraType.back
                        ? CameraType.front
                        : CameraType.back
                    )
                  }
                />
              </View>

              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={capturePhoto}
                  disabled={uploading}
                >
                  <MaterialCommunityIcons name="camera" size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.recordButton,
                    isRecording && styles.recordingButton,
                  ]}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={uploading}
                >
                  <MaterialCommunityIcons
                    name={isRecording ? 'stop' : 'record-circle'}
                    size={64}
                    color="#fff"
                  />
                </TouchableOpacity>

                <View style={styles.placeholder} />
              </View>

              {isRecording && (
                <View style={styles.recordingIndicator}>
                  <MaterialCommunityIcons name="record-circle" size={20} color="#f44336" />
                  <Text style={styles.recordingText}>Recording...</Text>
                </View>
              )}
            </View>
          </Camera>
        </>
      ) : (
        <View style={styles.previewContainer}>
          <Video
            source={{ uri: recordedVideo }}
            style={styles.videoPreview}
            useNativeControls
            resizeMode="contain"
            isLooping
          />
          <View style={styles.previewButtons}>
            <Button
              mode="outlined"
              onPress={() => setRecordedVideo(null)}
              disabled={uploading}
              style={styles.previewButton}
            >
              Retake
            </Button>
            <Button
              mode="contained"
              onPress={uploadVideo}
              loading={uploading}
              disabled={uploading}
              style={styles.previewButton}
            >
              Upload & Save
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  photoButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: 'rgba(244, 67, 54, 1)',
  },
  placeholder: {
    width: 60,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
  },
  recordingText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoPreview: {
    flex: 1,
  },
  previewButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#000',
  },
  previewButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});
