// --- API Endpoint Configuration ---
const API_ENDPOINTS = {
    patients: [
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients2',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients3',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients4',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients5',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients6',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients7',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients8',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients9',
        'https://6852ef850594059b23cfaa4f.mockapi.io/patients10'
    ],
    schedules: [
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules2',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules3',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules4',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules5',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules6',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules7',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules8',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules9',
        'https://6852ef850594059b23cfaa4f.mockapi.io/schedules10'
    ],
    // weekly_schedule is no longer needed in the new architecture
};

const ApiManager = (resourceType) => {
    const endpoints = API_ENDPOINTS[resourceType];
    if (!endpoints) {
        throw new Error(`未知的資源類型: ${resourceType}`);
    }

    // Helper function to add a small delay
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const fetchAll = async (query = '') => {
        const allData = [];
        for (let i = 0; i < endpoints.length; i++) {
            const url = endpoints[i];
            try {
                const response = await fetch(`${url}${query}`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        const dataWithSource = data.map(item => ({
                            ...item,
                            _sourceEndpoint: url
                        }));
                        allData.push(...dataWithSource);
                    }
                } else if (response.status !== 404) {
                    console.warn(`讀取端點 ${url} 時伺服器錯誤: ${response.status}`);
                }
                // If status is 404, we just get nothing, which is fine.
            } catch (error) {
                console.error(`讀取端點 ${url} 失敗:`, error);
            }
            // Add a small delay between requests to avoid rate limiting
            await delay(50); 
        }
        return allData;
    };

    const save = async (data) => {
        const counts = [];
        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                const d = res.ok ? await res.json() : [];
                counts.push(d.length);
            } catch (e) {
                counts.push(100); // Assume full on error
            }
            await delay(50);
        }

        let targetEndpoint = null;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] < 100) {
                targetEndpoint = endpoints[i];
                break;
            }
        }
        
        if (!targetEndpoint) {
            const allData = await fetchAll();
            const deletedItems = allData.filter(p => p.isDeleted === true || p.status === 'deleted'); // Generalize for patients and other types
            
            if (deletedItems.length > 0) {
                if (!confirm("所有儲存空間已滿！將覆蓋一筆最舊的【已刪除項目】來儲存新資料。是否繼續？")) {
                    throw new Error("操作已取消：儲存空間已滿。");
                }
                const oldestRecord = deletedItems.reduce((oldest, current) => 
                    new Date(oldest.deletedAt || oldest.createdAt) < new Date(current.deletedAt || current.createdAt) ? oldest : current
                );
                await remove(oldestRecord.id, oldestRecord._sourceEndpoint);
                targetEndpoint = oldestRecord._sourceEndpoint;
            } else {
                alert("警告：所有儲存空間已滿，且沒有可覆蓋的【已刪除項目】！請手動清理空間或聯繫管理員。");
                throw new Error("儲存失敗：空間已滿且無可覆蓋項目。");
            }
        }

        const response = await fetch(targetEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`儲存失敗: ${await response.text()}`);
        return response.json();
    };

    const update = async (id, data) => {
        if (!data._sourceEndpoint) {
            const allData = await fetchAll();
            const item = allData.find(d => d.id === id);
            if (!item) throw new Error("更新失敗：找不到資料來源。");
            data._sourceEndpoint = item._sourceEndpoint;
        }
        const url = `${data._sourceEndpoint}/${id}`;
        const cleanData = { ...data };
        delete cleanData._sourceEndpoint;
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanData),
        });
        if (!response.ok) throw new Error(`更新失敗: ${await response.text()}`);
        return response.json();
    };

    const remove = async (id, sourceEndpoint) => {
         if (!sourceEndpoint) throw new Error("缺少資料來源資訊，無法刪除。");
         const url = `${sourceEndpoint}/${id}`;
         const response = await fetch(url, { method: 'DELETE' });
         if (!response.ok) throw new Error('刪除失敗');
         return response.json();
    };

    return { fetchAll, save, update, remove };
};
