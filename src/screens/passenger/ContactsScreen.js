import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  Portal,
  Modal,
  TextInput,
  Button,
  List,
  IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function ContactsScreen() {
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrustedContacts();
  }, []);

  const fetchTrustedContacts = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setTrustedContacts(userDoc.data().trustedContacts || []);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        });

        if (data.length > 0) {
          // Show contact picker (you can implement a custom picker)
          Alert.alert('Contacts Access Granted', 'You can now select contacts from your phone.');
        }
      }
    } catch (error) {
      console.error('Error accessing contacts:', error);
    }
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Please enter at least name and phone number.');
      return;
    }

    setLoading(true);
    try {
      const contact = {
        id: Date.now().toString(),
        ...newContact,
      };

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        trustedContacts: arrayUnion(contact),
      });

      setTrustedContacts([...trustedContacts, contact]);
      setModalVisible(false);
      setNewContact({ name: '', phone: '', email: '' });
      Alert.alert('Success', 'Trusted contact added successfully!');
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add contact.');
    } finally {
      setLoading(false);
    }
  };

  const removeContact = async (contact) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.name} from trusted contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                trustedContacts: arrayRemove(contact),
              });

              setTrustedContacts(trustedContacts.filter((c) => c.id !== contact.id));
              Alert.alert('Success', 'Contact removed successfully!');
            } catch (error) {
              console.error('Error removing contact:', error);
              Alert.alert('Error', 'Failed to remove contact.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <MaterialCommunityIcons name="shield-account" size={32} color="#6200ee" />
              <View style={styles.infoTextContainer}>
                <Text variant="titleMedium">Trusted Contacts</Text>
                <Text variant="bodySmall" style={styles.infoText}>
                  These contacts will be notified during emergencies and can track your trips.
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {trustedContacts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <MaterialCommunityIcons
                name="account-multiple-plus"
                size={64}
                color="#ccc"
                style={styles.emptyIcon}
              />
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No Trusted Contacts Yet
              </Text>
              <Text variant="bodySmall" style={styles.emptyText}>
                Add contacts who should be notified in case of emergency or when you start a trip.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.contactsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Your Trusted Contacts ({trustedContacts.length})
              </Text>
              {trustedContacts.map((contact) => (
                <List.Item
                  key={contact.id}
                  title={contact.name}
                  description={`${contact.phone}${contact.email ? ' • ' + contact.email : ''}`}
                  left={(props) => (
                    <List.Icon {...props} icon="account-circle" color="#6200ee" />
                  )}
                  right={(props) => (
                    <IconButton
                      icon="delete"
                      iconColor="#f44336"
                      onPress={() => removeContact(contact)}
                    />
                  )}
                  style={styles.contactItem}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Safety Features Info */}
        <Card style={styles.featuresCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              What They'll Get
            </Text>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="bell-alert" size={24} color="#6200ee" />
              <View style={styles.featureText}>
                <Text variant="bodyMedium">Emergency Alerts</Text>
                <Text variant="bodySmall" style={styles.featureDesc}>
                  Instant notification when you trigger SOS
                </Text>
              </View>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="map-marker-path" size={24} color="#6200ee" />
              <View style={styles.featureText}>
                <Text variant="bodyMedium">Live Location Tracking</Text>
                <Text variant="bodySmall" style={styles.featureDesc}>
                  Real-time tracking when you start a trip
                </Text>
              </View>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="routes" size={24} color="#6200ee" />
              <View style={styles.featureText}>
                <Text variant="bodyMedium">Trip Details</Text>
                <Text variant="bodySmall" style={styles.featureDesc}>
                  Vehicle info, route, and ETA updates
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <FAB
        icon="plus"
        label="Add Contact"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      />

      {/* Add Contact Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="headlineSmall" style={styles.modalTitle}>
            Add Trusted Contact
          </Text>

          <TextInput
            label="Full Name *"
            value={newContact.name}
            onChangeText={(text) => setNewContact({ ...newContact, name: text })}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Phone Number *"
            value={newContact.phone}
            onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <TextInput
            label="Email (Optional)"
            value={newContact.email}
            onChangeText={(text) => setNewContact({ ...newContact, email: text })}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <Button
            mode="outlined"
            onPress={requestContactsPermission}
            style={styles.importButton}
            icon="contacts"
          >
            Import from Contacts
          </Button>

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={addContact}
              loading={loading}
              disabled={loading}
              style={styles.modalButton}
            >
              Add Contact
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    margin: 16,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  infoText: {
    marginTop: 4,
    color: '#666',
  },
  emptyCard: {
    margin: 16,
    paddingVertical: 32,
    elevation: 2,
  },
  emptyIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  contactsCard: {
    margin: 16,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  contactItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  featuresCard: {
    margin: 16,
    marginBottom: 80,
    elevation: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    flex: 1,
    marginLeft: 16,
  },
  featureDesc: {
    color: '#666',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee',
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
  },
  importButton: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 6,
  },
});
