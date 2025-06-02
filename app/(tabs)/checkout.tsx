import { FontAwesome, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CollapsibleSection } from '../../components/CollapsibleSection';
import { Sidebar } from '../../components/Sidebar';
import { SidebarButtonWithLogo } from '../../components/SidebarButton';
import * as api from '../../constants/API';
import translations from '../../constants/locales';
import { useBasket } from '../../contexts/BasketContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSidebar } from '../../hooks/useSidebar';
import { styles } from '../../styles';
const PRIMARY_ADDRESS_KEY = 'primary_address';

export default function CheckoutScreen() {
  const router = useRouter();

  const { basket, setBasket, notes, setNotes, clearBasket, partnerId } = useBasket();
  const [address, setAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState<{ longitude: number; latitude: number } | null>(null);
  const [driverNote, setDriverNote] = useState('');
  const [editingDriverNote, setEditingDriverNote] = useState('');
  const [payment, setPayment] = useState<'mobilepay' | 'card' | 'bank' | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  

  // User info state
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userInfoFields, setUserInfoFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');

  const [mobilePayPhone, setMobilePayPhone] = useState('');

  const [bankAccount, setBankAccount] = useState('');
  const [bankReg, setBankReg] = useState('');
  const [iban, setIban] = useState('');
  const [swift, setSwift] = useState('');

  const { sidebarVisible, toggleSidebar, closeSidebar } = useSidebar();

  // Language context
  const { language } = useLanguage();
  const t = (key: keyof typeof translations["da"]) => (translations[language] as typeof translations["da"])[key];

  const total = basket.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 1)), 0);

  const [tipPercent, setTipPercent] = useState<number | null>(5);
  const [customTip, setCustomTip] = useState<string>('');
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [tipSectionOpen, setTipSectionOpen] = useState(true);

  const tipAmount =
    tipPercent !== null
      ? Math.round((total * tipPercent) / 100)
      : customTip
      ? Math.max(0, Math.round(Number(customTip)))
      : 0;

  // Load default address from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(PRIMARY_ADDRESS_KEY).then(addr => {
      if (addr) setAddress(addr);
    });
  }, []);

  // Save address to AsyncStorage when changed and not empty
  useEffect(() => {
    if (address) {
      AsyncStorage.setItem(PRIMARY_ADDRESS_KEY, address);
    }
  }, [address]);

  // Autofill user info if logged in
  useEffect(() => {
    AsyncStorage.getItem('logged_in_email').then(async (email) => {
      if (email) {
        const firstName = await AsyncStorage.getItem('user_first_name');
        const lastName = await AsyncStorage.getItem('user_last_name');
        const phone = await AsyncStorage.getItem('user_phone');

        if (!firstName || !lastName || !phone) {
          try {
            const data = await api.get('users/profile/?email=' + encodeURIComponent(email)).then((res) => {
              if (res.status === 200) {
                return res.data;
              }
              else {
                throw new Error('Failed to fetch user profile');
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
          } catch (e) {
          }
        }

        setUserInfoFields({
          firstName: firstName || '',
          lastName: lastName || '',
          email: email || '',
          phone: phone || '',
        });
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/menu');
        return true;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [router])
  );


  useEffect(() => {
    AsyncStorage.setItem('basket', JSON.stringify(basket));
  }, [basket]);

  useEffect(() => {
    AsyncStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  // Basket controls
  const handleIncrease = (id: number) => {
    setBasket((prev: any[]) =>
      prev.map((item: any) => item.id === id ? { ...item, quantity: (item.quantity || 1) + 1 } : item)
    );
  };
  const handleDecrease = (id: number) => {
    setBasket((prev: any[]) => {
      const item = prev.find((item: any) => item.id === id);
      if (!item) return prev;
      if ((item.quantity || 1) <= 1) {
        Alert.alert(
          t('removeItem') || 'Fjern vare',
          t('removeItemConfirm') || 'Vil du fjerne denne vare fra kurven?',
          [
            { text: t('cancel') || 'Annuller', style: 'cancel' },
            { text: t('remove') || 'Fjern', style: 'destructive', onPress: () => setBasket((prev2: any[]) => prev2.filter((i: any) => i.id !== id)) }
          ]
        );
        return prev;
      }
      return prev.map((item: any) =>
        item.id === id ? { ...item, quantity: (item.quantity || 1) - 1 } : item
      );
    });
  };
  const handleRemove = (id: number) => {
    setBasket((prev: any[]) => prev.filter((item: any) => item.id !== id));
  };

const sendPushToken = async () => {
  try {
    let token = null;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus === 'granted') {
        const expoPushToken = await Notifications.getExpoPushTokenAsync({
          projectId: "30572909-5581-4788-95a8-db5837a94828"
        });
        token = expoPushToken.data;
        console.log('Expo push notification token:', token);
        await api.post('users/push-token/', {
          token,
          app_type: 'customer',
        });
      }
    }
  } catch (e) {
    console.log('Push token error:', e);
  }
};
  const triedSubmit = useRef(false);

  // Validation logic
  const getMissingFields = () => {
    const missing: string[] = [];
    if (!userInfoFields.firstName) missing.push(t('firstName') || 'First name');
    if (!userInfoFields.lastName) missing.push(t('lastName') || 'Last name');
    if (!userInfoFields.email) missing.push(t('email') || 'Email');
    if (!userInfoFields.phone) missing.push(t('phone') || 'Phone');
    if (!address) missing.push(t('deliveryAddresses') || 'Address');
    if (!payment) missing.push(t('paymentMethod') || 'Payment method');
    if (basket.length === 0) missing.push(t('orderSummary') || 'Order');

    // Payment-specific
    if (payment === 'card') {
      if (!cardNumber) missing.push(t('cardNumber') || 'Card number');
      if (!cardExpiry) missing.push(t('cardExpiry') || 'Expiry');
      if (!cardCVC) missing.push(t('cardCVC') || 'CVC');
    }
    if (payment === 'mobilepay') {
      if (!mobilePayPhone) missing.push(t('phone') || 'MobilePay phone');
    }
    if (payment === 'bank') {
      if (!bankReg) missing.push(t('bankReg') || 'Reg. nr.');
      if (!bankAccount) missing.push(t('bankAccount') || 'Account no.');
      if (!iban) missing.push(t('bankIBAN') || 'IBAN');
      if (!swift) missing.push(t('bankSWIFT') || 'SWIFT/BIC');
    }
    return missing;
  };

  const missingFields = getMissingFields();
  const canSubmit = missingFields.length === 0;

  const [minPrepTime, setMinPrepTime] = useState(30);

  useEffect(() => {
    async function fetchMinPrepTime() {
      if (!partnerId) return;
      try {
        const data = await api.get(`partners/${partnerId}/`).then((res) => {
          if (res.status === 200) {
            return res.data;
          } else {
            throw new Error('Failed to fetch partner data');
          }
        });
        setMinPrepTime(Number(data.min_preparation_time) || 30);
      } catch {
        setMinPrepTime(30);
      }
    }
    fetchMinPrepTime();
  }, [partnerId]);
  useEffect(() => {
    async function fetchHoursAndSetOptions() {
      if (!partnerId) return;
      setHoursLoading(true);
      try {
        const todayIdx = getTodayDayIndex();

        let data = await api.get(`partners/${partnerId}/hours/`).then((res) => {
          if (res.status === 200) {
            return res.data;
          } else {
            throw new Error('Failed to fetch partner hours');
          }
        });
        const today = Array.isArray(data)
          ? data.find((h: any) => h.day_of_week === todayIdx)
          : Array.isArray(data.hours)
            ? data.hours.find((h: any) => h.day_of_week === todayIdx)
            : undefined;
        if (!today) {
          setDeliveryOptions(['ASAP']);
          setDeliveryTime('ASAP');
          setHoursLoading(false);
          return;
        }
        const now = new Date();
        const [openH, openM] = today.opens_at.split(':').map(Number);
        const [closeH, closeM] = today.closes_at.split(':').map(Number);
        const openDate = new Date(now);
        openDate.setHours(openH, openM, 0, 0);
        const closeDate = new Date(now);
        closeDate.setHours(closeH, closeM, 0, 0);

        console.log('now:', now, 'openDate:', openDate, 'closeDate:', closeDate);

        // If now is after closing, only ASAP
        if (now > closeDate) {
          setDeliveryOptions(['ASAP']);
          setDeliveryTime('ASAP');
          setHoursLoading(false);
          return;
        }

        // Start from now + minPrepTime, rounded up to next 15 min
        let start = new Date(now.getTime() + minPrepTime * 60000);
        if (start < openDate) start = new Date(openDate);

        const minutes = start.getMinutes();
        if (minutes % 15 !== 0) {
          start.setMinutes(Math.ceil(minutes / 15) * 15, 0, 0);
        } else {
          start.setSeconds(0, 0);
        }

        if (start > closeDate) {
          setDeliveryOptions(['ASAP']);
          setDeliveryTime('ASAP');
          setHoursLoading(false);
          return;
        }

        const options = [];
        let slot = new Date(start);
        let firstSlotLabel = slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        options.push('ASAP');
        slot = new Date(slot.getTime() + 15 * 60000);

        while (slot <= closeDate) {
          const label = slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          options.push(label);
          slot = new Date(slot.getTime() + 15 * 60000);
        }
        setDeliveryOptions(options);
        setDeliveryTime('ASAP');
      } catch {
        setDeliveryOptions(['ASAP']);
        setDeliveryTime('ASAP');
      }
      setHoursLoading(false);
    }
    fetchHoursAndSetOptions();
  }, [partnerId, minPrepTime]);

  const handleConfirm = async () => {
  triedSubmit.current = true;
  if (!canSubmit) {
    Alert.alert(
      t('missingFieldsTitle') || 'Mangler oplysninger',
      (t('missingFieldsMsg') || 'Udfyld venligst følgende felter:') + '\n' + missingFields.join('\n')
    );
    return;
  }

  const parsedAddress = parseAddress(address);
  let coords = null;
  try {
    let proxySuggestions = await api.get(`address-autocomplete?q=${encodeURIComponent(address)}`).then((res) => {
      if (res.status === 200) {
        return res.data;
      } else {
        throw new Error('Failed to fetch address suggestions');
      }
    });
    if (Array.isArray(proxySuggestions) && proxySuggestions.length > 0) {
      const first = proxySuggestions[0];
      if (
        first &&
        first.data &&
        typeof first.data.x === 'number' &&
        typeof first.data.y === 'number'
      ) {
        coords = {
          longitude: first.data.x,
          latitude: first.data.y,
        };
      }
    }
  } catch (e) {
    coords = null;
  }
  setAddressCoords(coords);

  let requested_delivery_time: string;
  if (deliveryTime === "ASAP") {
    const now = new Date();
    let slot = new Date(now.getTime() + minPrepTime * 60000);
    const minutes = slot.getMinutes();
    if (minutes % 15 !== 0) {
      slot.setMinutes(Math.ceil(minutes / 15) * 15, 0, 0);
    } else {
      slot.setSeconds(0, 0);
    }
    requested_delivery_time = slot.toISOString();
  } else {
    const now = new Date();
    const [h, m] = deliveryTime.split(':');
    const dt = new Date(now);
    dt.setHours(Number(h), Number(m), 0, 0);
    if (dt < now) dt.setDate(dt.getDate() + 1);
    requested_delivery_time = dt.toISOString();
  }

  const payload = {
    customer: {
      first_name: userInfoFields.firstName,
      last_name: userInfoFields.lastName,
      email: userInfoFields.email,
      phone_number: userInfoFields.phone,
      address: {
        country: "Denmark",
        city: parsedAddress.city,
        street: parsedAddress.street,
        postal_code: parsedAddress.postal_code,
        address_detail: parsedAddress.address_detail,
        longitude: coords?.longitude ?? null,
        latitude: coords?.latitude ?? null,
      }
    },
    order: {
      partner_id: Number(partnerId),
      delivery_type: deliveryType,
      requested_delivery_time,
      tip_amount: tipAmount,
      note: driverNote,
      items: basket.map(item => ({
        catalog_item_id: item.id,
        quantity: item.quantity,
        note: notes[item.id] || ""
      }))
    },
    payment: {
      method:
        payment === "card"
          ? "credit_card"
          : payment === "mobilepay"
          ? "mobile_pay"
          : payment === "bank"
          ? "bank"
          : ""
    }
  };

  try {
    let result = await api.post('orders/', payload).then((res) => {
      if (res.status === 201) {
        return res.data;
      } else {
        throw new Error('Failed to create order');
      }
    });
    await sendPushToken();
    await AsyncStorage.setItem('last_order_fallback', JSON.stringify({
      id: result.id,
      partner_id: Number(partnerId),
      customer: {
        first_name: userInfoFields.firstName,
        last_name: userInfoFields.lastName,
        email: userInfoFields.email,
        phone_number: userInfoFields.phone,
        address: {
          country: "Denmark",
          city: parsedAddress.city,
          street: parsedAddress.street,
          postal_code: parsedAddress.postal_code,
          address_detail: parsedAddress.address_detail,
          longitude: coords?.longitude ?? null,
          latitude: coords?.latitude ?? null,
        }
      },
      delivery_type: deliveryType,
      status: 'Pending',
      requested_delivery_time,
      tip_amount: tipAmount,
      total_amount: totalWithDelivery,
      total_items: basket.reduce((sum, item) => sum + item.quantity, 0),
      items: basket.map(item => ({
        catalog_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name,
      })),
      payment: {
        method:
          payment === "card"
            ? "credit_card"
            : payment === "mobilepay"
            ? "mobile_pay"
            : payment === "bank"
            ? "bank"
            : "",
        status: 'pending'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      delivery_fee: deliveryFee,
    }));
    Alert.alert('Order placed!', 'Your order was successfully submitted.');
    router.replace('/(tabs)/tracking');
  } catch (err) {
    Alert.alert('Order failed', 'Could not send order to backend.');
  }
};

  const resetPaymentFields = () => {
    setCardNumber('');
    setCardExpiry('');
    setCardCVC('');
    setMobilePayPhone('');
    setBankAccount('');
    setBankReg('');
    setIban('');
    setSwift('');
  };

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);

  useEffect(() => {
    async function fetchDeliveryFee() {
      if (!partnerId || deliveryType === 'pickup') {
        setDeliveryFee(0);
        return;
      }
      try {
        let data = await api.get(`partners/${partnerId}/`).then((res) => {
          if (res.status === 200) {
            return res.data;
          } else {
            throw new Error('Failed to fetch partner data');
          }
        });
        setDeliveryFee(Number(data.delivery_fee));
      } catch {
        setDeliveryFee(0);
      }
    }
    fetchDeliveryFee();
  }, [partnerId, deliveryType]);

  const totalWithTip = total + tipAmount;
  const totalWithDelivery = totalWithTip + (deliveryFee && deliveryType === 'delivery' ? deliveryFee : 0);
  const [userInfoModalVisible, setUserInfoModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [deliveryTimeModalVisible, setDeliveryTimeModalVisible] = useState(false);
  const [editingUserInfoFields, setEditingUserInfoFields] = useState(userInfoFields);
  const [editingAddressQuery, setEditingAddressQuery] = useState(address);

  const openUserInfoModal = () => {
    setEditingUserInfoFields(userInfoFields);
    setUserInfoModalVisible(true);
  };
  const openAddressModal = () => {
    setEditingAddressQuery('');
    setAddressSuggestions([]);
    setAddressModalVisible(true);
  };

  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);

  const fetchAddressSuggestions = async (text: string) => {
    setAddressQuery(text);
    if (text.length < 2) {
      setAddressSuggestions([]);
      return;
    }
    try {
      const data = await api.get(`address-autocomplete?q=${encodeURIComponent(text)}`).then((res) => {
        if (res.status === 200) {
          return res.data;
        } else {
          throw new Error('Failed to fetch address suggestions');
        }
      });
      setAddressSuggestions(data);
    } catch (e) {
      setAddressSuggestions([]);
    }
  };

  function isValidAddress(address: string) {
    const streetRegex = /\d+/;
    const streetNameRegex = /[A-Za-zæøåÆØÅ]{2,}/;
    const zipRegex = /\b\d{4,5}\b/;
    const cityRegex = /[A-Za-zæøåÆØÅ]{2,}(?: [A-Za-zæøåÆØÅ0-9]{1,3})*$/;

    return (
      streetRegex.test(address) &&
      streetNameRegex.test(address) &&
      cityRegex.test(address) &&
      zipRegex.test(address)
    );
  }

  function pruneCommas(address: string) {
    return address.replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*/g, ' ');
  }

  function parseAddress(address: string) {
    const clean = address.replace(/,/g, '').trim();
    const match = clean.match(/^(.+?)\s+(\d{4,5})\s+(.+)$/);
    if (match) {
      return {
        street: match[1].trim(),
        postal_code: match[2].trim(),
        city: match[3].trim(),
        address_detail: '',
      };
    }
    const zipMatch = clean.match(/(.*?)(\d{4,5})\s*(.*)/);
    if (zipMatch) {
      return {
        street: zipMatch[1].trim(),
        postal_code: zipMatch[2].trim(),
        city: zipMatch[3].trim(),
        address_detail: '',
      };
    }
    return {
      street: clean,
      postal_code: '',
      city: '',
      address_detail: '',
    };
  }

  const [deliveryTime, setDeliveryTime] = useState<'ASAP' | string>('ASAP');
  const [deliveryOptions, setDeliveryOptions] = useState<string[]>(['ASAP']);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [deliveryDropdownOpen, setDeliveryDropdownOpen] = useState(false);

  function getTodayDayIndex() {
    const jsDay = new Date().getDay(); // 0=Sunday, 6=Saturday
    return jsDay === 0 ? 6 : jsDay - 1;
  }

  useEffect(() => {
  async function fetchHoursAndSetOptions() {
    if (!partnerId) {
      return;
    }
      setHoursLoading(true);
      try {
        const todayIdx = getTodayDayIndex();
        let data = await api.get(`partners/${partnerId}/hours/`).then((res) => {
          if (res.status === 200) {
            return res.data;
          } else {
            throw new Error('Failed to fetch partner hours');
          }
        });
        console.log('hours API data:', data, 'todayIdx:', todayIdx);

      const today = Array.isArray(data)
        ? data.find((h: any) => h.day_of_week === todayIdx)
        : Array.isArray(data.hours)
          ? data.hours.find((h: any) => h.day_of_week === todayIdx)
          : undefined;
          if (!today) {
          setDeliveryOptions(['ASAP']);
          setDeliveryTime('ASAP');
          setHoursLoading(false);
          return;
        }
        const now = new Date();
        const [openH, openM] = today.opens_at.split(':').map(Number);
        const [closeH, closeM] = today.closes_at.split(':').map(Number);
        const openDate = new Date(now);
        openDate.setHours(openH, openM, 0, 0);
        const closeDate = new Date(now);
        closeDate.setHours(closeH, closeM, 0, 0);

        // If now is after closing, only ASAP
        if (now > closeDate) {
          setDeliveryOptions(['ASAP']);
          setDeliveryTime('ASAP');
          setHoursLoading(false);
          return;
        }

        let start = new Date(now.getTime() + minPrepTime * 60000);
        if (start < openDate) start = new Date(openDate);

        // Round up to next 15 min
        const minutes = start.getMinutes();
        if (minutes % 15 !== 0) {
          start.setMinutes(Math.ceil(minutes / 15) * 15, 0, 0);
        } else {
          start.setSeconds(0, 0);
        }

        // If start is after closing, only ASAP
        if (start > closeDate) {
          setDeliveryOptions(['ASAP']);
          setDeliveryTime('ASAP');
          setHoursLoading(false);
          return;
        }

        // Build options: ASAP (first slot), then every 15 min until closing
        const options = [];
        let slot = new Date(start);
        let firstSlotLabel = slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        options.push('ASAP'); // ASAP means first slot
        slot = new Date(slot.getTime() + 15 * 60000);

        while (slot <= closeDate) {
          const label = slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          options.push(label);
          slot = new Date(slot.getTime() + 15 * 60000);
        }
        setDeliveryOptions(options);
        setDeliveryTime('ASAP');
      } catch {
        setDeliveryOptions(['ASAP']);
        setDeliveryTime('ASAP');
      }
      setHoursLoading(false);
    }
    fetchHoursAndSetOptions();
  }, [partnerId, minPrepTime]);

  return (
    <>
      <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
      <SidebarButtonWithLogo onPress={toggleSidebar} />

      <ScrollView contentContainerStyle={styles.checkoutScrollContainer}>
        {/* --- Order Details Dropdown --- */}
        <View style={styles.checkoutCard}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
            }}
            onPress={() => setOrderDetailsOpen(open => !open)}
            activeOpacity={0.85}
          >
            <Text style={styles.orderSummaryLabel}>
              {t('orderDetailsTitle') || "Your details for delivery"}
            </Text>
            <FontAwesome name={orderDetailsOpen ? "chevron-down" : "chevron-right"} size={18} color="#888" />
          </TouchableOpacity>
          {orderDetailsOpen && (
            <View>
              {/* User Info Row */}
              <TouchableOpacity
                style={styles.orderDetailsSection}
                onPress={openUserInfoModal}
                activeOpacity={0.8}
              >
                <View style={styles.editableRow}>
                  <Text style={styles.orderDetailsSectionTitle}>
                    {t('userInfoTitle') || "Who is ordering?"}
                  </Text>
                  <FontAwesome name="edit" size={18} color="#2cb673" style={{ marginLeft: 8 }} />
                </View>
                <Text style={styles.editableInfoText}>
                  {userInfoFields.firstName} {userInfoFields.lastName} | {userInfoFields.email} | {userInfoFields.phone}
                </Text>
              </TouchableOpacity>

              {/* Delivery/Pickup Question and Toggle - moved above address */}
              <View style={styles.orderDetailsSection}>
                <Text style={styles.orderDetailsSectionTitle}>
                  {deliveryType === 'pickup'
                    ? t('howGetFoodPickup') || "How would you like to get your food?"
                    : t('howGetFoodDelivery') || "How would you like to get your food?"}
                </Text>
                <View style={styles.deliveryTypeToggleWrapper}>
                  <Pressable
                    style={[
                      styles.deliveryTypeToggleOption,
                      deliveryType === 'delivery' && styles.deliveryTypeToggleOptionActive
                    ]}
                    onPress={() => setDeliveryType('delivery')}
                  >
                    <Text style={[
                      styles.deliveryTypeToggleText,
                      deliveryType === 'delivery' && styles.deliveryTypeToggleTextActive
                    ]}>
                      {t('deliverToMe') || "Deliver to me"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.deliveryTypeToggleOption,
                      deliveryType === 'pickup' && styles.deliveryTypeToggleOptionActive
                    ]}
                    onPress={() => setDeliveryType('pickup')}
                  >
                    <Text style={[
                      styles.deliveryTypeToggleText,
                      deliveryType === 'pickup' && styles.deliveryTypeToggleTextActive
                    ]}>
                      {t('illPickUp') || "I'll pick it up"}
                    </Text>
                  </Pressable>
                  <View
                    style={[
                      styles.deliveryTypeToggleSlider,
                      deliveryType === 'pickup' && { left: '50%' }
                    ]}
                    pointerEvents="none"
                  />
                </View>
              </View>

              {/* Address Row */}
              <TouchableOpacity
                style={styles.orderDetailsSection}
                onPress={openAddressModal}
                activeOpacity={0.8}
              >
                <View style={styles.editableRow}>
                  <Text style={styles.orderDetailsSectionTitle}>
                    {deliveryType === 'pickup'
                      ? t('billingAddressTitle') || "What is your billing address?"
                      : t('deliveryAddressTitle') || "Where should we deliver your food?"}
                  </Text>
                  <FontAwesome name="edit" size={18} color="#2cb673" style={{ marginLeft: 8 }} />
                </View>
                <Text style={styles.editableInfoText}>
                  {address || t('searchAddress')}
                </Text>
              </TouchableOpacity>

              {/* Delivery Time Row */}
              <View style={styles.orderDetailsSection}>
                <View style={styles.editableRow}>
                  <Text style={styles.orderDetailsSectionTitle}>
                    {deliveryType === 'pickup'
                      ? t('pickupTimeTitle') || "When should the food be ready for pickup?"
                      : t('deliveryTimeTitle') || "When should we deliver your food?"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deliveryDropdownButton}
                  onPress={() => setDeliveryTimeModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deliveryDropdownButtonText}>
                    {deliveryTime === 'ASAP' ? (t('asap') || 'ASAP') : deliveryTime}
                  </Text>
                  <FontAwesome name="chevron-right" size={18} color="#888" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>

              {/* Note Row */}
              <TouchableOpacity
                style={[styles.orderDetailsSection, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setEditingDriverNote(driverNote); // Set temp value
                  setNoteModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.editableRow}>
                  <Text style={styles.orderDetailsSectionTitle}>
                    {t('addNoteTitle') || "Anything the driver should know?"}
                  </Text>
                  <FontAwesome name="edit" size={18} color="#2cb673" style={{ marginLeft: 8 }} />
                </View>
                <Text style={styles.editableInfoText}>
                  {driverNote || t('addNote')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* --- User Info Modal --- */}
        <Modal
          visible={userInfoModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setUserInfoModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setUserInfoModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.orderDetailsSectionTitle}>{t('userInfo') || "Brugeroplysninger"}</Text>
              <TextInput
                style={styles.checkoutInput}
                placeholder={t('firstName') || "Fornavn"}
                value={editingUserInfoFields.firstName}
                onChangeText={text => setEditingUserInfoFields(f => ({ ...f, firstName: text }))}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.checkoutInput}
                placeholder={t('lastName') || "Efternavn"}
                value={editingUserInfoFields.lastName}
                onChangeText={text => setEditingUserInfoFields(f => ({ ...f, lastName: text }))}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.checkoutInput}
                placeholder={t('email') || "Email"}
                value={editingUserInfoFields.email}
                onChangeText={text => setEditingUserInfoFields(f => ({ ...f, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.checkoutInput}
                placeholder={t('phone') || "Telefon"}
                value={editingUserInfoFields.phone}
                onChangeText={text => setEditingUserInfoFields(f => ({ ...f, phone: text }))}
                keyboardType="phone-pad"
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.checkoutCancelButton, { flex: 1 }]}
                  onPress={() => {
                    setUserInfoModalVisible(false);
                  }}
                >
                  <Text style={styles.checkoutCancelButtonText}>{t('cancel') || "Annuller"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.checkoutConfirmButton, { flex: 1 }]}
                  onPress={() => {
                    setUserInfoFields(editingUserInfoFields);
                    setUserInfoModalVisible(false);
                  }}
                >
                  <Text style={styles.checkoutConfirmButtonText}>{t('save') || "Gem"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* --- Address Modal --- */}
        <Modal
          visible={addressModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setAddressModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setAddressModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.orderDetailsSectionTitle}>{t('deliveryAddresses') || "Leveringsadresse"}</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={styles.checkoutInput}
                  placeholder={t('searchAddress')}
                  value={editingAddressQuery}
                  onChangeText={async (text) => {
                    setEditingAddressQuery(text);
                    if (text.length < 2) {
                      setAddressSuggestions([]);
                      return;
                    }
                    try {
                      let data = await api.get(`address-autocomplete?q=${encodeURIComponent(text)}`).then((res) => {
                        if (res.status === 200) {
                          return res.data;
                        } else {
                          throw new Error('Failed to fetch address suggestions');
                        }
                      });
                      setAddressSuggestions(data);
                    } catch {
                      setAddressSuggestions([]);
                    }
                  }}
                  autoFocus
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
                      {addressSuggestions.slice(0, 5).map((item: any, idx: number) => (
                        <TouchableOpacity
                          key={item.tekst || idx}
                          style={styles.suggestion}
                          onPress={() => {
                            setEditingAddressQuery(pruneCommas(item.tekst));
                            setAddressSuggestions([]);
                          }}
                        >
                          <Text>{pruneCommas(item.tekst)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.checkoutCancelButton, { flex: 1 }]}
                  onPress={() => {
                    setAddressModalVisible(false);
                  }}
                >
                  <Text style={styles.checkoutCancelButtonText}>{t('cancel') || "Annuller"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.checkoutConfirmButton,
                    { flex: 1 },
                    !isValidAddress(editingAddressQuery) && { opacity: 0.5 }
                  ]}
                  disabled={!isValidAddress(editingAddressQuery)}
                  onPress={() => {
                    setAddress(pruneCommas(editingAddressQuery));
                    setAddressModalVisible(false);
                  }}
                >
                  <Text style={styles.checkoutConfirmButtonText}>{t('save') || "Gem"}</Text>
                </TouchableOpacity>
              </View>
              {!isValidAddress(editingAddressQuery) && editingAddressQuery.length > 0 && (
                <Text style={{ color: 'red', marginTop: 8 }}>
                  {t('invalidAddress') || "Indtast venligst en gyldig adresse med vejnavn, nummer, by og postnummer"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
        <Modal
          visible={noteModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setNoteModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setNoteModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.orderDetailsSectionTitle}>{t('addNote') || "Leveringsinstruktioner"}</Text>
              <TextInput
                placeholder={t('addNote')}
                value={editingDriverNote}
                onChangeText={setEditingDriverNote}
                style={styles.checkoutInput}
                maxLength={50}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.checkoutCancelButton, { flex: 1 }]}
                  onPress={() => {
                    setNoteModalVisible(false);
                  }}
                >
                  <Text style={styles.checkoutCancelButtonText}>{t('cancel') || "Annuller"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.checkoutConfirmButton, { flex: 1 }]}
                  onPress={() => {
                    setDriverNote(editingDriverNote);
                    setNoteModalVisible(false);
                  }}
                >
                  <Text style={styles.checkoutConfirmButtonText}>{t('save') || "Gem"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* --- Delivery Time Modal --- */}
        <Modal
          visible={deliveryTimeModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setDeliveryTimeModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setDeliveryTimeModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.orderDetailsSectionTitle}>
                {deliveryType === 'pickup'
                  ? t('pickupTimeTitle') || "When should the food be ready for pickup?"
                  : t('deliveryTimeTitle') || "When should we deliver your food?"}
              </Text>
                <ScrollView
                  style={{ maxHeight: 320, marginTop: 12 }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {(hoursLoading ? Array(1).fill('loading') : deliveryOptions).map((opt, idx) => (
                    <TouchableOpacity
                      key={opt === 'loading' ? 'loading' : opt}
                      style={[
                        styles.deliveryDropdownItem,
                        deliveryTime === opt && styles.deliveryDropdownItemActive
                      ]}
                      disabled={opt === 'loading'}
                      onPress={() => {
                        setDeliveryTime(opt);
                        setDeliveryTimeModalVisible(false);
                      }}
                    >
                      <Text style={[
                        styles.deliveryDropdownItemText,
                        deliveryTime === opt && styles.deliveryDropdownItemTextActive
                      ]}>
                        {opt === 'loading'
                          ? (t('loading') || 'Loading...')
                          : (opt === 'ASAP' ? (t('asap') || 'ASAP') : opt)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              <TouchableOpacity
                style={[styles.checkoutCancelButton, { marginTop: 18 }]}
                onPress={() => setDeliveryTimeModalVisible(false)}
              >
                <Text style={styles.checkoutCancelButtonText}>{t('cancel') || "Annuller"}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Payment */}
        <View style={styles.checkoutCard}>
          <CollapsibleSection title={t('paymentMethodTitle') || "How would you like to pay?"} initiallyOpen={false}>
            <View style={styles.checkoutPaymentRow}>
              {/* Credit Card */}
              <TouchableOpacity
                style={[
                  styles.checkoutPaymentButton,
                  styles.checkoutPaymentCreditCard,
                  payment === 'card' && styles.checkoutPaymentButtonActive,
                ]}
                onPress={() => {
                  resetPaymentFields();
                  setPayment('card');
                }}
                activeOpacity={0.8}
              >
                {payment === 'card' && (
                  <View style={styles.paymentCheckmarkContainer}>
                    <FontAwesome name="check-circle" size={22} color="#fff" />
                  </View>
                )}
                <FontAwesome5
                  name="credit-card"
                  size={28}
                  color="#fff"
                  style={{ marginRight: 16 }}
                />
                <Text style={[
                  styles.checkoutPaymentButtonText,
                  { color: '#fff' },
                  payment === 'card' && styles.checkoutPaymentButtonTextActive,
                ]}>
                  {t('paymentCard') || 'Kreditkort'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.checkoutPaymentButton,
                  styles.checkoutPaymentMobilePay,
                  payment === 'mobilepay' && styles.checkoutPaymentButtonActive,
                ]}
                onPress={() => {
                  resetPaymentFields();
                  setPayment('mobilepay');
                }}
                activeOpacity={0.8}
              >
                {payment === 'mobilepay' && (
                  <View style={styles.paymentCheckmarkContainer}>
                    <FontAwesome name="check-circle" size={22} color="#fff" />
                  </View>
                )}
                <MaterialCommunityIcons
                  name="cellphone"
                  size={24}
                  color="#fff"
                  style={{ marginRight: 12 }}
                />
                <Text style={[
                  styles.checkoutPaymentButtonText,
                  { color: '#fff' },
                  payment === 'mobilepay' && styles.checkoutPaymentButtonTextActive,
                ]}>
                  MobilePay
                </Text>
              </TouchableOpacity>
            </View>
            {/* Payment details input */}
            {payment === 'card' && (
              <View style={{ marginTop: 18, gap: 10 }}>
                <TextInput
                  style={styles.checkoutInput}
                  placeholder={t('cardNumber') || "Kortnummer"}
                  value={cardNumber}
                  onChangeText={setCardNumber}
                  keyboardType="number-pad"
                  maxLength={19}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={[styles.checkoutInput, { flex: 1 }]}
                    placeholder={t('cardExpiry') || "MM/ÅÅ"}
                    value={cardExpiry}
                    onChangeText={setCardExpiry}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                  <TextInput
                    style={[styles.checkoutInput, { flex: 1 }]}
                    placeholder={t('cardCVC') || "CVC"}
                    value={cardCVC}
                    onChangeText={setCardCVC}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>
            )}
            {payment === 'mobilepay' && (
              <View style={{ marginTop: 18 }}>
                <TextInput
                  style={styles.checkoutInput}
                  placeholder={t('phone') || "Telefonnummer"}
                  value={mobilePayPhone}
                  onChangeText={setMobilePayPhone}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
            )}
          </CollapsibleSection>
        </View>

        {/* Tip Section */}
        <View style={styles.checkoutCard}>
          <CollapsibleSection
            title={t('tipTitle') || "Would you like to leave a tip?"}
            initiallyOpen={true}
          >
            <>
              <View style={styles.tipButtonRow}>
                {[5, 10, 15].map(percent => (
                  <TouchableOpacity
                    key={percent}
                    style={[
                      styles.tipButton,
                      tipPercent === percent && styles.tipButtonActive,
                    ]}
                    onPress={() => {
                      if (tipPercent === percent) {
                        setTipPercent(null);
                      } else {
                        setTipPercent(percent);
                        setShowCustomTip(false);
                        setCustomTip('');
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.tipButtonText,
                      tipPercent === percent && styles.tipButtonTextActive,
                    ]}>
                      {percent}%
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.tipButton,
                    showCustomTip && styles.tipButtonActive,
                  ]}
                  onPress={() => {
                    if (showCustomTip) {
                      setShowCustomTip(false);
                      setCustomTip('');
                    } else {
                      setShowCustomTip(true);
                      setTipPercent(null);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.tipButtonText,
                    showCustomTip && styles.tipButtonTextActive,
                  ]}>
                    {t('custom') || "Custom"}
                  </Text>
                </TouchableOpacity>
              </View>
              {showCustomTip && (
                <View style={styles.tipCustomRow}>
                  <TextInput
                    style={[styles.checkoutInput, { flex: 1, minWidth: 80 }]}
                    placeholder={t('enterTip') || "Enter tip (kr)"}
                    value={customTip}
                    onChangeText={text => {
                      if (/^\d*$/.test(text)) setCustomTip(text);
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setCustomTip('');
                      setShowCustomTip(false);
                    }}
                    style={styles.tipCustomClose}
                  >
                    <Ionicons name="close" size={22} color="#2cb673" />
                  </TouchableOpacity>
                </View>
              )}
              {(tipPercent !== null || (customTip && Number(customTip) > 0)) && (
                <View style={styles.tipSummaryRow}>
                  <Text style={styles.tipSummaryText}>
                    {t('tipAmount') || "Tip"}: {tipPercent !== null
                      ? Math.round((total * tipPercent) / 100)
                      : Math.max(0, Math.round(Number(customTip)))
                    } kr
                  </Text>
                </View>
              )}
            </>
          </CollapsibleSection>
        </View>

        <View style={styles.checkoutCard}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 12,
            }}
            onPress={() => setOrderSummaryOpen(open => !open)}
            activeOpacity={0.85}
          >
            <Text style={styles.orderSummaryLabel}>
              {t('orderSummaryTitle') || "Review your order"}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.orderSummaryTotal}>
                {orderSummaryOpen ? `${totalWithDelivery} kr` : `${totalWithDelivery} kr`}
              </Text>
              <FontAwesome name={orderSummaryOpen ? "chevron-down" : "chevron-right"} size={18} color="#888" />
            </View>
          </TouchableOpacity>
          {orderSummaryOpen && (
            <View style={{ marginTop: 8 }}>
              {basket.length === 0 ? (
                <Text style={styles.checkoutEmptyText}>{t('basketEmpty')}</Text>
              ) : (
                basket.map((item: any) => (
                  <View key={item.id} style={styles.checkoutItemRow}>
                    <View style={styles.basketRowTop}>
                      <Text style={styles.checkoutItemName}>
                        {item.name}
                      </Text>
                      <Text style={styles.checkoutItemPrice}>
                        {item.price * (item.quantity || 1)} kr
                      </Text>
                    </View>
                    <View style={styles.basketRowControls}>
                      <TouchableOpacity
                        style={styles.basketControlButton}
                        onPress={() => handleDecrease(item.id)}
                      >
                        <Text style={styles.basketControlButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.basketQuantityText}>{item.quantity || 1}</Text>
                      <TouchableOpacity
                        style={styles.basketControlButton}
                        onPress={() => handleIncrease(item.id)}
                      >
                        <Text style={styles.basketControlButtonText}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.basketRemoveButton}
                        onPress={() =>
                          Alert.alert(
                            t('removeItem') || 'Fjern vare',
                            t('removeItemConfirm') || 'Vil du fjerne denne vare fra kurven?',
                            [
                              { text: t('cancel') || 'Annuller', style: 'cancel' },
                              { text: t('remove') || 'Fjern', style: 'destructive', onPress: () => handleRemove(item.id) }
                            ]
                          )
                        }
                      >
                        <Text style={styles.basketRemoveButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {notes[item.id] && (
                      <Text style={styles.basketModalNotePreview}>
                        {t('note')}: {notes[item.id]}
                      </Text>
                    )}
                  </View>
                ))
              )}
              <View style={styles.checkoutTotalRow}>
                <Text style={styles.checkoutTotalLabel}>{t('total')}:</Text>
                <Text style={styles.checkoutTotalValue}>{total} kr</Text>
              </View>
              {(tipPercent !== null || (customTip && Number(customTip) > 0)) && (
                <View style={styles.checkoutTotalRow}>
                  <Text style={styles.checkoutTotalLabel}>{t('tipAmount') || "Tip"}:</Text>
                  <Text style={styles.checkoutTotalValue}>{tipAmount} kr</Text>
                </View>
              )}
              {deliveryType === 'delivery' && (
                <View style={styles.checkoutTotalRow}>
                  <Text style={styles.checkoutTotalLabel}>{t('deliveryFee') || "Delivery fee"}:</Text>
                  <Text style={styles.checkoutTotalValue}>
                    {deliveryFee === 0
                      ? (t('freeDelivery') || 'Free')
                      : `${deliveryFee} kr`}
                  </Text>
                </View>
              )}
              <View style={styles.checkoutTotalRow}>
                <Text style={styles.checkoutTotalLabel}>{t('toPay') || "At betale"}:</Text>
                <Text style={styles.checkoutTotalValue}>{totalWithDelivery} kr</Text>
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.checkoutConfirmButton,
            !canSubmit && { opacity: 0.6 }
          ]}
          onPress={handleConfirm}
        >
          <Text style={styles.checkoutConfirmButtonText}>
            {t('confirmAndPay') || "Bekræft og betal"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}