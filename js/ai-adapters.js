class AIAdapter {
    constructor(config) {
        this.config = config;
    }

    async generate(prompt, referenceImages, options = {}) {
        throw new Error('子类必须实现generate方法');
    }

    async testConnection() {
        throw new Error('子类必须实现testConnection方法');
    }
}

class OpenAIAdapter extends AIAdapter {
    async generate(prompt, referenceImages, options = {}) {
        const { apiKey, endpoint, model } = this.config;
        
        const messages = [{
            role: "user",
            content: [
                { type: "text", text: prompt },
                ...referenceImages.map(img => ({
                    type: "image_url",
                    image_url: { url: img }
                }))
            ]
        }];

        const response = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'gpt-4-vision-preview',
                messages: messages,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API错误: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.config.endpoint}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

class SiliconFlowAdapter extends AIAdapter {
    async generate(prompt, referenceImages, options = {}) {
        const { apiKey, endpoint, model } = this.config;
        const apiBase = endpoint?.endsWith('/v1') ? endpoint : `${endpoint.replace(/\/$/, '')}/v1`;

        const images = Array.isArray(referenceImages) ? referenceImages.slice(0, 3) : [];
        const imagesData = await Promise.all(images.map(src => this.#toDataUrl(src)));
        const modelName = model || 'Qwen/Qwen-Image-Edit-2509';

        const payload = { model: modelName, prompt: prompt || '' };
        if (/Qwen\/?Qwen-Image-Edit-2509/i.test(modelName)) {
            if (imagesData[0]) payload.image = imagesData[0];
            if (imagesData[1]) payload.image2 = imagesData[1];
            if (imagesData[2]) payload.image3 = imagesData[2];
        } else {
            if (imagesData[0]) payload.image = imagesData[0];
            if (options?.size) payload.image_size = options.size;
            if (Number.isFinite(options?.steps)) payload.num_inference_steps = options.steps;
            if (Number.isFinite(options?.guidance)) payload.guidance_scale = options.guidance;
        }

        const resp = await fetch(`${apiBase}/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.#sanitizeAuth(apiKey)}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            let detail = '';
            try { detail = await resp.text(); } catch {}
            throw new Error(`SiliconFlow images API错误: ${resp.status} ${detail}`.trim());
        }
        const data = await resp.json();
        if (Array.isArray(data?.images)) return data.images.map(i => i.url || i.b64_json || i.image).filter(Boolean);
        if (Array.isArray(data?.data)) return data.data.map(d => d.url || d.b64_json || d.image).filter(Boolean);
        if (Array.isArray(data?.output)) return data.output.map(d => d.url || d.b64_json || d.image).filter(Boolean);
        if (Array.isArray(data?.result)) return data.result.map(d => d.url || d.b64_json || d.image).filter(Boolean);
        return [];
    }

    async testConnection() {
        try {
            const apiBase = this.config.endpoint?.endsWith('/v1') ? this.config.endpoint : `${this.config.endpoint.replace(/\/$/, '')}/v1`;
            const response = await fetch(`${apiBase}/models`, {
                headers: { 'Authorization': `Bearer ${this.#sanitizeAuth(this.config.apiKey)}` }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async #toDataUrl(src) {
        if (typeof src === 'string' && src.startsWith('data:')) return src;
        try {
            const res = await fetch(src);
            const blob = await res.blob();
            return await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.readAsDataURL(blob);
            });
        } catch (e) {
            return src;
        }
    }

    #extractImageUrls(text) {
        if (typeof text !== 'string') return [];
        const re = /(https?:\/\/[^\s)"']+\.(?:png|jpg|jpeg|webp|gif|bmp|svg)|data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+)/g;
        const m = text.match(re);
        return m ? m : [];
    }

    #sanitizeAuth(key) {
        if (typeof key !== 'string') return '';
        let tok = key.replace(/[\r\n]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        tok = tok.replace(/^Bearer\s+/i, '');
        tok = tok.replace(/[^\x00-\x7F]/g, '');
        return tok;
    }
}

class BaiduAdapter extends AIAdapter {
    async generate(prompt, referenceImages, options = {}) {
        const { apiKey, endpoint } = this.config;
        
        const payload = {
            prompt: prompt,
            reference_images: referenceImages,
            style: options.style || 'realistic',
            size: options.size || '1024x1024',
            n: options.count || 1
        };

        const response = await fetch(`${endpoint}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`百度API错误: ${response.status}`);
        }

        const data = await response.json();
        return data.data.map(item => item.url);
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.config.endpoint}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

class TencentAdapter extends AIAdapter {
    async generate(prompt, referenceImages, options = {}) {
        const { apiKey, endpoint } = this.config;
        
        const payload = {
            prompt: prompt,
            reference_images: referenceImages,
            style: options.style || 'anime',
            quality: options.quality || 'hd',
            count: options.count || 1
        };

        const response = await fetch(`${endpoint}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`腾讯API错误: ${response.status}`);
        }

        const data = await response.json();
        return data.data.map(item => item.url);
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.config.endpoint}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

class AliyunAdapter extends AIAdapter {
    async generate(prompt, referenceImages, options = {}) {
        const { apiKey, endpoint } = this.config;
        
        const payload = {
            model: 'wanx-v1',
            input: {
                prompt: prompt,
                reference_images: referenceImages,
                style: options.style || 'realistic',
                size: options.size || '1024x1024',
                n: options.count || 1
            }
        };

        const response = await fetch(`${endpoint}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`阿里云API错误: ${response.status}`);
        }

        const data = await response.json();
        return data.output.results.map(item => item.url);
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.config.endpoint}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

class CustomAdapter extends AIAdapter {
    async generate(prompt, referenceImages, options = {}) {
        const { apiKey, endpoint } = this.config;
        
        const payload = {
            prompt: prompt,
            reference_images: referenceImages,
            ...options
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`自定义API错误: ${response.status}`);
        }

        const data = await response.json();
        return data.images || data.data || data.results;
    }

    async testConnection() {
        try {
            const response = await fetch(this.config.endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

class AIAdapterFactory {
    static createAdapter(provider, config) {
        switch (provider) {
            case 'openai':
                return new OpenAIAdapter(config);
            case 'siliconflow':
                return new SiliconFlowAdapter(config);
            case 'baidu':
                return new BaiduAdapter(config);
            case 'tencent':
                return new TencentAdapter(config);
            case 'aliyun':
                return new AliyunAdapter(config);
            case 'custom':
                return new CustomAdapter(config);
            default:
                throw new Error(`不支持的AI提供商: ${provider}`);
        }
    }

    static getDefaultConfig(provider) {
        const configs = {
            openai: {
                endpoint: 'https://api.openai.com/v1',
                model: 'gpt-4-vision-preview'
            },
            siliconflow: {
                endpoint: 'https://api.siliconflow.cn/v1',
                model: 'Qwen-Image-Edit-2509'
            },
            baidu: {
                endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxin/img2text',
                model: 'ernie-vilg-v2'
            },
            tencent: {
                endpoint: 'https://hunyuan.tencentcloudapi.com',
                model: 'hunyuan-v1'
            },
            aliyun: {
                endpoint: 'https://dashscope.aliyuncs.com/api/v1',
                model: 'wanx-v1'
            },
            custom: {
                endpoint: '',
                model: ''
            }
        };
        return configs[provider] || configs.custom;
    }
}

// 导出到全局
window.AIAdapterFactory = AIAdapterFactory;
