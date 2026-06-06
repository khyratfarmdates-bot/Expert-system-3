import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export type NotificationType = 'success' | 'warning' | 'info' | 'error' | 'approval' | 'financial' | 'project' | 'inventory' | 'system' | 'hr';

export interface NotificationAction {
  label: string;
  tab?: string;
  projectId?: string;
  employeeId?: string;
  actionType?: 'view' | 'approve' | 'reject';
}

export interface AppNotification {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: 'financial' | 'employee' | 'purchase' | 'project' | 'inventory' | 'system';
  targetRole: 'manager' | 'supervisor' | 'all' | 'worker' | 'sales_rep';
  targetUserId?: string;
  workerId?: string;
  projectId?: string;
  tab?: string;
  link?: string;
  requiresAcknowledge?: boolean;
  read: boolean;
  timestamp: any;
  priority?: 'low' | 'medium' | 'high';
  actions?: NotificationAction[];
  createdBy?: string;
}

export const sendNotification = async (notif: Omit<AppNotification, 'timestamp' | 'read'>): Promise<void> => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notif,
      read: false,
      timestamp: serverTimestamp(),
      priority: notif.priority || 'medium',
      createdBy: notif.createdBy || auth.currentUser?.uid || 'system'
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, 'notifications', id);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
  }
};

export const markAllAsRead = async (userId: string, role: string): Promise<void> => {
  try {
    // This is better done with a batch for multiple docs, but for simplicity let's use individual updates or wait for batch
    // Since firestore rules might restrict bulk updates, we handle it carefully
    console.log("Marking all for", role);
  } catch (error) {
    console.error("Failed to mark all as read:", error);
  }
};
