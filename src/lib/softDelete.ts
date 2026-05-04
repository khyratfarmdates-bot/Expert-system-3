import { 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { toast } from 'sonner';

/**
 * Moves a document to a recycle_bin collection before deleting it from the original path.
 * Items in recycle_bin will have an expiresAt field set to 30 days from now.
 */
export async function softDelete(
  collectionPath: string, 
  docId: string, 
  data: any, 
  userId: string,
  entityName: string
) {
  try {
    const recycleRef = doc(db, 'recycle_bin', docId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await setDoc(recycleRef, {
      ...data,
      originalId: docId,
      originalPath: collectionPath,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      expiresAt: Timestamp.fromDate(expiresAt),
      entityDisplayName: entityName
    });

    await deleteDoc(doc(db, collectionPath, docId));
    toast.success(`تم نقل "${entityName}" إلى سلة المهملات. سيتم حذفها نهائياً بعد 30 يوم.`);
    return true;
  } catch (error) {
    console.error('Soft delete error:', error);
    toast.error('فشل في عملية الحذف المؤقت');
    return false;
  }
}

export async function restoreDocument(recycleDocId: string) {
  try {
    const recycleRef = doc(db, 'recycle_bin', recycleDocId);
    const snap = await getDoc(recycleRef);
    
    if (!snap.exists()) {
      toast.error('الوثيقة غير موجودة في سلة المهملات');
      return false;
    }

    const { originalPath, originalId, entityDisplayName, ...originalData } = snap.data();
    
    await setDoc(doc(db, originalPath, originalId), originalData);
    await deleteDoc(recycleRef);
    
    toast.success(`تمت استعادة "${entityDisplayName}" بنجاح`);
    return true;
  } catch (error) {
    console.error('Restore error:', error);
    toast.error('فشل في استعادة البيانات');
    return false;
  }
}
