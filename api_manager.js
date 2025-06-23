// 在 api_manager.js 的最頂部加入這段程式碼
const {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where
} = window.firebase.firestore;
// 加入到這裡結束

// 你原有的 ApiManager 函式保持不變
const ApiManager = (resourceType) => {
    // ...
};

const ApiManager = (resourceType) => {
    // 從 index.html 建立的全域變數中取得 db 實例
    const db = window.db;
    if (!db) {
        throw new Error("Firestore is not initialized! Check index.html.");
    }

    // 建立指向特定集合的參照
    const collectionRef = collection(db, resourceType);

    /**
     * 從集合中獲取所有文件
     * @param {Array} queryConstraints - Firestore 查詢條件陣列，例如 [where("status", "==", "opd")]
     */
    const fetchAll = async (queryConstraints = []) => {
        const q = query(collectionRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);
        const allData = [];
        querySnapshot.forEach((doc) => {
            // 將文件 ID 和資料合併，這非常重要！
            // 這樣我們才知道要更新或刪除哪個文件。
            allData.push({ id: doc.id, ...doc.data() });
        });
        return allData;
    };

    /**
     * 在集合中儲存一個新文件
     * @param {Object} data - 要儲存的資料物件
     */
    const save = async (data) => {
        // Firestore 會自動產生獨一無二的 ID
        const docRef = await addDoc(collectionRef, data);
        // 回傳包含新 ID 的完整資料
        return { id: docRef.id, ...data };
    };

    /**
     * 更新一個已存在的文件
     * @param {string} id - 要更新的文件的 ID
     * @param {Object} data - 要更新的資料欄位
     */
    const update = async (id, data) => {
        // 建立指向特定文件的參照
        const docRef = doc(db, resourceType, id);
        // 更新文件
        await updateDoc(docRef, data);
        return { id, ...data };
    };

    /**
     * 刪除一個文件
     * @param {string} id - 要刪除的文件的 ID
     */
    const remove = async (id) => {
        const docRef = doc(db, resourceType, id);
        await deleteDoc(docRef);
        // 回傳被刪除的 ID 以供確認
        return { id };
    };

    // 回傳一組新的 API 操作函式
    return { fetchAll, save, update, remove };
};