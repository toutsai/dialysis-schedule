// api_manager.js - 修正版
(function() {
    // 防止重複定義
    if (window.ApiManager) {
        return;
    }

    const ApiManager = (resourceType) => {
        // 從 index.html 建立的全域變數中取得 db 實例
        const db = window.db;
        if (!db) {
            throw new Error("Firestore is not initialized! Check index.html.");
        }

        // 檢查 Firebase Firestore 方法是否可用
        const {
            collection,
            getDocs,
            addDoc,
            updateDoc,
            deleteDoc,
            doc,
            query,
            where
        } = window.firebase || window.parent.firebase;

        if (!collection) {
            throw new Error("Firebase Firestore methods are not available!");
        }

        // 建立指向特定集合的參照
        const collectionRef = collection(db, resourceType);

        /**
         * 從集合中獲取所有文件
         * @param {Array} queryConstraints - Firestore 查詢條件陣列
         */
        const fetchAll = async (queryConstraints = []) => {
            try {
                const q = queryConstraints.length > 0 
                    ? query(collectionRef, ...queryConstraints)
                    : collectionRef;
                    
                const querySnapshot = await getDocs(q);
                const allData = [];
                querySnapshot.forEach((docSnapshot) => {
                    allData.push({ id: docSnapshot.id, ...docSnapshot.data() });
                });
                return allData;
            } catch (error) {
                console.error(`Error fetching ${resourceType}:`, error);
                throw error;
            }
        };

        /**
         * 在集合中儲存一個新文件
         * @param {Object} data - 要儲存的資料物件
         */
        const save = async (data) => {
            try {
                const docRef = await addDoc(collectionRef, data);
                return { id: docRef.id, ...data };
            } catch (error) {
                console.error(`Error saving ${resourceType}:`, error);
                throw error;
            }
        };

        /**
         * 更新一個已存在的文件
         * @param {string} id - 要更新的文件的 ID
         * @param {Object} data - 要更新的資料欄位
         */
        const update = async (id, data) => {
            try {
                const docRef = doc(db, resourceType, id);
                await updateDoc(docRef, data);
                return { id, ...data };
            } catch (error) {
                console.error(`Error updating ${resourceType}:`, error);
                throw error;
            }
        };

        /**
         * 刪除一個文件
         * @param {string} id - 要刪除的文件的 ID
         */
        const deleteDocument = async (id) => {
            try {
                const docRef = doc(db, resourceType, id);
                await deleteDoc(docRef);
                return { id };
            } catch (error) {
                console.error(`Error deleting ${resourceType}:`, error);
                throw error;
            }
        };

        // 回傳 API 操作函式（注意這裡用 delete 而不是 remove）
        return { 
            fetchAll, 
            save, 
            update, 
            delete: deleteDocument  // 這樣 HTML 中就可以使用 .delete() 方法
        };
    };

    // 將 ApiManager 設定為全域變數
    window.ApiManager = ApiManager;
})();