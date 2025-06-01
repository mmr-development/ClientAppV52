import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { SidebarButtonWithLogo } from '../../components/SidebarButton';
import * as api from '../../constants/API';
import translations from '../../constants/locales';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSidebar } from '../../hooks/useSidebar';
import { styles } from '../../styles';

type Language = keyof typeof translations;
type TranslationKeys = keyof typeof translations['da'];

const extractUsername = (email: string) => {
  if (!email) return '';
  const atIdx = email.indexOf('@');
  return atIdx !== -1 ? email.slice(0, atIdx) : email;
};

const DELIVERY_HISTORY_KEY = 'recent_addresses';
const REFRESH_TOKEN_KEY = 'refresh_token';
const LOGGED_IN_EMAIL_KEY = 'logged_in_email';
const PRIMARY_ADDRESS_KEY = 'primary_address';
const ACCESS_TOKEN_KEY = 'access_token';

export default function ProfileScreen() {
  const [mode, setMode] = useState<'none' | 'login' | 'signup'>('none');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [userInfoModalVisible, setUserInfoModalVisible] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [locationEnabled, setLocationEnabled] = useState(false);

  const { sidebarVisible, toggleSidebar, closeSidebar } = useSidebar();

  const [deliveryHistory, setDeliveryHistory] = useState<string[]>([]);
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [primaryAddress, setPrimaryAddress] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const t = (key: TranslationKeys) => (translations[language as Language] as typeof translations['da'])[key];
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOGGED_IN_EMAIL_KEY).then(email => {
      if (email) setLoggedInEmail(email);
    });
  }, []);

  useEffect(() => {
    if (loggedInEmail) {
      AsyncStorage.getItem(DELIVERY_HISTORY_KEY).then(data => {
        if (data) setDeliveryHistory(JSON.parse(data));
        else setDeliveryHistory([]);
      });
    }
  }, [loggedInEmail]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (userInfoModalVisible && loggedInEmail) {
        const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
        if (!token) {
          setUserInfo(null);
          return;
        }
        let data = await api.get(`users/profile/?email=${encodeURIComponent(loggedInEmail)}`).then((res) => {
          if (res.status === 200) {
            return res.data;
          } else {
            Alert.alert('Error', 'Failed to fetch user info');
          }
        });
        setUserInfo(data);
      }
    };
    fetchUserInfo();
  }, [userInfoModalVisible, loggedInEmail]);

  useEffect(() => {
    AsyncStorage.getItem(PRIMARY_ADDRESS_KEY).then(addr => {
      if (addr) setPrimaryAddress(addr);
    });
  }, []);

  const clearDeliveryHistory = async () => {
    await AsyncStorage.removeItem(DELIVERY_HISTORY_KEY);
    setDeliveryHistory([]);
    setPrimaryAddress(null);
  };

  const handleOpenDeliveryModal = async () => {
    const data = await AsyncStorage.getItem(DELIVERY_HISTORY_KEY);
    setDeliveryHistory(data ? JSON.parse(data) : []);
    const primary = await AsyncStorage.getItem(PRIMARY_ADDRESS_KEY);
    setPrimaryAddress(primary);
    setDeliveryModalVisible(true);
  };

  const handleSetPrimaryAddress = async (address: string) => {
    await AsyncStorage.setItem(PRIMARY_ADDRESS_KEY, address);
    setPrimaryAddress(address);
  };

  const fetchAddressSuggestions = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setAddressSuggestions([]);
      return;
    }
    try {
      let data = await api.get(`address-autocomplete?q=${encodeURIComponent(text)}`).then((res) => {
        if (res.status === 200) {
          return res.data;
        } else {
          Alert.alert('Error', 'Failed to fetch address suggestions');
          return [];
        }
      });
      setAddressSuggestions(data);
    } catch {
      setAddressSuggestions([]);
    }
  };

  const handleSelectPrimaryAddress = async (address: string) => {
    await AsyncStorage.setItem(PRIMARY_ADDRESS_KEY, address);
    setPrimaryAddress(address);
    setSearchQuery('');
    setAddressSuggestions([]);
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      let data = await api.post('auth/sign-in/?client_id=courier', {
        email,
        password,
      }).then((res) => {
        if (res.status === 200) {
          return res.data;
        } else {
          Alert.alert('Error', 'Failed to sign in');
          throw new Error('Sign in failed');
        }
      });

      setLoggedInEmail(email);
      await AsyncStorage.setItem(LOGGED_IN_EMAIL_KEY, email);
      if (data.access_token) {
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      }
      if (data.first_name) await AsyncStorage.setItem('user_first_name', data.first_name);
      if (data.last_name) await AsyncStorage.setItem('user_last_name', data.last_name);
      if (data.phone_number) await AsyncStorage.setItem('user_phone', data.phone_number);
      setMode('none');
  } catch (err) {
      Alert.alert(t('error'), t('errorMsg'));
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    try {
      let data = await api.post('auth/sign-up/', {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone,
        password,
      }).then((res) => {
        if (res.status === 201) {
          return res.data;
        } else {
          Alert.alert('Error', 'Failed to sign up');
          throw new Error('Sign up failed');
        }
      });
        if (data.first_name) await AsyncStorage.setItem('user_first_name', data.first_name);
        if (data.last_name) await AsyncStorage.setItem('user_last_name', data.last_name);
        if (data.phone_number) await AsyncStorage.setItem('user_phone', data.phone_number);
        Alert.alert(t('registrationSuccess'), t('registrationSuccessMsg'));
        setMode('login');
    } catch (err) {
      Alert.alert(t('error'), t('errorMsg'));
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        setLoggedInEmail(null);
        await AsyncStorage.removeItem(LOGGED_IN_EMAIL_KEY);
        await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
        setLoading(false);
        return;
      }
      await api.post('auth/sign-out/', {
        refresh_token: refreshToken,
      }).then((res) => {
        if (res.status === 204) {
          setLoggedInEmail(null);
          AsyncStorage.removeItem(LOGGED_IN_EMAIL_KEY);
          AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
          AsyncStorage.removeItem(PRIMARY_ADDRESS_KEY);
          AsyncStorage.removeItem(DELIVERY_HISTORY_KEY);
          setDeliveryHistory([]);
          setPrimaryAddress(null);
          Alert.alert(t('loggedOut'), t('loggedOutMsg'));
        } else {
          Alert.alert('Error', 'Failed to log out');
        }
      });
    } catch (err) {
      Alert.alert(t('error'), t('errorMsg'));
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    setLoading(true);
    try {
      await api.post('auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }).then((res) => {
        if (res.status === 200) {
          Alert.alert(t('passwordChanged'), t('passwordChangedMsg'));
          setShowChangePassword(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } else {
          let data = res.data;
          Alert.alert(t('error'), data.detail || t('passwordChangeFailed'));
        }
      });
    } catch (err) {
      Alert.alert(t('error'), t('errorMsg'));
    }
    setLoading(false);
  };

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setShowPassword(false);
    setLoading(false);
  };

  const [userInfoFields, setUserInfoFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    AsyncStorage.getItem(LOGGED_IN_EMAIL_KEY).then(async (email) => {
      if (email) {
        const firstName = await AsyncStorage.getItem('user_first_name');
        const lastName = await AsyncStorage.getItem('user_last_name');
        const phone = await AsyncStorage.getItem('user_phone');
        if (!firstName || !lastName || !phone) {
          try {
            let data = await api.get('users/profile/?email=' + encodeURIComponent(email)).then((res) => {
              if(res.status === 200) {
                return res.data;
              } else{
                throw new Error('Failed to fetch user info');
              }
            })
            setUserInfoFields({
              firstName: data.first_name || '',
              lastName: data.last_name || '',
              email: email || '',
              phone: data.phone_number || '',
            });
            if (data.first_name) await AsyncStorage.setItem('user_first_name', data.first_name);
            if (data.last_name) await AsyncStorage.setItem('user_last_name', data.last_name);
            if (data.phone_number) await AsyncStorage.setItem('user_phone', data.phone_number);
            return;
          } catch (e) {}
        }
        setUserInfoFields({
          firstName: firstName || '',
          lastName: lastName || '',
          email: email || '',
          phone: phone || '',
        });
      }
    });
  }, [loggedInEmail]);

  return (
    <>
      <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
      {mode === 'none' ? (
        <SidebarButtonWithLogo onPress={toggleSidebar} />
      ) : (
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => { setMode('none'); resetFields(); }}
        >
          <Ionicons name="arrow-back" size={28} color={styles.sidebarButtonText.color} />
        </TouchableOpacity>
      )}
      <View style={styles.screenContainer}>
        <ScrollView
          contentContainerStyle={[
            {
              flexGrow: 1,
              paddingHorizontal: 24,
              paddingTop: 20,
            },
            (mode === 'login' || mode === 'signup') && { justifyContent: 'center', flex: 1 }
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {mode === 'none' && (
            <>
              {loggedInEmail ? (
                <>
                  <View style={styles.welcomeContainer}>
                    <Text style={styles.welcomeText}>
                      {t('welcome')}, {extractUsername(loggedInEmail)}
                    </Text>
                  </View>
                  <View style={styles.profileWideButtonGroup}>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setUserInfoModalVisible(true)}
                    >
                      <Ionicons name="person-outline" size={20} color={styles.languageButtonText.color} />
                      <Text style={styles.languageButtonText}>
                        {t('userInfo')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={handleOpenDeliveryModal}
                    >
                      <Ionicons name="home-outline" size={20} color={styles.languageButtonText.color} />
                      <Text style={styles.languageButtonText}>
                        {t('deliveryAddresses')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setNotificationModalVisible(true)}
                    >
                      <Ionicons name="notifications-off-outline" size={20} color={styles.languageButtonText.color} />
                      <Text style={styles.languageButtonText}>
                        {t('disableNotifications')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setLanguageModalVisible(true)}
                    >
                      <Ionicons name="globe-outline" size={20} color={styles.languageButtonText.color} />
                      <Text style={styles.languageButtonText}>
                        {t('language')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setLocationModalVisible(true)}
                    >
                      <Ionicons name="location-outline" size={20} color={styles.locationToggleLabel.color} />
                      <Text style={styles.locationToggleLabel}>
                        {t('location')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setLegalModalVisible(true)}
                    >
                      <Ionicons name="document-text-outline" size={20} color={styles.languageButtonText.color} />
                      <Text style={styles.languageButtonText}>
                        {t('legal')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.authButton, { marginTop: 24 }]}
                    onPress={handleSignOut}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.authButtonText}>
                        {t('logOut')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.profileChoiceRowTop}>
                    <TouchableOpacity
                      style={styles.profileChoiceButton}
                      onPress={() => { setMode('login'); resetFields(); }}
                    >
                      <Text style={styles.profileChoiceButtonText}>{t('logIn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.profileChoiceButton, styles.profileChoiceButtonAccent]}
                      onPress={() => { setMode('signup'); resetFields(); }}
                    >
                      <Text style={styles.profileChoiceButtonText}>{t('signUp')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.profileWideButtonGroup}>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setLanguageModalVisible(true)}
                    >
                      <Ionicons name="globe-outline" size={20} color={styles.languageButtonText.color} />
                      <Text style={styles.languageButtonText}>
                        {t('language')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setLocationModalVisible(true)}
                    >
                      <Ionicons name="location-outline" size={20} color={styles.locationToggleLabel.color} />
                      <Text style={styles.locationToggleLabel}>
                        {t('location')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileWideButton}
                      onPress={() => setLegalModalVisible(true)}
                    >
                      <Ionicons name="document-text-outline" size={20} color={styles.languageButtonText.color} />
                      <Text style={styles.languageButtonText}>
                        {t('legal')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              <Modal
                visible={legalModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLegalModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.authTitle}>{t('legal')}</Text>
                    <Text style={{ marginBottom: 18, color: '#333' }}>
                      {t('lorem')}
                    </Text>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setLegalModalVisible(false)}>
                      <Text style={styles.modalCloseText}>{t('close')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              <Modal
                visible={languageModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLanguageModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.authTitle}>
                      {t('selectLanguage')}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.languageOptionButton,
                        language === 'da' && styles.languageOptionButtonSelected,
                      ]}
                      onPress={() => {
                        setLanguage('da');
                        setLanguageModalVisible(false);
                      }}
                    >
                      <Text style={styles.languageButtonText}>Dansk</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.languageOptionButton,
                        language === 'en' && styles.languageOptionButtonSelected,
                      ]}
                      onPress={() => {
                        setLanguage('en');
                        setLanguageModalVisible(false);
                      }}
                    >
                      <Text style={styles.languageButtonText}>English</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalClose}
                      onPress={() => setLanguageModalVisible(false)}
                    >
                      <Text style={styles.modalCloseText}>
                        {t('close')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              <Modal
                visible={locationModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLocationModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.authTitle}>
                      {t('location')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
                      <Text style={styles.locationToggleLabel}>
                        {t('allowLocation')}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.locationToggleButton,
                          locationEnabled && styles.locationToggleButtonActive,
                        ]}
                        onPress={() => setLocationEnabled(!locationEnabled)}
                      >
                        <Ionicons
                          name={locationEnabled ? 'toggle' : 'toggle-outline'}
                          size={32}
                          color={locationEnabled ? '#4caf50' : '#888'}
                        />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.modalClose}
                      onPress={() => setLocationModalVisible(false)}
                    >
                      <Text style={styles.modalCloseText}>
                        {t('close')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              <Modal
                visible={userInfoModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setUserInfoModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.authTitle}>
                      {t('userInfo')}
                    </Text>
                    {userInfo ? (
                      <>
                        <Text style={styles.userInfoText}>
                          {t('name')} {userInfo.first_name} {userInfo.last_name}
                        </Text>
                        <Text style={styles.userInfoText}>
                          Email: {userInfo.email}
                        </Text>
                        <Text style={styles.userInfoText}>
                          {t('phoneLabel')} {userInfo.phone_number}
                        </Text>
                        <TouchableOpacity
                          style={styles.authButton}
                          onPress={() => setShowChangePassword(true)}
                        >
                          <Text style={styles.authButtonText}>
                            {t('changePassword')}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <ActivityIndicator color={styles.authButtonText.color || "#2cb673"} />
                    )}
                    <TouchableOpacity
                      style={styles.modalClose}
                      onPress={() => setUserInfoModalVisible(false)}
                    >
                      <Text style={styles.modalCloseText}>
                        {t('close')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              <Modal
                visible={showChangePassword}
                transparent
                animationType="fade"
                onRequestClose={() => setShowChangePassword(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.authTitle}>
                      {t('changePassword')}
                    </Text>
                    <Text style={styles.authLabel}>
                      {t('currentPassword')}
                    </Text>
                    <View style={styles.passwordInputWrapper}>
                      <TextInput
                        style={[styles.authInput, styles.passwordInput]}
                        placeholder={t('currentPassword')}
                        secureTextEntry={!showCurrentPassword}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                        style={styles.eyeButton}
                        accessibilityLabel={showCurrentPassword ? t('password') : t('password')}
                      >
                        <Ionicons
                          name={showCurrentPassword ? 'eye-off' : 'eye'}
                          size={22}
                          color="#888"
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.authLabel}>
                      {t('newPassword')}
                    </Text>
                    <View style={styles.passwordInputWrapper}>
                      <TextInput
                        style={[styles.authInput, styles.passwordInput]}
                        placeholder={t('newPassword')}
                        secureTextEntry={!showNewPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowNewPassword(!showNewPassword)}
                        style={styles.eyeButton}
                        accessibilityLabel={showNewPassword ? t('password') : t('password')}
                      >
                        <Ionicons
                          name={showNewPassword ? 'eye-off' : 'eye'}
                          size={22}
                          color="#888"
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.authLabel}>
                      {t('confirmNewPassword')}
                    </Text>
                    <View style={styles.passwordInputWrapper}>
                      <TextInput
                        style={[styles.authInput, styles.passwordInput]}
                        placeholder={t('confirmNewPassword')}
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                        accessibilityLabel={showConfirmPassword ? t('password') : t('password')}
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off' : 'eye'}
                          size={22}
                          color="#888"
                        />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.authButton}
                      onPress={handleChangePassword}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.authButtonText}>
                          {t('changePassword')}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalClose}
                      onPress={() => setShowChangePassword(false)}
                    >
                      <Text style={styles.modalCloseText}>
                        {t('close')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              <Modal
                visible={deliveryModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDeliveryModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <Text style={styles.authTitle}>
                      {t('deliveryAddresses')}
                    </Text>
                    <Text style={styles.authLabel}>
                      {t('searchAndSelectPrimary')}
                    </Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        style={styles.authInput}
                        placeholder={t('searchAddress')}
                        value={searchQuery}
                        onChangeText={fetchAddressSuggestions}
                      />
                      {addressSuggestions.length > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 48,
                            left: 0,
                            right: 0,
                            zIndex: 10,
                            backgroundColor: '#fff',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#eee',
                            maxHeight: 160,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 5,
                          }}
                        >
                          <ScrollView>
                            {addressSuggestions.map((item: any, idx: number) => (
                              <TouchableOpacity
                                key={item.tekst || idx}
                                style={styles.suggestion}
                                onPress={() => handleSelectPrimaryAddress(item.tekst)}
                              >
                                <Text>{item.tekst}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                    {primaryAddress && (
                      <View style={{ marginBottom: 12, marginTop: 16 }}>
                        <Text style={[styles.userInfoText, { fontWeight: 'bold', color: '#2cb673' }]}>
                          {t('primaryAddress')}
                        </Text>
                        <Text style={[styles.userInfoText, { marginBottom: 6 }]}>
                          {primaryAddress}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.searchHistoryHeader}>
                      {t('searchHistory')}
                    </Text>
                    {deliveryHistory.length === 0 ? (
                      <Text style={styles.userInfoText}>
                        {t('noSavedAddresses')}
                      </Text>
                    ) : (
                      <ScrollView style={styles.searchHistoryList}>
                        {deliveryHistory.map((addr, idx) => (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.userInfoText}>{addr}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    )}
                    <TouchableOpacity
                      style={[styles.authButton, { backgroundColor: styles.modalCloseText.color }]}
                      onPress={clearDeliveryHistory}
                    >
                      <Text style={styles.authButtonText}>
                        {t('deleteAllAddresses')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalClose}
                      onPress={() => setDeliveryModalVisible(false)}
                    >
                      <Text style={styles.modalCloseText}>
                        {t('close')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </>
          )}
          {mode === 'login' && (
            <View>
              <Text style={styles.authTitle}>{t('logIn')}</Text>
              <Text style={styles.authLabel}>{t('email')}</Text>
              <TextInput
                style={styles.authInput}
                placeholder={t('enterEmail')}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={styles.authLabel}>{t('password')}</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[styles.authInput, styles.passwordInput]}
                  placeholder={t('enterPassword')}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityLabel={showPassword ? t('password') : t('password')}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color="#888"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.authButton}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.authButtonText}>{t('logIn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {mode === 'signup' && (
            <View>
              <Text style={styles.authTitle}>{t('signUp')}</Text>
              <Text style={styles.authLabel}>{t('firstName')}</Text>
              <TextInput
                style={styles.authInput}
                placeholder={t('firstName')}
                value={firstName}
                onChangeText={setFirstName}
              />
              <Text style={styles.authLabel}>{t('lastName')}</Text>
              <TextInput
                style={styles.authInput}
                placeholder={t('lastName')}
                value={lastName}
                onChangeText={setLastName}
              />
              <Text style={styles.authLabel}>{t('email')}</Text>
              <TextInput
                style={styles.authInput}
                placeholder={t('email')}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={styles.authLabel}>{t('phone')}</Text>
              <TextInput
                style={styles.authInput}
                placeholder={t('phone')}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <Text style={styles.authLabel}>{t('password')}</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[styles.authInput, styles.passwordInput]}
                  placeholder={t('password')}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityLabel={showPassword ? t('password') : t('password')}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color="#888"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.authButton}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.authButtonText}>{t('signUp')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}