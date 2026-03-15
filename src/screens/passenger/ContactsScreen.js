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
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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

  const importFromContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });

        if (data.length > 0) {
          // In a real app, you'd show a picker. For simplicity, we'll alert instructions.
          Alert.alert(
            'Import Contact',
            'Contact permission granted. Please manually enter the details for now.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error accessing contacts:', error);
    }
  };

  const addContact = async () => {
    if (trustedContacts.length >= 3) {
      Alert.alert('Limit Reached', 'You can only save up to 3 emergency contacts.');
      return;
    }

    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Please enter at least name and phone number.');
      return;
    }

    setLoading(true);
    try {
      const updatedContacts = [
        ...trustedContacts,
        { id: Date.now().toString(), ...newContact },
      ];

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        trustedContacts: updatedContacts,
      });

      setTrustedContacts(updatedContacts);
      setModalVisible(false);
      setNewContact({ name: '', phone: '', email: '' });
      Alert.alert('Success', 'Emergency contact added successfully!');
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add contact.');
    } finally {
      setLoading(false);
    }
  };

  const removeContact = async (contactId) => {
    const updatedContacts = trustedContacts.filter((c) => c.id !== contactId);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        trustedContacts: updatedContacts,
      });
      setTrustedContacts(updatedContacts);
    } catch (error) {
      console.error('Error removing contact:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <MaterialCommunityIcons name="shield-account" size={32} color="#f44336" />
              <View style={styles.infoTextContainer}>
                <Text variant="titleMedium">Emergency Contacts</Text>
                <Text variant="bodySmall" style={styles.infoText}>
                  Add up to 3 contacts. They will receive your location via SMS when you press SOS.
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.contactsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Saved Contacts ({trustedContacts.length}/3)
            </Text>
            {trustedContacts.map((contact) => (
              <List.Item
                key={contact.id}
                title={contact.name}
                description={contact.phone}
                left={(props) => <List.Icon {...props} icon="account" />}
                right={(props) => (
                  <IconButton
                    icon="delete"
                    iconColor="#f44336"
                    onPress={() => removeContact(contact.id)}
                  />
                )}
              />
            ))}
            {trustedContacts.length === 0 && (
              <Text style={styles.emptyText}>No emergency contacts saved.</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {trustedContacts.length < 3 && (
        <FAB
          icon="plus"
          label="Add Contact"
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        />
      )}

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="headlineSmall" style={styles.modalTitle}>New Emergency Contact</Text>
          <TextInput
            label="Name"
            value={newContact.name}
            onChangeText={(t) => setNewContact({ ...newContact, name: t })}
            style={styles.input}
          />
          <TextInput
            label="Phone"
            value={newContact.phone}
            onChangeText={(t) => setNewContact({ ...newContact, phone: t })}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Button mode="outlined" onPress={importFromContacts} style={styles.importBtn}>
            Import from Phone
          </Button>
          <View style={styles.modalButtons}>
            <Button onPress={() => setModalVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={addContact} loading={loading}>Save</Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  infoCard: { margin: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'center' },
  infoTextContainer: { flex: 1, marginLeft: 16 },
  infoText: { color: '#666' },
  contactsCard: { margin: 16 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 8 },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 20 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#f44336' },
  modal: { backgroundColor: 'white', padding: 24, margin: 20, borderRadius: 12 },
  modalTitle: { marginBottom: 16, fontWeight: 'bold' },
  input: { marginBottom: 12 },
  importBtn: { marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
