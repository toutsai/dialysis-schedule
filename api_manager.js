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
    schedules: ['https://6852ef850594059b23cfaa4f.mockapi.io/schedules'],
    weekly_schedule: ['https://6852ef850594059b23cfaa4f.mockapi.io/weekly_schedule']
};

const ApiManager = (resourceType) => {
    const endpoints = API_ENDPOINTS[resourceType];
    if (!endpoints) {
        throw new Error(`未知的資源類型: ${resourceType}`);
    }

    // --- CHANGE START: More robust fetchAll logic ---
    const fetchAll = async (query = '') => {
        const requests = endpoints.map(url => 
            fetch(`${url}${query}`)
                .then(response => {
                    // If response is successful (200-299), parse it as JSON.
                    // If it's a 404, it's not a critical error, just means no data, so we treat it as an empty array.
                    if (response.ok) {
                        return response.json();
                    }
                    if (response.status === 404) {
                        return []; // Gracefully handle "Not Found" as an empty result.
                    }
                    // For other errors (like 500, 429), throw an error to be caught by the outer catch block.
                    throw new Error(`伺服器錯誤: ${response.status}`);
                })
        );

        const results = await Promise.allSettled(requests);
        let allData = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                const dataWithSource = result.value.map(item => ({
                    ...item,
                    _sourceEndpoint: endpoints[index] 
                }));
                allData = allData.concat(dataWithSource);
            } else if (result.status === 'rejected') {
                // Log errors from individual endpoints but don't stop the entire process
                console.error(`讀取端點 ${endpoints[index]} 失敗:`, result.reason);
            }
        });
        return allData;
    };
    // --- CHANGE END ---

    const save = async (data) => {
        const counts = await Promise.all(
            endpoints.map(url => fetch(url).then(res => res.ok ? res.json() : []).then(d => d.length).catch(() => 100))
        );

        let targetEndpoint = null;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] < 100) {
                targetEndpoint = endpoints[i];
                break;
            }
        }
        
        if (!targetEndpoint) {
            const allData = await fetchAll();
            const deletedPatients = allData.filter(p => p.isDeleted === true);
            
            if (deletedPatients.length > 0) {
                if (!confirm("所有儲存空間已滿！將覆蓋一筆最舊的【已刪除病人】記錄來儲存新資料。是否繼續？")) {
                    throw new Error("操作已取消：儲存空間已滿。");
                }
                const oldestDeletedRecord = deletedPatients.reduce((oldest, current) => 
                    new Date(oldest.deletedAt) < new Date(current.deletedAt) ? oldest : current
                );
                await remove(oldestDeletedRecord.id, oldestDeletedRecord._sourceEndpoint);
                targetEndpoint = oldestDeletedRecord._sourceEndpoint;
            } else {
                alert("警告：所有儲存空間已滿，且沒有可覆蓋的【已刪除病人】！請手動清理空間或聯繫管理員。");
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
