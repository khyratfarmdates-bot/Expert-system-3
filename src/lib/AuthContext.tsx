import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from './firestore-errors';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'manager' | 'supervisor' | 'employee' | 'worker';
  department?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user && user.email) {
        try {
          const userEmail = user.email.toLowerCase();
          
          // 1. Primary check by UID (Faster and more secure)
          const qUid = query(collection(db, 'users'), where('uid', '==', user.uid));
          let snapUid;
          try {
            snapUid = await getDocs(qUid);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'users', auth);
            setLoading(false);
            return;
          }
          
          if (!snapUid.empty) {
            const userData = snapUid.docs[0].data() as UserProfile;
            setProfile({ ...userData, uid: user.uid });
            setUser(user);
          } else {
            // 2. Secondary check by Email (For first time login of pre-added employees)
            const qEmail = query(collection(db, 'users'), where('email', '==', userEmail));
            let snapEmail;
            try {
              snapEmail = await getDocs(qEmail);
            } catch (error) {
              handleFirestoreError(error, OperationType.GET, 'users', auth);
              setLoading(false);
              return;
            }

            if (!snapEmail.empty) {
              const userDoc = snapEmail.docs[0];
              const userData = userDoc.data() as UserProfile;
              
              // Map UID and update record
              try {
                await updateDoc(doc(db, 'users', userDoc.id), { uid: user.uid });
                console.log("Linked UID to profile");
              } catch (linkErr) {
                console.warn("Could not auto-link UID (rules?), using profile as-is", linkErr);
              }
              setProfile({ ...userData, uid: user.uid });
              setUser(user);
            } else {
              // 3. Fallback for Admin
              if (userEmail === 'amanrental2020@gmail.com' || userEmail === 'khyratfarmdates@gmail.com') {
                const adminProfile: UserProfile = {
                  uid: user.uid,
                  name: user.displayName || 'المدير العام',
                  email: userEmail,
                  role: 'manager',
                };
                setProfile(adminProfile);
                setUser(user);
              } else {
                // 4. DENY ACCESS: Not found in DB and not Admin
                await signOut(auth);
                setUser(null);
                setProfile(null);
                toast.error('عذراً، هذا البريد الإلكتروني غير مسجل في النظام. يرجى مراجعة الإدارة لإضافتك كموظف أولاً.');
              }
            }
          }
        } catch (error) {
          console.error("Auth System Error:", error);
          // If we already handled it, don't repeat
          if (!(error instanceof Error && error.message.startsWith('{'))) {
            await signOut(auth);
            setUser(null);
            setProfile(null);
            toast.error('حدث خطأ أثناء التحقق من صلاحيات الدخول.');
          }
        }
      } else if (user && !user.email) {
          await signOut(auth);
          toast.error('يجب توفر بريد إلكتروني للدخول');
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
