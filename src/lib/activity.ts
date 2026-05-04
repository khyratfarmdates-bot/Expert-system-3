import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type ActivityCategory = 'financial' | 'employee' | 'purchase' | 'system';
export type TargetRole = 'all' | 'manager' | 'employee';

export const logActivity = async (
  title: string,
  message: string,
  type: NotificationType,
  category: ActivityCategory,
  createdBy: string,
  targetRole: TargetRole = 'manager'
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      title,
      message,
      type,
      category,
      targetRole,
      createdBy,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
