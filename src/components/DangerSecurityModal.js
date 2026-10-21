import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DangerSecurityModal({
  visible = false,
  onConfirm,
  onCancel,
}) {
  const [countdown, setCountdown] = useState(5);
  const [isChecked, setIsChecked] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setCountdown(5);
      setIsChecked(false);

      // Pulsing animation for warning icon
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
        loop.stop();
        pulseAnim.setValue(1);
      };
    }
  }, [visible]);

  const canConfirm = countdown === 0 && isChecked;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F1115" />

        {/* Scrollable modal content container */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Danger warning icon indicator */}
          <View style={styles.iconContainer}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="warning" size={56} color="#EF4444" />
            </Animated.View>
          </View>

          <Text style={styles.dangerTitle}>Danger</Text>

          {/* Introductory warning header text */}
          <Text style={styles.leadText}>
            "Mở khóa giới hạn tốc độ" là một cài đặt có độ rủi ro cực kỳ cao.
            Nếu bạn bật cài đặt này, tài khoản TikTok của bạn có thể bị hệ thống
            kiểm soát bot tự động áp dụng các hình phạt nghiêm trọng:
          </Text>

          {/* Detailed breakdown of risk factors */}
          <View style={styles.riskList}>
            <View style={styles.riskItem}>
              <View style={styles.riskIconBox}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#94A3B8" />
              </View>
              <View style={styles.riskTextCol}>
                <Text style={styles.riskItemTitle}>Bị cấm nhắn tin (sending_ban)</Text>
                <Text style={styles.riskItemDesc}>
                  TikTok sẽ tạm chặn gửi tin nhắn trên Web từ 24h đến 48h hoặc dài hơn.
                </Text>
              </View>
            </View>

            <View style={styles.riskItem}>
              <View style={styles.riskIconBox}>
                <Ionicons name="alert-circle" size={16} color="#94A3B8" />
              </View>
              <View style={styles.riskTextCol}>
                <Text style={styles.riskItemTitle}>Nguy cơ khóa tài khoản vĩnh viễn</Text>
                <Text style={styles.riskItemDesc}>
                  Gửi tin dồn dập bị thuật toán phát hiện là hành vi spam/bot tự động.
                </Text>
              </View>
            </View>

            <View style={styles.riskItem}>
              <View style={styles.riskIconBox}>
                <Ionicons name="shield-outline" size={16} color="#94A3B8" />
              </View>
              <View style={styles.riskTextCol}>
                <Text style={styles.riskItemTitle}>Miễn trừ trách nhiệm hoàn toàn</Text>
                <Text style={styles.riskItemDesc}>
                  Bạn tự nguyện chịu mọi rủi ro và hậu quả phát sinh đối với tài khoản.
                </Text>
              </View>
            </View>
          </View>

          {/* Voluntary acknowledgement checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsChecked(!isChecked)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
              {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>
              Tôi đã nhận thức rõ các rủi ro có thể xảy ra và tự nguyện chịu mọi hậu quả phát sinh.
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Fixed bottom action buttons */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.btnConfirm,
              canConfirm ? styles.btnConfirmEnabled : styles.btnConfirmDisabled,
            ]}
            onPress={() => {
              if (canConfirm && onConfirm) onConfirm();
            }}
            disabled={!canConfirm}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.btnConfirmText,
                canConfirm ? styles.btnConfirmTextEnabled : styles.btnConfirmTextDisabled,
              ]}
            >
              {countdown > 0 ? `Đồng ý (${countdown})` : 'Đồng ý'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnCancel}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.btnCancelText}>Hủy bỏ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 36 : 20,
    paddingBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  dangerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  leadText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
    textAlign: 'left',
    marginBottom: 18,
  },
  riskList: {
    width: '100%',
    marginBottom: 18,
    gap: 14,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  riskIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E232B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  riskTextCol: {
    flex: 1,
  },
  riskItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  riskItemDesc: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
  },
  bottomBar: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 14,
    backgroundColor: '#0F1115',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E232B',
    gap: 12,
  },
  btnConfirm: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmDisabled: {
    backgroundColor: '#1E232B',
  },
  btnConfirmEnabled: {
    backgroundColor: '#DC2626',
  },
  btnConfirmText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnConfirmTextDisabled: {
    color: '#64748B',
  },
  btnConfirmTextEnabled: {
    color: '#FFFFFF',
  },
  btnCancel: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
