import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Sidebar } from '../../components/Sidebar';
import { SidebarButtonWithLogo } from '../../components/SidebarButton';
import { API_ENDPOINT } from '../../constants/API';
import translations from '../../constants/locales';
import { useSidebar } from '../../hooks/useSidebar';
import { styles as appStyles, colors } from '../../styles';

// Helper to calculate delivery fee
function calculateDeliveryFee(order: any) {
  if (!order) return null;
  const itemsTotal = Array.isArray(order.items)
    ? order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    : 0;
  const tip = typeof order.tip_amount === 'number' ? order.tip_amount : 0;
  const total = typeof order.total_amount === 'number' ? order.total_amount : 0;
  const deliveryFee = total - itemsTotal - tip;
  return deliveryFee >= 0 ? deliveryFee : 0;
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const router = useRouter();

  // Sidebar state
  const { sidebarVisible, toggleSidebar, closeSidebar } = useSidebar();

  // For translation, you can set language dynamically if needed
  const language = 'da'; // or 'en', or from context/state
  const t = translations[language];

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('auth_token');
      const url = `${API_ENDPOINT}/orders/?customer_id=3`;
      const fetchOptions: RequestInit = {
        headers: {
          accept: 'application/json',
        },
      };

      console.log('Fetching orders with:', { url, fetchOptions });

      try {
        const res = await fetch(url, fetchOptions);
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        console.log('Server returned:', { status: res.status, data });

        // If the response is { orders: [...] }, extract orders
        let ordersArr: any[] = [];
        if (data && typeof data === 'object' && Array.isArray(data.orders)) {
          ordersArr = data.orders;
        } else if (Array.isArray(data)) {
          ordersArr = data;
        }
        // Sort by created_at descending (newest first)
        ordersArr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(ordersArr);
      } catch (e: any) {
        setError(e.message || 'Unknown error');
      }
      setLoading(false);
    }
    fetchOrders();
  }, []);


