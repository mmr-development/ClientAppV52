import { FontAwesome, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { SidebarButtonWithLogo } from '../../components/SidebarButton';
import { API_ENDPOINT } from '../../constants/API';
import translations from '../../constants/locales';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSidebar } from '../../hooks/useSidebar';
import { styles } from '../../styles';

export default function TrackingScreen() {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const { sidebarVisible, toggleSidebar, closeSidebar } = useSidebar();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Language context
  const { language } = useLanguage();
  const t = (key: keyof typeof translations["da"]) =>
    (translations[language] as typeof translations["da"])[key] || key;

  // Fetch order from API
  const fetchOrderFromApi = async (isInitial = false) => {
    if (fallbackUsed || isInitial || initialLoad) setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await fetch(`${API_ENDPOINT}/orders/?limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t('errorMsg'));
      let apiOrder = null;
      if (Array.isArray(data) && data.length > 0) {
        apiOrder = data[0];
      } else if (Array.isArray(data.orders) && data.orders.length > 0) {
        apiOrder = data.orders[0];
      } else if (Array.isArray(data.results) && data.results.length > 0) {
        apiOrder = data.results[0];
      }
      if (apiOrder) {
        setOrder(apiOrder);
        setFallbackUsed(false);
      } else {
        throw new Error(t('noOrdersFound'));
      }
    } catch (e: any) {
      const fallback = await AsyncStorage.getItem('last_order_fallback');
      if (fallback) {
        setOrder(JSON.parse(fallback));
        setFallbackUsed(true);
      } else {
        setError(e?.message || t('errorMsg'));
      }
    }
    setLoading(false);
    setInitialLoad(false);
  };

  useEffect(() => {
    let fallbackLoaded = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchOrderFromApi(true);
        fallbackLoaded = false;
      } catch {
        fallbackLoaded = true;
      }
      setLoading(false);
      setInitialLoad(false);
    })();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
 //refetch 
  useFocusEffect(
    React.useCallback(() => {
      fetchOrderFromApi(true);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [])
  );

  // Polling logic
  useEffect(() => {
    if (fallbackUsed) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        fetchOrderFromApi();
      }, 30000);
    } else if (order) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        fetchOrderFromApi();
      }, 60000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackUsed, order?.id]);

  // Progress bar step mapping and icons
  const statusStep = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 1;
      case 'preparing':
        return 2;
      case 'ready':
      case 'dispatched':
        return 3;
      case 'delivered':
      case 'cancelled':
      case 'failed':
        return 4;
      default:
        return 1;
    }
  };

  const progressSteps = [
    {
      label: 'Order placed',
      icon: (active: boolean) => (
        <MaterialIcons name="shopping-cart" size={28} color={active ? '#2cb673' : '#b1e2c6'} />
      ),
    },
    {
      label: 'Preparing',
      icon: (active: boolean) => (
        <MaterialCommunityIcons name="chef-hat" size={28} color={active ? '#2cb673' : '#b1e2c6'} />
      ),
    },
    {
      label: 'On the way',
      icon: (active: boolean) => (
        <MaterialIcons name="delivery-dining" size={28} color={active ? '#2cb673' : '#b1e2c6'} />
      ),
    },
  {
    label: 'Completed',
    icon: (active: boolean, status: string) => {
      if (status === 'delivered')
        return <MaterialCommunityIcons name="home" size={28} color="#2cb673" />;
      if (status === 'cancelled' || status === 'failed')
        return <MaterialIcons name="cancel" size={28} color="#e53935" />;
      return <FontAwesome name="question-circle" size={28} color="#b1e2c6" />;
    },
  },
];

  const currentStep = statusStep(order?.status);

  // Progress bar component
  const OrderProgressBar = ({ step, status }: { step: number; status: string }) => (
    <View style={styles.progressBarContainer}>
      {progressSteps.map((s, idx) => {
        const isActive = step > idx;
        const isLast = idx === progressSteps.length - 1;
        return (
          <React.Fragment key={idx}>
            <View style={styles.progressStep}>
              {s.icon(isActive, status)}
              <Text style={[styles.progressStepLabel, isActive && styles.progressStepLabelActive]}>
                {s.label}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.progressBarLine,
                  isActive && styles.progressBarLineActive,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  if (loading && (initialLoad || fallbackUsed)) {
    return (
      <>
        <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
        <SidebarButtonWithLogo onPress={toggleSidebar} />
        <View style={styles.container}>
          <View style={styles.orderDetailsWrapper}>
            <ActivityIndicator size="large" color={styles.restaurantName.color || "#2cb673"} />
            <Text style={[styles.label, { marginTop: 18 }]}>{t('loading')}</Text>
          </View>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
        <SidebarButtonWithLogo onPress={toggleSidebar} />
        <View style={styles.container}>
          <View style={styles.orderDetailsWrapper}>
            <Text style={{ color: '#e53935', fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>{error}</Text>
          </View>
        </View>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
        <SidebarButtonWithLogo onPress={toggleSidebar} />
        <View style={styles.container}>
          <View style={styles.orderDetailsWrapper}>
            <Text style={[styles.label, { textAlign: 'center' }]}>{t('noOrdersFound')}</Text>
          </View>
        </View>
      </>
    );
  }

  // Helper for fee/tip line
  const renderFeeLine = (label: string, value: number | string, isFree?: boolean) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
      <Text style={{ color: styles.restaurantName.color }}>{label}</Text>
      <Text style={{ color: styles.restaurantAddress.color, fontWeight: isFree ? 'bold' : 'normal' }}>
        {isFree ? value : `${value} kr`}
      </Text>
    </View>
  );

  return (
    <>
      <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
      <SidebarButtonWithLogo onPress={toggleSidebar} />
      <View style={styles.container}>
        {/* Map container placeholder */}
        <View
          style={{
            width: '100%',
            height: 180,
            backgroundColor: '#e0e0e0',
            borderRadius: 16,
            marginBottom: 18,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#b1e2c6',
          }}
        >
          <Text style={{ color: '#888', fontWeight: 'bold' }}>
            {t('mapComingSoon') || 'Map will appear here soon'}
          </Text>
        </View>
        {/* Progress bar below map */}
        <OrderProgressBar step={currentStep} status={order.status} />
        <ScrollView contentContainerStyle={{ padding: 0 }}>
          <View style={styles.orderDetailsWrapper}>
            <Text style={styles.orderDetailsTitle}>
              {order.id ? `${t('order')} #${order.id}` : t('order')}
            </Text>
            <View style={styles.orderDetailsSection}>
              <Text style={styles.orderDetailsSectionTitle}>{t('status')}</Text>
              <Text style={{ color: order.status === 'cancelled' ? '#e53935' : styles.restaurantName.color, fontWeight: 'bold', fontSize: 16 }}>
                {order.status || t('unknown')}
              </Text>
            </View>
            <View style={styles.orderDetailsSection}>
              <Text style={styles.orderDetailsSectionTitle}>{t('ordered')}</Text>
              <Text>{order.created_at}</Text>
            </View>
            <View style={styles.orderDetailsSection}>
              <Text style={styles.orderDetailsSectionTitle}>{t('deliveryAddressTitle')}</Text>
              <Text>
                {order.customer?.address?.street} {order.customer?.address?.postal_code} {order.customer?.address?.city}
              </Text>
            </View>
            <View style={styles.orderDetailsSection}>
              <Text style={styles.orderDetailsSectionTitle}>{t('itemsOrdered')}</Text>
              {order.items && order.items.length > 0 ? (
                <>
                  {order.items.map((item: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontWeight: 'bold', color: styles.restaurantName.color }}>{item.name}</Text>
                      <Text style={{ color: styles.restaurantAddress.color }}>{item.quantity} x {item.price} kr</Text>
                    </View>
                  ))}
                  {order.tip_amount ? renderFeeLine(t('tipAmount'), order.tip_amount) : null}
                  {typeof order.delivery_fee !== 'undefined' && (
                    renderFeeLine(
                      t('deliveryFee'),
                      order.delivery_fee === 0
                        ? (t('freeDelivery') || 'FREE!')
                        : order.delivery_fee,
                      order.delivery_fee === 0
                    )
                  )}
                  <View style={{ borderBottomWidth: 1, borderColor: '#b1e2c6', marginVertical: 8 }} />
                  <View style={{ borderBottomWidth: 2, borderColor: '#2cb673', marginBottom: 2 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: styles.restaurantName.color }}>{t('total')}</Text>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: styles.restaurantName.color }}>{order.total_amount} kr</Text>
                  </View>
                </>
              ) : (
                <Text>{t('noItemsFound')}</Text>
              )}
            </View>
            {fallbackUsed && (
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: '#FFA500', fontWeight: 'bold' }}>
                  {t('showingFallbackOrder') || 'Showing fallback order info (API unavailable)'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}