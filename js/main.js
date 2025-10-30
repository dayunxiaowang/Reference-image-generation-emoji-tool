class MemeGenerator {
    constructor() {
        this.danCaiImages = [];
        this.selectedImages = [];
        this.currentAdapter = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadConfig();
        this.updateProviderConfig();
        this.updateDanCaiCount();
    }

    async loadDanCaiImages() { return; }

    async loadModelDetail(modelId) {
        try {
            const endpoint = document.getElementById('api-endpoint').value.trim().replace(/\/$/, '');
            const apiKey = document.getElementById('api-key').value.trim();
            if (!endpoint || !apiKey) return;
            const url = endpoint.endsWith('/v1') ? `${endpoint}/models` : `${endpoint}/v1/models`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
            if (!res.ok) return;
            const data = await res.json();
            const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : (Array.isArray(data?.models) ? data.models : []));
            const meta = list.find(m => (m?.id || m?.name || m) === modelId);
            if (!meta) return;

            const params = meta?.parameters || meta?.params || meta?.spec || {};
            const maxRef = params.max_ref_images || params.max_reference_images || 3;
            const sizes = params.size_options || params.sizes || [];
            const steps = params.steps || params.step_range || {};
            const guidance = params.guidance || params.guidance_range || {};

            const maxImagesInput = document.getElementById('max-images');
            if (maxImagesInput) {
                maxImagesInput.value = String(Math.min(3, Number(maxRef) || 3));
                if (this.selectedImages.length > parseInt(maxImagesInput.value)) {
                    this.selectedImages = this.selectedImages.slice(0, parseInt(maxImagesInput.value));
                    this.updateSelectionDisplay();
                }
            }

            const sizeEl = document.getElementById('image-size');
            if (sizeEl && Array.isArray(sizes) && sizes.length) {
                sizeEl.innerHTML = '<option value="">（模型默认）</option>' + sizes.map(s => `<option value="${s}">${s}</option>`).join('');
            }

            const stepsGroup = document.getElementById('steps-group');
            const guidanceGroup = document.getElementById('guidance-group');
            const stepsEl2 = document.getElementById('steps');
            const stepsVal = document.getElementById('steps-value');
            const guideEl2 = document.getElementById('guidance');
            const guideVal = document.getElementById('guidance-value');

            if (stepsEl2 && stepsGroup) {
                const minS = steps.min || 10;
                const maxS = steps.max || 50;
                stepsEl2.min = String(minS);
                stepsEl2.max = String(maxS);
                if (stepsVal) stepsVal.textContent = stepsEl2.value;
                stepsGroup.style.display = '';
            }
            if (guideEl2 && guidanceGroup) {
                const minG = guidance.min || 1;
                const maxG = guidance.max || 15;
                guideEl2.min = String(minG);
                guideEl2.max = String(maxG);
                if (guideVal) guideVal.textContent = guideEl2.value;
                guidanceGroup.style.display = '';
            }
        } catch {}
    }

    async getDanCaiFileList() { return []; }

    async smartFileDiscovery() { return []; }

    getFormatDistribution(files) { return {}; }

    generateSmartPatterns() { return []; }

    checkFileExists(filename) { return Promise.resolve({ exists: false, filename }); }

    updateConfigFile(files) { }

    
 
    updateDanCaiCount() {
        const count = this.danCaiImages.length;
        const titleElement = document.querySelector('.dan-cai-panel h3');
        titleElement.textContent = count > 0 ? `📚 丹材库 (${count}个)` : `📚 丹材库 (未加载)`;
    }

    
  
    renderDanCaiGrid() {
        const grid = document.getElementById('dan-cai-grid');
        grid.innerHTML = '';

        this.danCaiImages.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'dan-cai-item';
            item.dataset.index = index;
            item.onclick = () => this.toggleImageSelection(index);

            const img = document.createElement('img');
            img.src = file.url;
            img.alt = file.name || `丹材 ${index + 1}`;
            img.onerror = () => {
                item.innerHTML = `<div style=\"display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0; color: #999; font-size: 12px;\">${file.name || ('丹材 ' + (index + 1))}</div>`;
            };

            item.appendChild(img);
            grid.appendChild(item);
        });
    }

    toggleImageSelection(index) {
        const item = document.querySelector(`[data-index="${index}"]`);
        const isSelected = item.classList.contains('selected');

        if (isSelected) {
            item.classList.remove('selected');
            this.selectedImages = this.selectedImages.filter(i => i !== index);
        } else {
            const maxImages = parseInt(document.getElementById('max-images').value);
            if (this.selectedImages.length >= maxImages) {
                this.showError(`最多只能选择 ${maxImages} 张图片`);
                return;
            }
            item.classList.add('selected');
            this.selectedImages.push(index);
        }

        this.updateGenerateButton();
    }

    setupEventListeners() {
        document.getElementById('ai-provider').addEventListener('change', () => {
            this.updateProviderConfig();
            this.saveConfig();
        });

        const folderInput = document.getElementById('folder-input');
        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files || []);
                this.useLocalFolderFiles(files);
            });
        }

        document.getElementById('style-strength').addEventListener('input', (e) => {
            document.getElementById('style-strength-value').textContent = e.target.value + '%';
        });

        document.getElementById('creativity').addEventListener('input', (e) => {
            document.getElementById('creativity-value').textContent = e.target.value + '%';
        });

        document.getElementById('generate-count').addEventListener('input', (e) => {
            document.getElementById('generate-count-value').textContent = e.target.value;
        });

        const stepsEl = document.getElementById('steps');
        const stepsVal = document.getElementById('steps-value');
        if (stepsEl && stepsVal) stepsEl.addEventListener('input', (e) => stepsVal.textContent = e.target.value);
        const guidanceEl = document.getElementById('guidance');
        const guidanceVal = document.getElementById('guidance-value');
        if (guidanceEl && guidanceVal) guidanceEl.addEventListener('input', (e) => guidanceVal.textContent = e.target.value);

        const promptEl = document.getElementById('prompt-input');
        if (promptEl) {
            promptEl.addEventListener('input', () => this.updateGenerateButton());
        }
        const apiKeyEl = document.getElementById('api-key');
        if (apiKeyEl) {
            apiKeyEl.addEventListener('input', () => { this.updateGenerateButton(); this.saveConfig(); });
        }

        const modelSelect = document.getElementById('model-select');
        const modelInput = document.getElementById('model-name');
        const maxImagesInput = document.getElementById('max-images');
        if (modelSelect && modelInput) {
            modelSelect.addEventListener('change', () => {
                if (modelSelect.value) {
                    modelInput.value = modelSelect.value;
                    this.saveConfig();
                    
                    if (/Qwen\/?Qwen-Image-Edit-2509/i.test(modelSelect.value)) {
                        if (maxImagesInput) {
                            maxImagesInput.value = '3';
                            if (this.selectedImages.length > 3) {
                                this.selectedImages = this.selectedImages.slice(0, 3);
                            }
                            this.updateSelectionDisplay();
                            this.updateGenerateButton();
                            this.showSuccess('该模型支持最多3张参考图，已限制为 3 张');
                        }
                    }
                    this.loadModelDetail(modelSelect.value).catch(() => {});
                }
            });
            modelInput.addEventListener('input', () => this.saveConfig());
        }

        document.getElementById('max-images').addEventListener('change', (e) => {
            const maxImages = parseInt(e.target.value);
            if (this.selectedImages.length > maxImages) {
                this.selectedImages = this.selectedImages.slice(0, maxImages);
                this.updateSelectionDisplay();
            }
            this.saveConfig();
        });

        const endpointEl = document.getElementById('api-endpoint');
        if (endpointEl) endpointEl.addEventListener('input', () => this.saveConfig());
        const sizeEl = document.getElementById('image-size');
        if (sizeEl) sizeEl.addEventListener('change', () => this.saveConfig());
        const stepsEl2 = document.getElementById('steps');
        if (stepsEl2) stepsEl2.addEventListener('input', () => this.saveConfig());
        const guidanceEl2 = document.getElementById('guidance');
        if (guidanceEl2) guidanceEl2.addEventListener('input', () => this.saveConfig());
    }

    useLocalFolderFiles(files) {
        if (!files || files.length === 0) {
            this.showError('未选择任何文件');
            return;
        }

        const imageMimePrefixes = ['image/'];
        const imageExts = ['webp','jpg','jpeg','png','gif','bmp','svg','tiff','ico'];

        const imageFiles = files.filter(f => {
            if (f.type && imageMimePrefixes.some(p => f.type.startsWith(p))) return true;
            const lower = (f.name || '').toLowerCase();
            return imageExts.some(ext => lower.endsWith('.' + ext));
        });

        if (imageFiles.length === 0) {
            this.showError('所选文件夹中没有图片文件');
            return;
        }

        this.danCaiImages = imageFiles.map(f => ({ name: f.name, url: URL.createObjectURL(f), _file: f }));
        this.selectedImages = [];
        this.updateDanCaiCount();
        this.renderDanCaiGrid();
        this.updateGenerateButton();
        this.showSuccess(`已从本地加载 ${imageFiles.length} 张图片`);
    }

    updateProviderConfig() {
        const provider = document.getElementById('ai-provider').value;
        const defaultConfig = AIAdapterFactory.getDefaultConfig(provider);
        
        document.getElementById('api-endpoint').value = defaultConfig.endpoint;
        document.getElementById('model-name').value = defaultConfig.model;
        const modelInput = document.getElementById('model-name');
        if (provider === 'custom') {
            modelInput.disabled = false;
            modelInput.placeholder = '输入自定义模型名称';
        } else {
            modelInput.disabled = true;
            modelInput.placeholder = '自动识别模型';
        }
    }

    updateSelectionDisplay() {
        document.querySelectorAll('.dan-cai-item').forEach((item, index) => {
            if (this.selectedImages.includes(index)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    updateGenerateButton() {
        const generateBtn = document.getElementById('generate-btn');
        const hasSelection = this.selectedImages.length > 0;
        const hasPrompt = document.getElementById('prompt-input').value.trim() !== '';
        const hasApiKey = document.getElementById('api-key').value.trim() !== '';

        generateBtn.disabled = !(hasSelection && hasPrompt && hasApiKey);
    }

    async testConnection() {
        const config = this.getConfig();
        if (!config.apiKey) {
            this.showError('请先输入API密钥');
            return;
        }

        try {
            const adapter = AIAdapterFactory.createAdapter(config.provider, config);
            const isConnected = await adapter.testConnection();
            
            if (isConnected) {
                this.showSuccess('API连接成功！');
            } else {
                this.showError('API连接失败，请检查配置');
            }
        } catch (error) {
            this.showError(`连接测试失败: ${error.message}`);
        }
    }

    

    async generateMeme() {
        const config = this.getConfig();
        const prompt = document.getElementById('prompt-input').value.trim();
        
        if (!prompt) {
            this.showError('请输入描述');
            return;
        }

        if (this.selectedImages.length === 0) {
            this.showError('请选择至少一张丹材图片');
            return;
        }

        try {
            this.showLoading(true);
            this.showResults(true);

            const adapter = AIAdapterFactory.createAdapter(config.provider, config);
            
            const referenceImages = this.selectedImages.map(index => this.danCaiImages[index].url);

            const options = {
                styleStrength: parseInt(document.getElementById('style-strength').value) / 100,
                creativity: parseInt(document.getElementById('creativity').value) / 100,
                count: parseInt(document.getElementById('generate-count').value),
                size: config.size || undefined,
                steps: Number.isFinite(config.steps) ? config.steps : undefined,
                guidance: Number.isFinite(config.guidance) ? config.guidance : undefined
            };

            const results = await adapter.generate(prompt, referenceImages, options);
            
            this.displayResults(results);
            this.showLoading(false);

        } catch (error) {
            console.error('生成失败:', error);
            this.showError(`生成失败: ${error.message}`);
            this.showLoading(false);
        }
    }

    displayResults(results) {
        const resultsGrid = document.getElementById('results-grid');
        resultsGrid.innerHTML = '';

        if (Array.isArray(results)) {
            results.forEach((result, index) => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                
                resultItem.innerHTML = `
                    <img src="${result}" alt="生成的表情包 ${index + 1}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOi9veWksei0pTwvdGV4dD48L3N2Zz4='">
                    <div class="result-actions">
                        <button class="btn btn-download" onclick="downloadImage('${result}', 'meme_${index + 1}.png')">下载</button>
                        <button class="btn btn-favorite" onclick="favoriteImage('${result}')">收藏</button>
                    </div>
                `;
                
                resultsGrid.appendChild(resultItem);
            });
        } else {
            
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <h4>生成结果</h4>
                    <p>${results}</p>
                </div>
            `;
            resultsGrid.appendChild(resultItem);
        }
    }

    getConfig() {
        return {
            provider: document.getElementById('ai-provider').value,
            apiKey: document.getElementById('api-key').value,
            endpoint: document.getElementById('api-endpoint').value,
            model: document.getElementById('model-name').value,
            size: document.getElementById('image-size')?.value || '',
            steps: document.getElementById('steps') ? parseInt(document.getElementById('steps').value) : undefined,
            guidance: document.getElementById('guidance') ? parseInt(document.getElementById('guidance').value) : undefined
        };
    }

    saveConfig() {
        try {
            const cfg = {
                provider: document.getElementById('ai-provider').value,
                endpoint: document.getElementById('api-endpoint').value,
                apiKey: document.getElementById('api-key').value,
                model: document.getElementById('model-name').value,
                maxImages: document.getElementById('max-images').value,
                size: document.getElementById('image-size')?.value || '',
                steps: document.getElementById('steps') ? document.getElementById('steps').value : '',
                guidance: document.getElementById('guidance') ? document.getElementById('guidance').value : ''
            };
            localStorage.setItem('meme_generator_config', JSON.stringify(cfg));
        } catch {}
    }

    loadConfig() {
        try {
            const raw = localStorage.getItem('meme_generator_config');
            if (!raw) return;
            const cfg = JSON.parse(raw);
            if (cfg.provider) document.getElementById('ai-provider').value = cfg.provider;
            if (cfg.endpoint) document.getElementById('api-endpoint').value = cfg.endpoint;
            if (cfg.apiKey) document.getElementById('api-key').value = cfg.apiKey;
            if (cfg.model) document.getElementById('model-name').value = cfg.model;
            if (cfg.maxImages) document.getElementById('max-images').value = cfg.maxImages;
            if (document.getElementById('image-size') && typeof cfg.size === 'string') document.getElementById('image-size').value = cfg.size;
            if (document.getElementById('steps') && cfg.steps !== '') document.getElementById('steps').value = cfg.steps;
            if (document.getElementById('guidance') && cfg.guidance !== '') document.getElementById('guidance').value = cfg.guidance;
        } catch {}
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const generateBtn = document.getElementById('generate-btn');
        
        loading.style.display = show ? 'block' : 'none';
        generateBtn.disabled = show;
        generateBtn.textContent = show ? '生成中...' : '🎨 生成表情包';
    }

    showResults(show) {
        const resultsPanel = document.getElementById('results-panel');
        resultsPanel.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        alert('❌ ' + message);
    }

    showSuccess(message) {
        alert('✅ ' + message);
    }
}

function togglePassword() {
    const input = document.getElementById('api-key');
    const button = document.querySelector('.toggle-password');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

function selectAll() {
    const maxImages = parseInt(document.getElementById('max-images').value);
    const memeGenerator = window.memeGenerator;
    
    memeGenerator.selectedImages = [];
    for (let i = 0; i < Math.min(memeGenerator.danCaiImages.length, maxImages); i++) {
        memeGenerator.selectedImages.push(i);
    }
    memeGenerator.updateSelectionDisplay();
    memeGenerator.updateGenerateButton();
}

function selectNone() {
    const memeGenerator = window.memeGenerator;
    memeGenerator.selectedImages = [];
    memeGenerator.updateSelectionDisplay();
    memeGenerator.updateGenerateButton();
}

function selectRandom() {
    const maxImages = parseInt(document.getElementById('max-images').value);
    const memeGenerator = window.memeGenerator;
    
    const allIndices = Array.from({length: memeGenerator.danCaiImages.length}, (_, i) => i);
    const shuffled = allIndices.sort(() => Math.random() - 0.5);
    
    memeGenerator.selectedImages = shuffled.slice(0, maxImages);
    memeGenerator.updateSelectionDisplay();
    memeGenerator.updateGenerateButton();
}

function testConnection() {
    window.memeGenerator.testConnection();
}

function generateMeme() {
    window.memeGenerator.generateMeme();
}

async function loadModels() {
    try {
        const endpointInput = document.getElementById('api-endpoint');
        const apiKeyInput = document.getElementById('api-key');
        const datalist = document.getElementById('model-datalist');
        const selectEl = document.getElementById('model-select');
        if (!endpointInput || !apiKeyInput || !datalist) {
            alert('❌ 找不到模型加载所需的控件');
            return;
        }
        const endpoint = endpointInput.value.trim().replace(/\/$/, '');
        const apiKey = apiKeyInput.value.trim();
        if (!endpoint || !apiKey) {
            alert('❌ 请先填写API地址与API密钥');
            return;
        }

        const url = endpoint.endsWith('/v1') ? `${endpoint}/models` : `${endpoint}/v1/models`;
        let cleanKey = (apiKey || '').replace(/[\r\n]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        
        cleanKey = cleanKey.replace(/^Bearer\s+/i, '');
        
        const bearer = `Bearer ${cleanKey}`.replace(/[^\x00-\x7F]/g, '');
        const res = await fetch(url, {
            headers: { 'Authorization': bearer }
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            alert(`❌ 模型列表获取失败: ${res.status} ${detail}`);
            return;
        }
        const data = await res.json();
        
        let models = [];
        if (Array.isArray(data)) {
            models = data;
        } else if (Array.isArray(data?.data)) {
            models = data.data;
        } else if (Array.isArray(data?.models)) {
            models = data.models;
        }

        const names = models.map(m => m?.id || m?.name || m?.model || m).filter(Boolean);
        
        datalist.innerHTML = '';
        names.forEach(n => {
            const opt = document.createElement('option');
            opt.value = String(n);
            datalist.appendChild(opt);
        });
        
        if (selectEl) {
            selectEl.innerHTML = '<option value="">（请选择）</option>';
            names.forEach(n => {
                const o = document.createElement('option');
                o.value = String(n);
                o.textContent = String(n);
                selectEl.appendChild(o);
            });
        }
        
        const modelInput = document.getElementById('model-name');
        if (names.length && modelInput && !modelInput.value) {
            modelInput.value = String(names[0]);
        }
        if (names.length) {
            alert(`✅ 已加载 ${names.length} 个可用模型，点击输入框选择。`);
        } else {
            alert('⚠️ 未获取到可用模型，请检查账号权限或更换API Key');
        }
    } catch (e) {
        alert(`❌ 模型列表获取异常: ${e.message}`);
    }
}

function downloadImage(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}

function favoriteImage(url) {
    
    alert('收藏功能待实现');
}

function refreshDanCai() {
    
    openFolderPicker();
}

function openFolderPicker() {
    const input = document.getElementById('folder-input');
    if (input) input.click();
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.memeGenerator = new MemeGenerator();
});