const handleOrderPress = (order: any) => {
  console.log('Opening order from orders.tsx:', order);
  if (['pending', 'ready'].includes(order.status)) {
    router.push({
      pathname: '/tracking',
      params: { order: JSON.stringify(order) },
    });
  } else {
    setSelectedOrder(order);
  }
};

  // Make the ScrollView take the full height minus header/sidebar
  const windowHeight = Dimensions.get('window').height;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Sidebar isVisible={sidebarVisible} onClose={closeSidebar} language={language} />
      <SidebarButtonWithLogo onPress={toggleSidebar} />
      <View style={[appStyles.container, { flex: 1, backgroundColor: colors.background }]}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2cb673" />
            <Text style={{ marginTop: 16 }}>{t.loading || "Loading orders..."}</Text>
          </View>
        ) : error ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: 'red' }}>{t.error}: {error}</Text>
          </View>
        ) : !orders.length ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>{t.noOrdersFound || "No orders found."}</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
            showsVerticalScrollIndicator={true}
          >
            {orders.map((order) => (
              <TouchableOpacity
                key={order.id}
                onPress={() => handleOrderPress(order)}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#b1e2c6',
                }}
              >
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                  {t.order} #{order.id}
                </Text>
                <Text>
                  {t.restaurant}: {order.partner_id ? `#${order.partner_id}` : 'N/A'}
                </Text>
                <Text>
                  {t.ordered}: {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {/* Modal for order details */}
        <Modal
          visible={!!selectedOrder}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={appStyles.ordersModalOverlay}>
            <View style={appStyles.ordersModalWrapper}>
              {/* Pinned order number at the top */}
              <View style={appStyles.ordersModalPinnedHeader}>
                <Text style={appStyles.ordersModalPinnedOrderNumber}>
                  {t.order} #{selectedOrder?.id}
                </Text>
              </View>
              <ScrollView
                style={{ maxHeight: 340, minWidth: 260 }}
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator={true}
              >
                <View style={appStyles.ordersModalSection}>
                  <Text style={appStyles.ordersModalSectionTitle}>{t.restaurant}</Text>
                  <Text>
                    {selectedOrder?.partner_id ? `#${selectedOrder.partner_id}` : 'N/A'}
                  </Text>
                </View>
                <View style={appStyles.ordersModalSection}>
                  <Text style={appStyles.ordersModalSectionTitle}>{t.ordered || "Ordered"}</Text>
                  <Text>
                    {selectedOrder?.created_at ? new Date(selectedOrder.created_at).toLocaleString() : 'N/A'}
                  </Text>
                </View>
                <View style={appStyles.ordersModalSection}>
                  <Text style={appStyles.ordersModalSectionTitle}>{t.status || "Status"}</Text>
                  <Text>{selectedOrder?.status || 'N/A'}</Text>
                </View>
                <View style={appStyles.ordersModalSection}>
                  <Text style={appStyles.ordersModalSectionTitle}>{t.deliveryType || "Delivery type"}</Text>
                  <Text>{selectedOrder?.delivery_type || 'N/A'}</Text>
                </View>
                <View style={appStyles.ordersModalSection}>
                  <Text style={appStyles.ordersModalSectionTitle}>{t.paymentMethod || "Payment"}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {selectedOrder?.payment?.method === 'mobile_pay' && (
                      <>
                        <MaterialCommunityIcons name="cellphone" size={18} color={colors.primary} />
                        <Text style={{ fontWeight: 'bold' }}>{t.mobilePay || "MobilePay"}</Text>
                      </>
                    )}
                    {selectedOrder?.payment?.method === 'credit_card' && (
                      <>
                        <FontAwesome5 name="credit-card" size={18} color={colors.primary} />
                        <Text style={{ fontWeight: 'bold' }}>{t.paymentCard || "Credit Card"}</Text>
                      </>
                    )}
                    {!['mobile_pay', 'credit_card'].includes(selectedOrder?.payment?.method) && (
                      <Text>{selectedOrder?.payment?.method || 'N/A'}</Text>
                    )}
                  </View>
                  <Text>
                    {t.status || "Status"}: {selectedOrder?.payment?.status || 'N/A'}
                  </Text>
                </View>
                <View style={appStyles.ordersModalSection}>
                  <Text style={appStyles.ordersModalSectionTitle}>{t.total || "Total paid"}</Text>
                  <Text>
                    {typeof selectedOrder?.total_amount === 'number'
                      ? `${selectedOrder.total_amount} kr.`
                      : 'N/A'}
                  </Text>
                  <Text>
                    {t.deliveryFee || "Delivery fee"}: {(() => {
                      const fee = calculateDeliveryFee(selectedOrder);
                      return typeof fee === 'number' ? `${fee} kr.` : 'N/A';
                    })()}
                  </Text>
                  <Text style={{ marginTop: 4 }}>
                    {t.tipAmount || "Tip"}: {selectedOrder?.tip_amount ? `${selectedOrder.tip_amount} kr.` : t.noTip || 'No tip'}
                  </Text>
                </View>
                <View style={appStyles.ordersModalSection}>
                  <Text style={appStyles.ordersModalSectionTitle}>{t.itemsOrdered || "Items Ordered"}</Text>
                  {Array.isArray(selectedOrder?.items) && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item: any, idx: number) => (
                      <View key={idx} style={{ marginBottom: 8, marginLeft: 4 }}>
                        <Text style={{ fontWeight: 'bold', color: colors.primary }}>
                          {item.quantity} x {item.name}
                        </Text>
                        <Text style={{ color: colors.text, fontSize: 15 }}>
                          á {item.price} kr.
                        </Text>
                        {item.note ? (
                          <Text style={{ fontSize: 13, color: colors.grey, fontStyle: 'italic' }}>
                            {t.note || "Note"}: {item.note}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text>{t.noItemsFound || "No items found."}</Text>
                  )}
                </View>
              </ScrollView>
              <Pressable
                onPress={() => setSelectedOrder(null)}
                style={appStyles.ordersModalClose}
              >
                <Text style={appStyles.ordersModalCloseText}>{t.close}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}