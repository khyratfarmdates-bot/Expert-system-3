import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Hook to listen to a real-time Firestore collection.
 */
export function useCollection<T>(path: string, orderField?: string, filterField?: string, filterValue?: any) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const colRef = collection(db, path);
    let q = query(colRef);

    if (filterField !== undefined && filterValue !== undefined) {
      q = query(q, where(filterField, '==', filterValue));
    }

    if (orderField) {
      q = query(q, orderBy(orderField, 'desc'));
    }

    const unsub = onSnapshot(q, 
      (snap) => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as T)));
        setLoading(false);
      },
      (err) => {
        console.error(`useCollection error for path ${path}:`, err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [path, orderField, filterField, filterValue]);

  return { data, loading };
}

/**
 * Hook to listen to a real-time Firestore document.
 */
export function useDocument<T>(path: string, id: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    const docRef = doc(db, path, id);
    const unsub = onSnapshot(docRef, 
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as T) : null);
        setLoading(false);
      },
      (err) => {
        console.error(`useDocument error for path ${path}/${id}:`, err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [path, id]);

  return { data, loading };
}

// CRUD Operations
export const createItem = async (path: string, payload: any) => {
  return await addDoc(collection(db, path), {
    ...payload,
    createdAt: serverTimestamp()
  });
};

export const updateItem = async (path: string, id: string, payload: any) => {
  return await updateDoc(doc(db, path, id), {
    ...payload,
    updatedAt: serverTimestamp()
  });
};

export const deleteItem = async (path: string, id: string) => {
  return await deleteDoc(doc(db, path, id));
};

// Role-based helper functions
export const createInvoiceGuard = async (payload: any, role: string, userId: string) => {
  if (role !== 'manager') {
    throw new Error('عذراً، فقط المدير هو من يملك صلاحية إنشاء الفواتير.');
  }
  return await createItem('invoices', {
    ...payload,
    createdBy: userId
  });
};

export const createQuoteGuard = async (payload: any, role: string, userId: string) => {
  if (role !== 'manager' && role !== 'sales_rep') {
    throw new Error('عذراً، فقط المدير ومندوب المبيعات لديهم صلاحية إنشاء العروض.');
  }
  return await createItem('quotations', {
    ...payload,
    createdBy: userId,
    status: 'pending' // Quotes need manager approval
  });
};
