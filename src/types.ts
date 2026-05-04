// Common interfaces for the application
export type UserRole = 'manager' | 'supervisor' | 'employee' | 'worker';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  dept?: string;
  photoURL?: string;
  salary?: number;
  iqamaNumber?: string;
  iqamaExpiry?: string;
  phone?: string;
  nationality?: string;
  joinedAt?: string;
}

export interface ProjectMilestone {
  title: string;
  description?: string;
  weight?: number; // Weight percentage for progress calculation
  status: 'pending' | 'in-progress' | 'completed' | 'review-requested';
  date: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  content: string;
  authorId: string;
  authorName: string;
  type: 'general' | 'incident' | 'progress' | 'photo';
  mediaUrls?: string[];
  createdAt: string;
}

export interface PaymentInstallment {
  id: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  description?: string;
  paidAt?: string;
}

export interface Project {
  id: string;
  title: string;
  name?: string; // Compatibility
  description?: string;
  status: 'active' | 'completed' | 'on-hold' | 'in-progress';
  locationLink?: string;
  locationCoords?: { lat: number, lng: number };
  clientName?: string;
  clientPhone?: string;
  startDate?: string;
  endDate?: string;
  deliveryDate?: string;
  budget?: number;
  depositAmount?: number;
  depositStatus?: 'pending' | 'paid';
  photoUrls?: string[];
  videoUrls?: string[];
  workerIds?: string[];
  subcontractorIds?: string[];
  milestones?: ProjectMilestone[];
  payments?: PaymentInstallment[];
  createdAt: string;
  approvalDate?: string;
  projectType?: string;
  supervisor?: string;
  contractNumber?: string;
  engOffice?: string;
  totalArea?: string;
  projectStatus?: string;
  progress?: number;
  clientEmail?: string;
  timestamp?: any;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  content: string;
  date: string;
  createdBy: string;
  userName: string;
}

export interface Subcontractor {
  id: string;
  projectId: string;
  name: string;
  serviceType: string;
  contractAmount: number;
  paidAmount: number;
  contact: string;
  status: 'active' | 'completed';
}

export interface DailyLog {
  id: string;
  projectId: string;
  amountEarned: number;
  date: string;
  description: string;
  workerId?: string;
  workerName?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  iban?: string;
  type: 'bank' | 'cash';
  initialBalance: number;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: any; // Can be string or Timestamp
  createdBy: string;
  projectId?: string;
  attachmentURL?: string;
  status?: 'pending' | 'approved' | 'rejected';
  referenceId?: string;
  paymentMethod?: 'cash' | 'transfer';
  bankAccountId?: string;
}

export interface Attendance {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  location?: string;
  status: 'present' | 'absent' | 'leave';
}

export interface SystemSettings {
  companyName: string;
  companySub: string;
  attendanceRadius: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  allowManualAttendance: boolean;
}
